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

  // ── Typing events ──────────────────────────────────────────
  socket.on("typing", ({ recipientId, senderName }) => {
    const recipientSocketId = getReceiverSocketId(recipientId);
    if (recipientSocketId) {
      io.to(recipientSocketId).emit("typing", {
        senderId: userId,
        senderName,
      });
    }
  });

  socket.on("stopTyping", ({ recipientId }) => {
    const recipientSocketId = getReceiverSocketId(recipientId);
    if (recipientSocketId) {
      io.to(recipientSocketId).emit("stopTyping", {
        senderId: userId,
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
