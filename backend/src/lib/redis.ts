import { Redis } from "ioredis";
import { env } from "../config/env.js";

const globalForRedis = globalThis as unknown as { redis?: Redis };

const createRedisClient = () => {
  const client = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    reconnectOnError: (err) => {
      console.error("Reconnect on error:", err);
      return true;
    }
  });

  client.on("connect", () => {
    console.log("✅ Redis connected");
  });

  client.on("error", (err) => {
    console.error("❌ Redis error:", err);
  });

  client.on("reconnecting", () => {
    console.warn("⚠️ Redis reconnecting...");
  });

  return client;
};

export const redis =
  globalForRedis.redis ?? createRedisClient();

if (env.NODE_ENV !== "production") {
  globalForRedis.redis = redis;
}

// graceful shutdown
process.on("SIGINT", async () => {
  await redis.quit();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await redis.quit();
  process.exit(0);
});