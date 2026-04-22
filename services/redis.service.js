import { redis } from "../config/redis.js";

// =====================
// 🟢 ONLINE USERS
// =====================

// Add socket + mark user online
export const setUserOnline = async (userId, socketId) => {
  // store socket
  await redis.sadd(`user:${userId}:sockets`, socketId);

  // 🔥 set expiry (failsafe cleanup if server crashes)
  await redis.expire(`user:${userId}:sockets`, 60 * 60); // 1 hour

  // mark user as online
  await redis.sadd("online_users", userId);
};

// Remove socket + possibly mark offline
export const setUserOffline = async (userId, socketId) => {
  await redis.srem(`user:${userId}:sockets`, socketId);

  const count = await redis.scard(`user:${userId}:sockets`);

  if (count === 0) {
    await redis.srem("online_users", userId);

    // 🕒 store last seen
    await redis.set(`last_seen:${userId}`, Date.now());

    return true; // fully offline
  }

  return false;
};

// =====================
// 🔍 GET ONLINE USERS
// =====================

export const getOnlineUsers = async () => {
  return await redis.smembers("online_users");
};

export const isUserOnline = async (userId) => {
  return await redis.sismember("online_users", userId);
};

// =====================
// 🕒 LAST SEEN
// =====================

export const getLastSeen = async (userId) => {
  return await redis.get(`last_seen:${userId}`);
};

// =====================
// 🟡 TYPING
// =====================

// mark user typing (auto expires)
export const setTyping = async (conversationId, userId) => {
  const key = `typing:${conversationId}`;

  await redis.sadd(key, userId);

  // 🔥 expire entire typing set
  await redis.expire(key, 3);
};

// stop typing
export const clearTyping = async (conversationId, userId) => {
  await redis.srem(`typing:${conversationId}`, userId);
};

// get users typing in a conversation
export const getTypingUsers = async (conversationId) => {
  return await redis.smembers(`typing:${conversationId}`);
};