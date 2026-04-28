import { supabaseAdmin } from "../config/supabase.admin.js";
import {
  saveMessage,
  updateConversationLastMessage,
} from "../services/message.service.js";

const participantCache = new Map();

const CACHE_TTL = 60 * 1000;
const cacheTime = new Map();

export const getConversationParticipants = async (conversationId) => {
  const now = Date.now();

  if (
    participantCache.has(conversationId) &&
    now - cacheTime.get(conversationId) < CACHE_TTL
  ) {
    return participantCache.get(conversationId);
  }

  const { data, error } = await supabaseAdmin
    .from("conversation_participants")
    .select("user_id")
    .eq("conversation_id", conversationId);

  if (error) {
    console.log("❌ participant fetch error:", error.message);
    return [];
  }

  const users = data?.map((p) => p.user_id) || [];

  participantCache.set(conversationId, users);
  cacheTime.set(conversationId, Date.now());

  return users;
};

export const chatSocket = (io) => {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("No token provided"));

      const { data, error } = await supabaseAdmin.auth.getUser(token);

      if (error || !data?.user) {
        return next(new Error("Unauthorized"));
      }

      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("id, name, avatar_url")
        .eq("id", data.user.id)
        .single();

      socket.user = {
        id: data.user.id,
        name: profile?.name || "Unknown",
        avatar: profile?.avatar_url || null,
      };

      next();
    } catch (err) {
      next(new Error("Unauthorized"));
    }
  });

  const emitMessageStatus = (conversationId, messageId, status, userId) => {
    io.to(conversationId).emit("message_status", {
      messageId,
      status,
      userId,
      timestamp: Date.now(),
    });
  };

  io.on("connection", (socket) => {
    console.log(`🟢 Connected: ${socket.user.id}`);
    socket.join(`user:${socket.user.id}`);

    socket.on("join_room", async (conversationId) => {
      if (!conversationId) return;

      const { data } = await supabaseAdmin
        .from("conversation_participants")
        .select("id")
        .eq("conversation_id", conversationId)
        .eq("user_id", socket.user.id)
        .maybeSingle();

      if (!data) {
        return socket.emit("error", {
          message: "Unauthorized room access",
        });
      }

      socket.join(conversationId);

      socket.to(conversationId).emit("user_joined", {
        userId: socket.user.id,
      });
    });

    socket.on("send_message", async (data) => {
      const { conversationId, content, tempId } = data;

      if (!conversationId || !content?.trim()) return;

      let message;

      try {
        message = await saveMessage({
          conversationId,
          content,
          senderId: socket.user.id,
          metadata: {
            sender_name: socket.user.name,
            sender_avatar_url: socket.user.avatar,
          },
        });
      } catch (err) {
        socket.emit("message_error", { tempId });
        return;
      }

      await updateConversationLastMessage(
        conversationId,
        content,
        message.created_at,
      );

      const participants = await getConversationParticipants(conversationId);

      const recipients = participants.filter((id) => id !== socket.user.id);

      if (recipients.length > 0) {
        await supabaseAdmin.from("message_receipts").upsert(
          recipients.map((userId) => ({
            message_id: message.id,
            user_id: userId,
          })),
          {
            onConflict: "message_id,user_id",
          },
        );
      }

      socket.emit("message_ack", {
        tempId,
        realId: message.id,
        status: "sent",
      });

      io.to(conversationId).emit("new_message", {
        ...message,
        senderId: socket.user.id,
      });
    });

    socket.on("message_delivered", async ({ messageId, conversationId }) => {
      if (!messageId) return;

      await supabaseAdmin
        .from("message_receipts")
        .update({ delivered_at: new Date().toISOString() })
        .eq("message_id", messageId)
        .eq("user_id", socket.user.id);

      socket.to(conversationId).emit("message_status", {
        messageId,
        status: "delivered",
        userId: socket.user.id,
      });
    });

    socket.on("mark_as_read", async ({ conversationId, lastMessageId }) => {
      if (!conversationId || !lastMessageId) return;

      try {
        await supabaseAdmin.rpc("mark_conversation_read", {
          conv_id: conversationId,
          user_id: socket.user.id,
          msg_id: lastMessageId,
        });

        io.to(conversationId).emit("messages_read", {
          userId: socket.user.id,
          lastMessageId,
        });
      } catch (err) {
        console.log("mark_as_read error:", err.message);
      }
    });

    socket.on("typing", ({ conversationId }) => {
      if (!conversationId) return;

      socket.to(conversationId).emit("typing", {
        conversationId,
        userId: socket.user.id,
      });
    });

    socket.on("stop_typing", ({ conversationId }) => {
      if (!conversationId) return;

      socket.to(conversationId).emit("stop_typing", {
        conversationId,
        userId: socket.user.id,
      });
    });

    socket.on("disconnect", () => {
      console.log(`🔴 Disconnected: ${socket.user.id}`);
    });
  });
};
