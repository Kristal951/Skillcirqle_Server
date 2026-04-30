import {
  setUserOffline,
  setUserOnline,
  getOnlineUsers,
} from "../services/redis.service.js";

export const presenceSocket = (io, socket) => {
  const userId = socket.user.id;

  const handleConnect = async () => {
    try {
      await setUserOnline(userId, socket.id);
      const sockets = await socket.server
        .of("/")
        .adapter
        .sockets(new Set([socket.id]));

      const onlineUsers = await getOnlineUsers();

      const isFirstConnection =
        onlineUsers.filter((id) => id === userId).length === 1;

      if (isFirstConnection) {
        io.emit("user_online", { userId });
      }
      socket.emit("online_users", onlineUsers);
    } catch (err) {
      console.error("❌ Presence connect error:", err.message);
    }
  };

  handleConnect();

  socket.on("disconnect", async () => {
    try {
      const fullyOffline = await setUserOffline(userId, socket.id);

      if (fullyOffline) {
        io.emit("user_offline", { userId });
      }
    } catch (err) {
      console.error("❌ Presence disconnect error:", err.message);
    }
  });
};