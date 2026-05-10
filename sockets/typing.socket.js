import { clearTyping, setTyping } from "../services/redis.service.js";

export const typingSocket = (socket) => {
  socket.on("typing", async ({ conversationId }) => {
    const typingUser = {
      id: socket.user.id,
      name: socket.user.name,
      avatar: socket.user.avatar,
    };

    await setTyping(conversationId, typingUser);

    socket.to(conversationId).emit("typing", {
      conversationId,
      user: typingUser,
    });
  });
  socket.on("stop_typing", async ({ conversationId }) => {
    await clearTyping(conversationId, socket.user.id);

    socket.to(conversationId).emit("stop_typing", {
      conversationId,
      userId: socket.user.id,
    });
  });
};
