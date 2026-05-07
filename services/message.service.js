import { supabaseAdmin } from "../config/supabase.admin.js";

export const saveMessage = async ({
  conversationId,
  senderId,
  content,
  message_type,
  metadata,
  reply_to = null,
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
        reply_to,
      })
      .select(
        `
      *,
      reply:reply_to (
        id,
        content,
        sender_id,
        metadata
      )
    `,
      )
      .single();

    if (error) throw error;

    return data;
  } catch (err) {
    throw err;
  }
};

// export const updateConversationLastMessage = async (
//   conversationId,
//   userId,
//   lastMessageId,
// ) => {
//   if (!conversationId) return;

//   try {
//     const { data, error } = await supabaseAdmin.rpc("mark_conversation_read", {
//       conv_id: conversationId,
//       p_user_id: userId,
//       msg_id: lastMessageId,
//     });

//     if (error) {
//       console.error("❌ Conversation update error:", error.message);
//       return;
//     }
//   } catch (err) {
//     console.error("❌ updateConversationLastMessage error:", err.message);
//   }
// };

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

export const editMessage = async ({ messageId, newText, userId }) => {
  const { data: message } = await supabaseAdmin
    .from("messages")
    .select("*")
    .eq("id", messageId)
    .single();

  if (!message) throw new Error("Message not found");
  if (message.sender_id !== userId) throw new Error("Unauthorized");

  const { data, error } = await supabaseAdmin
    .from("messages")
    .update({
      content: newText,
      is_edited: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", messageId)
    .select()
    .single();

  if (error) throw error;

  return data;
};

export const deleteMessage = async ({ messageId, userId }) => {
  const { data: message } = await supabaseAdmin
    .from("messages")
    .select("*")
    .eq("id", messageId)
    .single();

  if (!message) throw new Error("Message not found");

  if (message.sender_id !== userId) {
    throw new Error("Unauthorized");
  }

  const { data, error } = await supabaseAdmin
    .from("messages")
    .update({
      content: "",
      is_deleted: true,
      deleted_at: new Date().toISOString(),
    })
    .eq("id", messageId)
    .select()
    .single();

  if (error) throw error;

  return data;
};

export const updateConversationLastMessage = async (
  conversationId,
  message,
) => {
  if (!conversationId || !message) return;

  const { data, error } = await supabaseAdmin.rpc(
    "update_conversation_from_message",
    {
      conv_id: conversationId,
      msg_content: message.content,
      msg_type: message.message_type,
      msg_count: Array.isArray(message.metadata?.media)
        ? message.metadata.media.length
        : null,
      msg_id: message.id,
      msg_created_at: message.created_at,
    },
  );

  if (error) {
    console.error("❌ Failed to update conversation:", error.message);
  }
};

// BEGIN
//   -- Perform the upsert by selecting the latest message ID directly in the query
//   INSERT INTO conversations_read (
//     conversation_id,
//     user_id,
//     last_read_message_id,
//     updated_at
//   )
//   SELECT conv_id, p_user_id, id, now()
//   FROM messages
//   WHERE conversation_id = conv_id
//   ORDER BY created_at DESC
//   LIMIT 1
//   ON CONFLICT (conversation_id, user_id)
//   DO UPDATE SET
//     last_read_message_id = EXCLUDED.last_read_message_id,
//     updated_at = now();
// END;
