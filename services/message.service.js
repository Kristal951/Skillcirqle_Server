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
  // ✅ validation guard
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
  content,
  createdAt,
) => {
  if (!conversationId) return;

  const { error } = await supabaseAdmin
    .from("conversations")
    .update({
      last_message: content,
      last_message_at: createdAt,
    })
    .eq("id", conversationId);

  if (error) {
    console.log("❌ updateConversationLastMessage error:", error.message);
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