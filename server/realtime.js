const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { pool } = require('./db');

const JWT_SECRET = process.env.JWT_SECRET;
let io = null;

// Сколько открытых соединений у каждого пользователя (несколько вкладок = несколько соединений)
const online = new Map();

function isOnline(userId) {
  return online.has(userId);
}

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
    const uid = socket.data.userId;
    socket.join('user:' + uid);
    online.set(uid, (online.get(uid) || 0) + 1);

    socket.on('disconnect', () => {
      const left = (online.get(uid) || 1) - 1;
      if (left > 0) {
        online.set(uid, left);
        return;
      }
      online.delete(uid);
      pool.query('UPDATE users SET last_seen_at = NOW() WHERE id = $1', [uid]).catch(() => { });
    });
  });
}

function emitToUsers(userIds, event, payload) {
  if (!io) return;
  for (const id of new Set(userIds)) {
    io.to('user:' + id).emit(event, payload);
  }
}

module.exports = { initRealtime, emitToUsers, isOnline };