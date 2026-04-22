import { supabaseAdmin } from "../config/supabase.admin.js";

export const saveMessage = async ({
  conversationId,
  senderId,
  content,
  message_type,
  metadata,
}) => {
  const { data, error } = await supabaseAdmin
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      content,
      message_type,
      metadata,
    })
    .select()
    .single();

  if (error) throw error;

  return data;
};

export const updateConversationLastMessage = async (
  conversationId,
  content,
  createdAt
) => {
  await supabaseAdmin
    .from("conversations")
    .update({
      last_message: content,
      last_message_at: createdAt,
    })
    .eq("id", conversationId);
};

export const getProfile = async (userId) => {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("id, name, avatar_url")
    .eq("id", userId)
    .single();

  return data;
};