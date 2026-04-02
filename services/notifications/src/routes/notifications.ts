import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../prisma';

const router = Router();

const asyncHandler = (fn: (req: any, res: Response, next: NextFunction) => Promise<void>) => {
  return (req: any, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// GET /notifications — list user's notifications
router.get('/', asyncHandler(async (req: any, res: Response) => {
  const { unreadOnly, limit, offset } = req.query;
  const where: any = { userId: req.user.userId };
  if (unreadOnly === 'true') where.read = false;

  const [notifications, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string) || 50,
      skip: parseInt(offset as string) || 0,
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId: req.user.userId, read: false } }),
  ]);

  res.json({ notifications, total, unreadCount });
}));

// PATCH /notifications/:id/read
router.patch('/:id/read', asyncHandler(async (req: any, res: Response) => {
  const notification = await prisma.notification.update({
    where: { id: req.params.id },
    data: { read: true, readAt: new Date() },
  });
  res.json(notification);
}));

// POST /notifications/read-all
router.post('/read-all', asyncHandler(async (req: any, res: Response) => {
  await prisma.notification.updateMany({
    where: { userId: req.user.userId, read: false },
    data: { read: true, readAt: new Date() },
  });
  res.json({ success: true });
}));

// POST /notifications/send — internal API to send notification (used by other services)
router.post('/send', asyncHandler(async (req: any, res: Response) => {
  const { userId, type, priority, title, body, link, metadata } = req.body;

  const notification = await prisma.notification.create({
    data: { userId, type, priority: priority || 'MEDIUM', title, body, link, metadata },
  });

  const io = req.app.get('io');
  if (io) io.to(`user:${userId}`).emit('notification', notification);

  res.status(201).json(notification);
}));

export { router as notificationsRouter };
