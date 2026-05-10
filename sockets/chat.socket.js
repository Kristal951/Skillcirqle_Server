import { supabaseAdmin } from "../config/supabase.admin.js";
import {
  saveMessage,
  updateConversationLastMessage,
} from "../services/message.service.js";

const participantCache = new Map();
const activeUsersInRoom = new Map();
const activeChatFocus = new Map();

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

      try {
        const { data: receipts, error } = await supabaseAdmin.rpc(
          "mark_messages_delivered",
          {
            conv_id: conversationId,
            u_id: socket.user.id,
          },
        );

        if (error) throw error;

        if (receipts && receipts.length > 0) {
          io.to(conversationId).emit("messages_delivered", {
            conversationId,
            userId: socket.user.id,
          });
        }
      } catch (err) {
        console.error("❌ RPC delivery error:", err.message);
      }

      if (!activeUsersInRoom.has(conversationId)) {
        activeUsersInRoom.set(conversationId, new Set());
      }

      activeUsersInRoom.get(conversationId).add(socket.user.id);

      socket.join(conversationId);

      socket.to(conversationId).emit("user_joined", {
        userId: socket.user.id,
      });
    });

    socket.on("leave_room", (conversationId) => {
      if (!conversationId) return;

      socket.leave(conversationId);

      const room = activeUsersInRoom.get(conversationId);
      if (room) {
        room.delete(socket.user.id);
        if (room.size === 0) {
          activeUsersInRoom.delete(conversationId);
        }
      }
    });

    socket.on("chat_open", ({ conversationId }) => {
      activeChatFocus.set(socket.user.id, conversationId);
    });

    socket.on("chat_close", () => {
      activeChatFocus.delete(socket.user.id);
    });

    socket.on("send_message", async (data) => {
      const { conversationId, content, tempId } = data;
      if (!conversationId || !content?.trim()) return;

      const participants = await getConversationParticipants(conversationId);
      const recipients = participants.filter((id) => id !== socket.user.id);

      let message;

      try {
        message = await saveMessage({
          conversationId,
          content,
          senderId: socket.user.id,
          message_type: data.message_type || "text",
          metadata: {
            sender_name: socket.user.name,
            sender_avatar_url: socket.user.avatar,
            ...data.metadata,
          },
          reply_to: data.reply_to || null,
        });
      } catch (err) {
        socket.emit("message_error", { tempId });
        return;
      }

      try {
        await updateConversationLastMessage(
          conversationId,
          message
        );
      } catch (error) {
        console.error(
          "❌ Failed to update conversation last message:",
          error.message,
        );
      }

      if (message.reply) {
        io.to(conversationId).emit("receive_message", {
          ...message,
          sender: {
            id: socket.user.id,
            name: socket.user.name,
            avatar: socket.user.avatar,
          },
          tempId,
        });
      }

      io.to(conversationId).emit("conversation:updated", {
        conversationId,

        last_message: {
          text: message.text || message.content?.text || "",
          type: message.message_type,
          count:
            message.message_type === "image" || message.message_type === "file"
              ? (message.media?.length ?? 1)
              : undefined,
        },

        last_message_at: message.created_at,
        last_message_id: message.id,
      });

      if (recipients.length > 0) {
        await supabaseAdmin.from("message_receipts").upsert(
          recipients.map((userId) => ({
            message_id: message.id,
            user_id: userId,
            conversation_id: conversationId,
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

    socket.on(
      "message_delivered",
      async ({ messageId, conversationId, otherUserId }) => {
        if ((!messageId || !conversationId, !otherUserId)) return;

        const socketsInRoom = await io.in(conversationId).fetchSockets();
        const onlineUserIds = socketsInRoom.map((s) => s.user?.id);
        if (!onlineUserIds.includes(otherUserId)) return;

        try {
          const { data, error } = await supabaseAdmin.rpc(
            "mark_single_delivered",
            {
              msg_id: messageId,
              u_id: otherUserId,
            },
          );

          if (error) throw error;

          if (data && data.length > 0) {
            io.to(conversationId).emit("message_status_update", {
              messageId,
              conversationId,
              status: "delivered",
              userId: socket.user.id,
            });
          }
        } catch (err) {
          console.error("❌ Single delivery update failed:", err.message);
        }
      },
    );

    socket.on("mark_as_read", async ({ conversationId }) => {
      if (!conversationId) return;

      const roomUsers = activeUsersInRoom.get(conversationId);

      if (!roomUsers || roomUsers.size < 2) {
        return;
      }

      const bothActive = [...roomUsers].every((userId) => {
        return activeChatFocus.get(userId) === conversationId;
      });

      if (!bothActive) return;
      try {
        await supabaseAdmin.rpc("mark_conversation_read", {
          conv_id: conversationId,
          p_user_id: socket.user.id,
        });

        await supabaseAdmin.rpc("mark_all_read", {
          conv_id: conversationId,
          u_id: socket.user.id,
        });

        io.to(conversationId).emit("messages_seen", {
          conversationId,
          userId: socket.user.id,
        });
      } catch (err) {
        console.log("❌ mark_as_read error:", err.message);
      }
    });

    socket.on("typing", ({ conversationId }) => {
      if (!conversationId) return;

       const typingUser = {
      id: socket.user.id,
      name: socket.user.name,
      avatar: socket.user.avatar,
    };

      socket.to(conversationId).emit("typing", {
        conversationId,
        user: typingUser,
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
      for (const [roomId, users] of activeUsersInRoom.entries()) {
        users.delete(socket.user.id);

        if (users.size === 0) {
          activeUsersInRoom.delete(roomId);
        }
      }
    });
  });
};
