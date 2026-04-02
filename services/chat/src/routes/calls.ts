import { Router, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const router = Router();

const asyncHandler = (fn: (req: any, res: Response, next: NextFunction) => Promise<void>) => {
  return (req: any, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// POST /calls — create a new call
router.post('/', asyncHandler(async (req: any, res: Response) => {
  const { conversationId, participants, type } = req.body;
  const initiatorId = req.user?.userId || req.body.initiatorId;

  if (!participants || !Array.isArray(participants) || participants.length === 0) {
    res.status(400).json({ error: 'participants required' });
    return;
  }

  const call = await prisma.call.create({
    data: {
      conversationId: conversationId || null,
      initiatorId,
      type: type || 'video',
      participants: [initiatorId, ...participants.filter((p: string) => p !== initiatorId)],
      status: 'ringing',
    },
  });

  // Post system message to conversation chat
  if (call.conversationId) {
    try {
      const msg = await prisma.message.create({
        data: {
          conversationId: call.conversationId,
          senderId: initiatorId,
          content: '\u{1F4DE} Call started',
        },
      });
      const io = req.app.get('io');
      if (io) {
        io.to(call.conversationId).emit('new_message', msg);
      }
    } catch (err) {
      console.error('Failed to create call start message:', err);
    }
  }

  res.status(201).json(call);
}));

// PATCH /calls/:id — update call status
router.patch('/:id', asyncHandler(async (req: any, res: Response) => {
  const { status } = req.body;
  const data: any = { status };
  if (status === 'active') data.startedAt = new Date();
  if (status === 'ended') data.endedAt = new Date();

  const call = await prisma.call.update({
    where: { id: req.params.id },
    data,
  });

  // Post system message when call ends
  if (status === 'ended' && call.conversationId && call.startedAt) {
    try {
      const durationMs = Date.now() - new Date(call.startedAt).getTime();
      const minutes = Math.floor(durationMs / 60000);
      const seconds = Math.floor((durationMs % 60000) / 1000);
      const durationStr = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;

      const msg = await prisma.message.create({
        data: {
          conversationId: call.conversationId,
          senderId: call.initiatorId,
          content: `\u{1F4DE} Call ended \u00B7 ${durationStr}`,
        },
      });
      const io = req.app.get('io');
      if (io) {
        io.to(call.conversationId).emit('new_message', msg);
      }
    } catch (err) {
      console.error('Failed to create call end message:', err);
    }
  }

  res.json(call);
}));

// GET /calls/:id — get call info
router.get('/:id', asyncHandler(async (req: any, res: Response) => {
  const call = await prisma.call.findUnique({ where: { id: req.params.id } });
  if (!call) { res.status(404).json({ error: 'Call not found' }); return; }
  res.json(call);
}));

export { router as callsRouter };
