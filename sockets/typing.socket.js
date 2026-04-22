import { clearTyping, setTyping } from "../services/redis.service.js";

export const typingSocket = (socket) => {
  socket.on("typing", async ({ conversationId }) => {
    await setTyping(conversationId, socket.user.id);

    socket.to(conversationId).emit("typing", {
      userId: socket.user.id,
    });
  });

  socket.on("stop_typing", async ({ conversationId }) => {
    await clearTyping(conversationId, socket.user.id);

    socket.to(conversationId).emit("stop_typing", {
      userId: socket.user.id,
    });
  });
}