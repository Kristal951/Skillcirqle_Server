import { deleteMessage, editMessage } from "../services/message.service.js";

export const messageSocket = (io) => {
  io.on("connection", (socket) => {
    socket.join(`user:${socket.user.id}`);

    socket.on(
      "edit_message",
      async ({ messageId, newText, conversationId }) => {
        try {
          const updatedMessage = await editMessage({
            messageId,
            newText,
            userId: socket.user.id,
          });

          io.to(conversationId).emit("message_edited", updatedMessage);
        } catch (err) {
          socket.emit("error", err.message);
        }
      },
    );

    socket.on("delete_message", async ({ messageId, conversationId }) => {
      try {
        const deletedMsg = await deleteMessage({
          messageId,
          userId: socket.user.id,
        });

        io.to(conversationId).emit("message_deleted", deletedMsg);
      } catch (err) {
        socket.emit("error", err.message);
      }
    });
  });
};
