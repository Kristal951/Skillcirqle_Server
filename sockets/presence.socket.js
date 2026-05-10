import {
  setUserOffline,
  setUserOnline,
  getOnlineUsers,
  getLastSeen,
} from "../services/redis.service.js";

export const presenceSocket = (io, socket) => {
  const userId = socket.user.id;

  const handleConnect = async () => {
    try {
      await setUserOnline(userId, socket.id);

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

  socket.on("get_last_seen_bulk", async ({ userIds }, cb) => {
    try {
      if (!Array.isArray(userIds)) return cb([]);

      const results = await Promise.all(
        userIds.map(async (id) => {
          const lastSeen = await getLastSeen(id);

          return {
            userId: id,
            lastSeen: lastSeen || null,
          };
        }),
      );

      cb(results);
    } catch (err) {
      console.error(err);
      cb([]);
    }
  });

  socket.on("get_last_seen", async ({ userId }, callback) => {
    const lastSeen = await getLastSeen(userId);

    callback({
      userId,
      lastSeen,
    });
  });

  socket.on("disconnect", async () => {
    try {
      const fullyOffline = await setUserOffline(userId, socket.id);

      if (fullyOffline) {
        const lastSeen = await getLastSeen(userId);

        io.emit("user_offline", {
          userId,
          lastSeen,
        });
      }
    } catch (err) {
      console.error("❌ Presence disconnect error:", err.message);
    }
  });
};
