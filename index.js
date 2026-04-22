import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";
import { chatSocket } from "./sockets/chat.socket.js";
import { redis } from "./config/redis.js";
import { createAdapter } from "@socket.io/redis-adapter";
import { supabaseAdmin } from "./config/supabase.admin.js";
import { presenceSocket } from "./sockets/presence.socket.js";
import { typingSocket } from "./sockets/typing.socket.js";
import { readReceiptSocket } from "./sockets/readReceipt.socket.js";

dotenv.config();

const app = express();
const server = http.createServer(app);
const USER_SOCKET_KEY = (userId) => `user:socket:${userId}`;

const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    credentials: true,
  },
});

const pubClient = redis;
const subClient = redis.duplicate();
subClient.on("error", (err) => {
  console.log("❌ Redis Sub error:", err);
});

pubClient.on("error", (err) => {
  console.log("❌ Redis Pub error:", err);
});
io.adapter(createAdapter(pubClient, subClient));

io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;

    if (!token) return next(new Error("Unauthorized"));

    const { data, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !data?.user) {
      return next(new Error("Unauthorized"));
    }

    socket.user = {
      id: data.user.id,
      email: data.user.email,
    };

    next();
  } catch {
    next(new Error("Unauthorized"));
  }
});

app.use(cors({ origin: "http://localhost:3000", credentials: true }));
app.use(express.json());

io.on("connection", async (socket) => {
  const userId = socket.user.id;
  const key = USER_SOCKET_KEY(userId);

  console.log("🟢 Incoming connection:", userId);

  const existingSocketId = await redis.get(key);

  // 🔥 CASE 1: same socket reconnecting → ignore
  if (existingSocketId === socket.id) {
    console.log("🟡 Reconnected same socket:", socket.id);
    return;
  }

  // 🔥 CASE 2: another active session exists → KILL OLD
  if (existingSocketId) {
    const oldSocket = io.sockets.sockets.get(existingSocketId);

    if (oldSocket) {
      console.log("🔴 Killing previous session:", existingSocketId);

      oldSocket.emit("force_logout", {
        reason: "Another device logged in",
      });

      oldSocket.disconnect(true);
    }
  }

  // 🔥 Register new session (GLOBAL STATE)
  await redis.set(key, socket.id);

  console.log("🟢 Active session set:", userId);

  // attach features
  chatSocket(io, socket);
  presenceSocket(io, socket);
  typingSocket(io, socket);
  readReceiptSocket(io, socket);

  // cleanup
  socket.on("disconnect", async (reason) => {
    console.log("🔴 Disconnected:", userId, reason);

    const current = await redis.get(key);

    if (current === socket.id) {
      await redis.del(key);
    }
  });
});

server.listen(5000, () => {
  console.log("Server running on port 5000");
});
