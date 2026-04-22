import {
  setUserOffline,
  setUserOnline,
  getOnlineUsers,
} from "../services/redis.service.js";

export const presenceSocket = (io, socket) => {
  const userId = socket.user.id;

  // =====================
  // 🟢 HANDLE CONNECT
  // =====================
  const handleConnect = async () => {
    try {
      // add socket to Redis
      await setUserOnline(userId, socket.id);

      // get number of sockets for this user
      // (only emit if first connection)
      const sockets = await socket.server
        .of("/")
        .adapter
        .sockets(new Set([socket.id]));

      // 🔥 safer approach: check via Redis instead
      const onlineUsers = await getOnlineUsers();

      // if user appears only once → first connection
      const isFirstConnection =
        onlineUsers.filter((id) => id === userId).length === 1;

      if (isFirstConnection) {
        console.log(`🟢 [PRESENCE] ${userId} ONLINE`);
        io.emit("user_online", { userId });
      }

      // =====================
      // 📡 SEND INITIAL ONLINE USERS
      // =====================
      socket.emit("online_users", onlineUsers);
    } catch (err) {
      console.error("❌ Presence connect error:", err.message);
    }
  };

  handleConnect();

  // =====================
  // 🔴 HANDLE DISCONNECT
  // =====================
  socket.on("disconnect", async () => {
    try {
      const fullyOffline = await setUserOffline(userId, socket.id);

      if (fullyOffline) {
        console.log(`🔴 [PRESENCE] ${userId} OFFLINE`);
        io.emit("user_offline", { userId });
      }
    } catch (err) {
      console.error("❌ Presence disconnect error:", err.message);
    }
  });
};