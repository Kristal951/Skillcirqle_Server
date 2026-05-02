import { chatSocket } from "../sockets/chat.socket.js";
import { messageSocket } from "../sockets/message.socket.js";
import { notificationsSocket } from "../sockets/notifications.socket.js";


let initialized = false;

export const initSockets = (io) => {
  if (initialized) return;

  initialized = true;
  chatSocket(io);
  notificationsSocket(io)
  messageSocket(io)
};