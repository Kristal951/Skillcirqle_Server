import { supabaseAdmin } from "../config/supabase.admin.js";
import {
  saveMessage,
  updateConversationLastMessage,
} from "../services/message.service.js";

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
          ...data,
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

      if (!message) return;

      socket.emit("message_ack", {
        tempId,
        realId: message.id,
        status: "sent",
      });

      await updateConversationLastMessage(
        conversationId,
        content,
        message.created_at,
      );

      io.to(conversationId).emit("new_message", {
        ...message,
        senderId: socket.user.id,
      });
    });

    socket.on("message_delivered", async ({ messageId, conversationId }) => {
      if (!messageId || !conversationId) return;

      await supabaseAdmin.from("message_receipts").upsert({
        message_id: messageId,
        conversation_id: conversationId,
        user_id: socket.user.id,
        delivered_at: new Date().toISOString(),
      });

      socket.to(conversationId).emit("message_status", {
        messageId,
        status: "delivered",
        userId: socket.user.id,
        timestamp: Date.now(),
      });
    });

    socket.on("mark_as_read", async ({ conversationId, messageId }) => {
      if (!conversationId || !messageId) return;

      const userId = socket.user.id;

     const res = await supabaseAdmin.from("conversations_read").upsert({
        conversation_id: conversationId,
        user_id: userId,
        last_read_message_id: new Date().toISOString(),
      })

      await supabaseAdmin.from("message_receipts").upsert(
        {
          message_id: messageId,
          conversation_id: conversationId,
          user_id: socket.user.id,
          read_at: new Date().toISOString(),
        },
        {
          onConflict: "message_id,user_id",
        },
      );

      io.to(conversationId).emit("messages_seen", {
        conversationId,
        userId,
        messageId,
      });

      socket.to(conversationId).emit("message_status", {
        messageId,
        status: "read",
        userId,
        timestamp: Date.now(),
      });
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
