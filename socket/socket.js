const express = require("express");
const socketIO = require("socket.io");
const http = require("http");
const app = express();

const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const getReceiverSocketId = (receiverId) => {
  return userSocketMap[receiverId];
};

const userSocketMap = {};

io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  const userId = socket.handshake.query.userId;
  if (userId != undefined) {
    userSocketMap[userId] = socket.id;
  }

  io.emit("getOnlineUsers", Object.keys(userSocketMap));

  // ── Typing — includes conversationId ──────────────────────
  socket.on("typing", ({ recipientId, senderName, conversationId }) => {
    const recipientSocketId = getReceiverSocketId(recipientId);
    if (recipientSocketId) {
      io.to(recipientSocketId).emit("typing", {
        senderId: userId,
        senderName,
        conversationId,
      });
    }
  });

  socket.on("stopTyping", ({ recipientId, conversationId }) => {
    const recipientSocketId = getReceiverSocketId(recipientId);
    if (recipientSocketId) {
      io.to(recipientSocketId).emit("stopTyping", {
        senderId: userId,
        conversationId,
      });
    }
  });

  // ── Instant read receipt ───────────────────────────────────
  socket.on("markSeen", ({ conversationId, recipientId, seenAt }) => {
    const targetId =
      recipientId === null || recipientId === undefined ? 0 : recipientId;
    const recipientSocketId = getReceiverSocketId(targetId);
    if (recipientSocketId) {
      io.to(recipientSocketId).emit("messagesSeen", {
        conversation_id: conversationId,
        seen_at: seenAt,
      });
    }
  });

  // ── Disconnect ─────────────────────────────────────────────
  socket.on("disconnect", () => {
    console.log("A user disconnected:", socket.id);
    delete userSocketMap[userId];
    io.emit("getOnlineUsers", Object.keys(userSocketMap));
  });
});

module.exports = { app, io, server, getReceiverSocketId };
