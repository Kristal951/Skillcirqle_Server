import { chatSocket } from "../sockets/chat.socket.js";
import { messageSocket } from "../sockets/message.socket.js";
import { notificationsSocket } from "../sockets/notifications.socket.js";

let initialized = false;

export const initSockets = (io) => {
  if (initialized) return;

  initialized = true;
  chatSocket(io);
  notificationsSocket(io);
  messageSocket(io);
};


// await supabaseAdmin.rpc("update_last_message", {
//   conv_id: conversationId,
//   msg_content: message.content,
//   msg_type: message.message_type,
//   msg_count: message.metadata?.count ?? null,
//   msg_id: message.id,
//   msg_created_at: message.created_at,
// });