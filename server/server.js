// server/server.js (Corrected)

const express = require('express');
const http = require('http');
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*", 
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3001;

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.on('join-room', (roomId, userInfo = {}) => {
    socket.join(roomId);
    console.log(`User ${socket.id} joined room ${roomId} as ${userInfo.role || 'unknown'}`);
    
    // Store user info on the socket
    socket.userInfo = userInfo;
    socket.roomId = roomId;

    // Notify other users in the room
    socket.to(roomId).emit('user-connected', socket.id);
    
    // Notify other users about the new participant
    if (userInfo.studentName) {
      socket.to(roomId).emit('user-joined', {
        socketId: socket.id,
        name: userInfo.studentName,
        role: userInfo.role
      });
    }
  });

  socket.on('offer', (payload) => {
    io.to(payload.target).emit('offer', payload);
  });

  socket.on('answer', (payload) => {
    io.to(payload.target).emit('answer', payload);
  });

  socket.on('ice-candidate', (payload) => {
    io.to(payload.target).emit('ice-candidate', payload);
  });

  socket.on('get-room-participants', (roomId) => {
    const room = io.sockets.adapter.rooms.get(roomId);
    if (room) {
      const participants = [];
      room.forEach(socketId => {
        const socket = io.sockets.sockets.get(socketId);
        if (socket && socket.userInfo) {
          participants.push({
            socketId: socketId,
            name: socket.userInfo.studentName,
            role: socket.userInfo.role
          });
        }
      });
      socket.emit('room-participants', participants);
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    
    // Notify other users about the participant leaving
    if (socket.userInfo && socket.userInfo.name && socket.roomId) {
      socket.to(socket.roomId).emit('user-left', socket.id);
    }
  });
});

server.listen(PORT, () => {
  console.log(`✅ Signaling server is running on port ${PORT}`);
});