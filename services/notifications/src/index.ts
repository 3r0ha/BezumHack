import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';
import Redis from 'ioredis';
import jwt from 'jsonwebtoken';
import { notificationsRouter } from './routes/notifications';
import { telegramRouter } from './routes/telegram';
import prisma from './prisma';

const app = express();
const server = http.createServer(app);
const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret';

const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  path: '/notifications-ws',
});

// Socket auth
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('Auth required'));
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: string };
    (socket as any).userId = payload.userId;
    next();
  } catch {
    next(new Error('Invalid token'));
  }
});

io.on('connection', (socket) => {
  const userId = (socket as any).userId;
  socket.join(`user:${userId}`);
  console.log(`User ${userId} connected to notifications`);

  socket.on('mark_read', async (notificationId: string) => {
    await prisma.notification.update({
      where: { id: notificationId },
      data: { read: true, readAt: new Date() },
    });
  });

  socket.on('mark_all_read', async () => {
    await prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true, readAt: new Date() },
    });
  });
});

// Redis subscriber for notification events
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const subscriber = new Redis(redisUrl);

subscriber.subscribe('notifications', (err) => {
  if (err) console.error('Redis subscribe error:', err);
  else console.log('Subscribed to notifications channel');
});

async function sendTelegramNotification(userId: string, title: string, body: string) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return;

  try {
    // Get user's telegram chat ID from auth service
    const authUrl = process.env.AUTH_SERVICE_URL || 'http://auth:3001';
    const resp = await fetch(`${authUrl}/users/${userId}`);
    if (!resp.ok) return;
    const { user } = await resp.json() as { user: { telegramChatId?: string; telegramEnabled?: boolean } };

    if (!user?.telegramChatId || !user?.telegramEnabled) return;

    const text = `*${title}*\n${body}`;
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: user.telegramChatId,
        text,
        parse_mode: 'Markdown',
      }),
    });
  } catch (err) {
    console.error('Telegram send error:', err);
  }
}

subscriber.on('message', async (_channel, message) => {
  try {
    const data = JSON.parse(message);
    const { userId, type, priority, title, body, link, metadata } = data;

    const notification = await prisma.notification.create({
      data: { userId, type, priority: priority || 'MEDIUM', title, body, link, metadata },
    });

    io.to(`user:${userId}`).emit('notification', notification);
    sendTelegramNotification(userId, title, body);
  } catch (err) {
    console.error('Error processing notification:', err);
  }
});

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} ${res.statusCode} ${Date.now() - start}ms`);
  });
  next();
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'notifications' });
});

// Telegram webhook routes (no auth required)
app.use('/telegram', telegramRouter);

// JWT auth for all routes except health and telegram
app.use((req, res, next) => {
  if (req.path === '/health' || req.path.startsWith('/telegram')) return next();
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) { res.status(401).json({ error: 'Auth required' }); return; }
  try {
    const payload = jwt.verify(authHeader.split(' ')[1], JWT_SECRET) as { userId: string };
    (req as any).user = { userId: payload.userId };
    next();
  } catch { res.status(401).json({ error: 'Invalid token' }); }
});

app.use('/notifications', notificationsRouter);
app.set('io', io);

// Make Redis publisher available for direct notification creation
const publisher = new Redis(redisUrl);
app.set('redis', publisher);

app.use((err: any, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(`[ERROR] ${req.method} ${req.path}:`, err.message);
  if (err.name === 'ZodError') return res.status(400).json({ error: 'Validation error', details: err.errors });
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 3005;
server.listen(PORT, () => {
  console.log(`Notifications service running on port ${PORT}`);
});

export { app, server, io };
