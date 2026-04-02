import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import { messagesRouter } from './routes/messages';
import { uploadRouter } from './routes/upload';
import { callsRouter } from './routes/calls';
import { setupSocket } from './socket';
import { authMiddleware } from './middleware/auth';

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// Redis adapter for Socket.IO pub/sub
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const pubClient = new Redis(redisUrl);
const subClient = pubClient.duplicate();

Promise.all([
  new Promise<void>((resolve) => pubClient.on('connect', resolve)),
  new Promise<void>((resolve) => subClient.on('connect', resolve)),
]).then(() => {
  io.adapter(createAdapter(pubClient, subClient) as any);
  console.log('Socket.IO Redis adapter connected');
}).catch((err) => {
  console.warn('Redis adapter connection failed, running without adapter:', err.message);
});

// Middleware
app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} ${res.statusCode} ${Date.now() - start}ms`);
  });
  next();
});

// JWT auth for all routes except health
app.use((req, res, next) => {
  if (req.path === '/health' || req.path.startsWith('/upload/file/')) return next();
  authMiddleware(req as any, res, next);
});

// Make io accessible from routes
app.set('io', io);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'chat-service' });
});

// REST routes
app.use('/conversations', messagesRouter);
app.use('/upload', uploadRouter);
app.use('/calls', callsRouter);

// Socket.IO handlers
setupSocket(io);

// Error handler - add after all routes
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(`[ERROR] ${req.method} ${req.path}:`, err.message);

  if (err.name === 'ZodError') {
    return res.status(400).json({ error: 'Validation error', details: err.errors });
  }

  if (err.name === 'PrismaClientKnownRequestError') {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Resource already exists' });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Resource not found' });
    }
  }

  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 3003;

server.listen(PORT, () => {
  console.log(`Chat service running on port ${PORT}`);
});

export { app, server, io };
