import { redis } from "../config/redis.js";

export const setUserOnline = async (userId, socketId) => {
  await redis.sadd(`user:${userId}:sockets`, socketId);
  await redis.expire(`user:${userId}:sockets`, 60 * 60); 
  await redis.sadd("online_users", userId);
};

export const setUserOffline = async (userId, socketId) => {
  await redis.srem(`user:${userId}:sockets`, socketId);
  const count = await redis.scard(`user:${userId}:sockets`);
  if (count === 0) {
    await redis.srem("online_users", userId);
    await redis.set(`last_seen:${userId}`, Date.now());
    return true; 
  }
  return false;
};

export const getOnlineUsers = async () => {
  return await redis.smembers("online_users");
};

export const isUserOnline = async (userId) => {
  return await redis.sismember("online_users", userId);
};

export const getLastSeen = async (userId) => {
  return await redis.get(`last_seen:${userId}`);
};

export const setTyping = async (conversationId, userId) => {
  const key = `typing:${conversationId}`;
  await redis.sadd(key, userId);
  await redis.expire(key, 3);
};

export const clearTyping = async (conversationId, userId) => {
  await redis.srem(`typing:${conversationId}`, userId);
};

export const getTypingUsers = async (conversationId) => {
  return await redis.smembers(`typing:${conversationId}`);
};