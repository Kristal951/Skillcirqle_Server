import { supabaseAdmin } from "../config/supabase.admin.js";
import jwt from "jsonwebtoken";
import {
  saveMessage,
  updateConversationLastMessage,
} from "../services/message.service.js";

export const chatSocket = (io) => {
  // =====================
  // 🔐 AUTH MIDDLEWARE
  // =====================
  io.use(async (socket, next) => {
    try {
      console.log("🔐 [AUTH] Checking socket token...");

      const token = socket.handshake.auth?.token;

      if (!token) {
        console.log("❌ [AUTH] No token provided");
        return next(new Error("No token provided"));
      }

      const { data, error } = await supabaseAdmin.auth.getUser(token);

      if (error || !data?.user) {
        console.log("❌ [AUTH] Invalid token");
        return next(new Error("Unauthorized"));
      }

      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("id, name, avatar_url")
        .eq("id", data.user.id)
        .single();

      socket.user = {
        ...socket.user,
        name: profile?.name,
        avatar: profile?.avatar_url,
      };

      console.log(`✅ [AUTH] User authenticated: ${socket.user.id}`);
      next();
    } catch (err) {
      console.log("❌ [AUTH] Error:", err.message);
      next(new Error("Unauthorized"));
    }
  });

  // =====================
  // CONNECTION
  // =====================
  io.on("connection", (socket) => {
    console.log(`🟢 [CONNECT] User connected: ${socket.user.id}`);

    // =====================
    // 🔌 JOIN ROOM
    // =====================
    socket.on("join_room", async (conversationId) => {
      console.log(
        `📥 [JOIN] User ${socket.user.id} trying room ${conversationId}`,
      );

      const { data, error } = await supabaseAdmin
        .from("conversation_participants")
        .select("id")
        .eq("conversation_id", conversationId)
        .eq("user_id", socket.user.id)
        .single();

      if (error || !data) {
        console.log(
          `⛔ [JOIN] Access denied for user ${socket.user.id} in room ${conversationId}`,
        );
        return;
      }

      socket.join(conversationId);

      console.log(
        `✅ [JOIN] User ${socket.user.id} joined room ${conversationId}`,
      );
    });

    // =====================
    // 📤 SEND MESSAGE
    // =====================
    socket.on("send_message", async (data) => {
      const senderId = socket.user.id;
      const { conversationId, content, tempId } = data;
      console.log(data, data)

      console.log("📤 [MESSAGE] Sending message...");
      console.log("➡️ Content:", content);
      console.log("➡️ Conversation:", conversationId);
      console.log("➡️ Sender:", senderId);

      if (!content?.trim()) {
        console.log("⚠️ [MESSAGE] Empty message ignored");
        return;
      }

      const message = await saveMessage({
        ...data,
        senderId,
      });

      console.log(`💾 [MESSAGE] Saved: ${message.id}`);

      await updateConversationLastMessage(
        conversationId,
        payload.content,
        message.created_at,
      );

      console.log("🔄 [CONVERSATION] Updated last message");
      console.log(senderId, "senderID");
      // 4. Emit message
      io.to(conversationId).emit("new_message", {
        id: message.id,
        conversation_id: message.conversation_id,
        content: message.content,
        created_at: message.created_at,
        message_type: message.message_type,
        metadata: message.metadata,
        tempId,

        sender: {
          id: socket.user.id,
          name: socket.user.name,
          avatar: socket.user.avatar,
        },
      });

      console.log(`📡 [EMIT] Message broadcasted to ${conversationId}`);
    });

    // =====================
    // ⌨️ TYPING
    // =====================
    socket.on("typing", ({ conversationId }) => {
      console.log(
        `⌨️ [TYPING] User ${socket.user.id} typing in ${conversationId}`,
      );

      socket.to(conversationId).emit("typing", {
        userId: socket.user.id,
      });
    });

    socket.on("stop_typing", ({ conversationId, userId }) => {
      socket.to(conversationId).emit("stop_typing", {
        userId,
      });
    });

    // =====================
    // ❌ DISCONNECT
    // =====================
    socket.on("disconnect", (reason) => {
      console.log(
        `🔴 [DISCONNECT] User ${socket.user?.id ?? "unknown"} | ${reason}`,
      );
    });
  });
};
