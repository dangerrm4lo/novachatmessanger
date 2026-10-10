const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
let io = null;

function initRealtime(httpServer) {
  io = new Server(httpServer);

  io.use((socket, next) => {
    try {
      socket.data.userId = jwt.verify(socket.handshake.auth.token || '', JWT_SECRET).sub;
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(`user:${socket.data.userId}`);
  });
}

function emitToUsers(userIds, event, payload) {
  if (!io) return;
  for (const id of new Set(userIds)) {
    io.to(`user:${id}`).emit(event, payload);
  }
}

module.exports = { initRealtime, emitToUsers };