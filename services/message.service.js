import { supabaseAdmin } from "../config/supabase.admin.js";

/**
 * =====================
 * 💾 SAVE MESSAGE
 * =====================
 */
export const saveMessage = async ({
  conversationId,
  senderId,
  content,
  message_type,
  metadata,
}) => {
  if (!conversationId || !senderId || !content?.trim()) {
    throw new Error("Invalid message payload");
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("messages")
      .insert({
        conversation_id: conversationId,
        sender_id: senderId,
        content: content.trim(),
        message_type: message_type || "text",
        metadata: metadata || {},
      })
      .select()
      .single();

    if (error) throw error;

    return data;
  } catch (err) {
    console.log("❌ saveMessage error:", err.message);
    throw err;
  }
};

/**
 * =====================
 * 🔄 UPDATE LAST MESSAGE
 * =====================
 */
export const updateConversationLastMessage = async (
  conversationId,
  userId,
  lastMessageId,
) => {
  if (!conversationId) return;
  console.log(conversationId, userId, lastMessageId)

  try {
    const { data, error } = await supabaseAdmin.rpc("mark_conversation_read", {
      conv_id: conversationId,
      p_user_id: userId,
      msg_id: lastMessageId,
    });

    if (error) {
      console.error("❌ Conversation update error:", error.message);
      return;
    }

    console.log("✅ conversation updated:", data);
  } catch (err) {
    console.error("❌ updateConversationLastMessage error:", err.message);
  }
};

/**
 * =====================
 * 👤 GET PROFILE
 * =====================
 */
export const getProfile = async (userId) => {
  if (!userId) return null;

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id, name, avatar_url")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.log("❌ getProfile error:", error.message);
    return null;
  }

  return data;
};
