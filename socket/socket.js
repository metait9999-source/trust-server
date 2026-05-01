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

  // ── Typing — now includes conversationId ──────────────────
  socket.on("typing", ({ recipientId, senderName, conversationId }) => {
    const recipientSocketId = getReceiverSocketId(recipientId);
    if (recipientSocketId) {
      io.to(recipientSocketId).emit("typing", {
        senderId: userId,
        senderName,
        conversationId, // ← pass through so receiver can key by convId
      });
    }
  });

  socket.on("stopTyping", ({ recipientId, conversationId }) => {
    const recipientSocketId = getReceiverSocketId(recipientId);
    if (recipientSocketId) {
      io.to(recipientSocketId).emit("stopTyping", {
        senderId: userId,
        conversationId, // ← pass through
      });
    }
  });

  // ── Instant read receipt via socket ───────────────────────
  // When a user is actively viewing a conversation and receives a message,
  // emit seen immediately without waiting for HTTP fetch
  socket.on("markSeen", ({ conversationId, recipientId, seenAt }) => {
    const recipientSocketId = getReceiverSocketId(recipientId);
    if (recipientSocketId) {
      io.to(recipientSocketId).emit("messagesSeen", {
        conversation_id: conversationId,
        seen_at: seenAt,
      });
    }
  });

  socket.on("disconnect", () => {
    console.log("A user disconnected:", socket.id);
    delete userSocketMap[userId];
    io.emit("getOnlineUsers", Object.keys(userSocketMap));
  });
});

module.exports = { app, io, server, getReceiverSocketId };
