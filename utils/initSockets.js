import { chatSocket } from "../sockets/chat.socket.js";


let initialized = false;

export const initSockets = (io) => {
  if (initialized) return;

  initialized = true;
  chatSocket(io);
};