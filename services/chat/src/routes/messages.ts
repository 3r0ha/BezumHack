import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import {
  createConversationSchema,
  sendMessageSchema,
  translateMessageSchema,
  markReadSchema,
} from '../validators';

const prisma = new PrismaClient();
const router = Router();

// Async handler wrapper to catch errors and forward to error middleware
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// GET /conversations — list conversations by projectId and/or userId
router.get('/', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { projectId, userId } = req.query;

  const where: any = {};
  if (projectId) {
    where.projectId = projectId as string;
  }
  if (userId) {
    where.participants = {
      some: { userId: userId as string },
    };
  }

  const conversations = await prisma.conversation.findMany({
    where,
    include: {
      participants: true,
      messages: {
        take: 1,
        orderBy: { createdAt: 'desc' },
      },
    },
    orderBy: { updatedAt: 'desc' },
  });

  res.json(conversations);
}));

// POST /conversations — create a new conversation
router.post('/', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const parsed = createConversationSchema.parse(req.body);
  const { projectId, title, participantIds } = parsed;

  const conversation = await prisma.conversation.create({
    data: {
      projectId,
      title: title || null,
      participants: {
        create: participantIds.map((userId: string) => ({ userId })),
      },
    },
    include: {
      participants: true,
    },
  });

  res.status(201).json(conversation);
}));

// GET /conversations/:id/messages — get messages for a conversation (paginated, with optional search)
router.get('/:id/messages', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const skip = parseInt(req.query.skip as string) || 0;
  const take = parseInt(req.query.take as string) || 50;
  const search = req.query.search as string | undefined;

  const where: any = { conversationId: id };

  // Message search
  if (search && typeof search === 'string') {
    where.content = { contains: search, mode: 'insensitive' };
  }

  const [messages, total] = await Promise.all([
    prisma.message.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      skip,
      take,
    }),
    prisma.message.count({ where }),
  ]);

  res.json({ messages, total, skip, take });
}));

// POST /conversations/:id/messages — send a message
router.post('/:id/messages', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const parsed = sendMessageSchema.parse(req.body);
  const { senderId, content } = parsed;

  const message = await prisma.message.create({
    data: {
      conversationId: id,
      senderId,
      content,
    },
  });

  // Update conversation's updatedAt
  await prisma.conversation.update({
    where: { id },
    data: { updatedAt: new Date() },
  });

  // Emit via Socket.IO
  const io = req.app.get('io');
  if (io) {
    io.to(id).emit('new_message', message);
  }

  // Parse @mentions
  const mentionRegex = /@(\S+)/g;
  const mentions = [...parsed.content.matchAll(mentionRegex)].map(m => m[1]);
  if (mentions.length > 0) {
    try {
      const authUrl = process.env.AUTH_SERVICE_URL || 'http://auth:3001';
      const usersResp = await fetch(`${authUrl}/users`);
      if (usersResp.ok) {
        const { users } = await usersResp.json() as { users: { id: string; name: string; email: string }[] };
        // Publish notifications via Redis
        const Redis = require('ioredis');
        const publisher = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
        for (const mention of mentions) {
          const mentionLower = mention.toLowerCase();
          const matched = users.find(u =>
            u.name.toLowerCase() === mentionLower ||
            u.email.toLowerCase() === mentionLower ||
            u.name.toLowerCase().split(' ').some((part: string) => part === mentionLower)
          );
          if (matched && matched.id !== parsed.senderId) {
            await publisher.publish('notifications', JSON.stringify({
              userId: matched.id,
              type: 'MESSAGE_RECEIVED',
              title: 'Вас упомянули в чате',
              body: parsed.content.slice(0, 100),
              priority: 'HIGH',
            }));
          }
        }
        publisher.disconnect();
      }
    } catch {}
  }

  res.status(201).json(message);
}));

// POST /conversations/:id/read — mark conversation as read for a user (update lastReadAt)
router.post('/:id/read', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const parsed = markReadSchema.parse(req.body);
  const { userId } = parsed;

  const participant = await prisma.conversationParticipant.findUnique({
    where: {
      conversationId_userId: {
        conversationId: id,
        userId,
      },
    },
  });

  if (!participant) {
    res.status(404).json({ error: 'Participant not found in this conversation' });
    return;
  }

  const updated = await prisma.conversationParticipant.update({
    where: { id: participant.id },
    data: { lastReadAt: new Date() },
  });

  res.json(updated);
}));

// GET /conversations/:id/unread — get unread count for a user in a conversation
router.get('/:id/unread', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const { userId } = req.query;

  if (!userId || typeof userId !== 'string') {
    res.status(400).json({ error: 'userId query parameter is required' });
    return;
  }

  const participant = await prisma.conversationParticipant.findUnique({
    where: {
      conversationId_userId: {
        conversationId: id,
        userId,
      },
    },
  });

  if (!participant) {
    res.status(404).json({ error: 'Participant not found in this conversation' });
    return;
  }

  const where: any = { conversationId: id };
  if (participant.lastReadAt) {
    where.createdAt = { gt: participant.lastReadAt };
  }
  // Exclude the user's own messages from unread count
  where.senderId = { not: userId };

  const unreadCount = await prisma.message.count({ where });

  res.json({ conversationId: id, userId, unreadCount });
}));

// POST /messages/:id/translate — translate a message via AI service
router.post('/:conversationId/messages/:id/translate', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  const parsed = translateMessageSchema.parse(req.body);

  const message = await prisma.message.findUnique({ where: { id } });
  if (!message) {
    res.status(404).json({ error: 'Message not found' });
    return;
  }

  // Call AI service for translation
  const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://ai:3004';
  const response = await fetch(`${aiServiceUrl}/translate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: message.content,
      targetLanguage: parsed.targetLanguage,
    }),
  });

  if (!response.ok) {
    throw new Error(`AI service responded with ${response.status}`);
  }

  const { translatedText } = await response.json() as { translatedText: string };

  const updated = await prisma.message.update({
    where: { id },
    data: { translatedContent: translatedText },
  });

  res.json(updated);
}));

export { router as messagesRouter };
