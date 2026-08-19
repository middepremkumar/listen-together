require('dotenv').config();

const http = require('http');
const express = require('express');
const cors = require('cors');
const { Server } = require('socket.io');

const { connectDB } = require('./config/db');
const roomRoutes = require('./routes/roomRoutes');
const authRoutes = require('./routes/authRoutes');
const { apiLimiter, createRoomLimiter } = require('./middleware/rateLimiter');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');
const { initSocket } = require('./socket/socketHandler');
const roomManager = require('./socket/roomManager');

const PORT = process.env.PORT || 4000;
const CORS_ORIGIN = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map((o) => o.trim());

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: CORS_ORIGIN,
    methods: ['GET', 'POST'],
    credentials: true
  },
  pingTimeout: 20000,
  pingInterval: 10000
});

app.use(
  cors({
    origin: CORS_ORIGIN,
    credentials: true
  })
);
app.use(express.json({ limit: '20kb' }));
app.use(apiLimiter);

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    activeRooms: roomManager.getActiveRoomCount(),
    time: new Date().toISOString()
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/rooms', createRoomLimiter, roomRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

initSocket(io);

async function start() {
  await connectDB();
  server.listen(PORT, () => {
    console.log(`[server] Listen Together backend running on port ${PORT}`);
    console.log(`[server] Allowed CORS origins: ${CORS_ORIGIN.join(', ')}`);
  });
}

start();

process.on('unhandledRejection', (err) => {
  console.error('[unhandledRejection]', err);
});

process.on('SIGTERM', async () => {
  console.log('[server] SIGTERM received, persisting rooms and shutting down...');
  await roomManager.persistAllRooms();
  server.close(() => process.exit(0));
});

module.exports = { app, server, io };
