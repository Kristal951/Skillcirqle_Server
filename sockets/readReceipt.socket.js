import { supabaseAdmin } from "../config/supabase.admin.js";

export const readReceiptSocket = (io, socket) => {
  socket.on("mark_seen", async ({ conversationId }) => {
    const userId = socket.user.id;

    await supabaseAdmin
      .from("messages")
      .update({
        seen_by: supabaseAdmin.raw(
          `array_append(seen_by, '${userId}')`
        ),
      })
      .eq("conversation_id", conversationId);

    io.to(conversationId).emit("messages_seen", {
      userId,
      conversationId,
    });
  });
};