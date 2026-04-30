import IORedis from "ioredis";
import dotenv from 'dotenv'
dotenv.config()

export const redis = new IORedis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

redis.on("connect", () => console.log("🟢 Redis connected"));
redis.on("error", (err) => console.log("❌ Redis error:", err.message));