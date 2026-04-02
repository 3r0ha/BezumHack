import { Router, Response, NextFunction } from 'express';
import prisma from '../prisma';
import { AuthRequest } from '../middleware/auth';
import { publishNotification } from '../index';
import { dispatchWebhookEvent } from './webhooks';
import { z } from 'zod';

export const commentsRouter = Router();

const asyncHandler = (fn: (req: any, res: Response, next: NextFunction) => Promise<void>) => {
  return (req: any, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

const createCommentSchema = z.object({
  content: z.string().min(1),
  taskId: z.string().uuid(),
});

// GET /comments/task/:taskId
commentsRouter.get('/task/:taskId', asyncHandler(async (req: AuthRequest, res: Response) => {
  const comments = await prisma.comment.findMany({
    where: { taskId: req.params.taskId },
    orderBy: { createdAt: 'asc' },
  });
  res.json(comments);
}));

// POST /comments
commentsRouter.post('/', asyncHandler(async (req: AuthRequest, res: Response) => {
  const parsed = createCommentSchema.parse(req.body);
  const comment = await prisma.comment.create({
    data: {
      content: parsed.content,
      taskId: parsed.taskId,
      userId: req.user!.userId,
    },
  });

  // Notify task assignee about new comment
  const task = await prisma.task.findUnique({ where: { id: parsed.taskId } });
  if (task?.assigneeId && task.assigneeId !== req.user!.userId) {
    publishNotification(req.app, {
      userId: task.assigneeId,
      type: 'TASK_COMMENT',
      title: 'Новый комментарий',
      body: `Комментарий к "${task.title}": ${parsed.content.slice(0, 100)}`,
      link: `/projects/${task.projectId}`,
    });
  }

  // Parse @mentions from comment content
  const mentionRegex = /@(\S+)/g;
  const mentions = [...parsed.content.matchAll(mentionRegex)].map(m => m[1]);

  if (mentions.length > 0) {
    // Look up users by name or email
    try {
      const authUrl = process.env.AUTH_SERVICE_URL || 'http://auth:3001';
      const usersResp = await fetch(`${authUrl}/users`);
      if (usersResp.ok) {
        const { users } = await usersResp.json() as { users: { id: string; name: string; email: string }[] };
        for (const mention of mentions) {
          const mentionLower = mention.toLowerCase();
          const matchedUser = users.find(u =>
            u.name.toLowerCase() === mentionLower ||
            u.email.toLowerCase() === mentionLower ||
            u.name.toLowerCase().split(' ').some(part => part === mentionLower)
          );
          if (matchedUser && matchedUser.id !== req.user!.userId) {
            publishNotification(req.app, {
              userId: matchedUser.id,
              type: 'TASK_COMMENT',
              title: 'Вас упомянули в комментарии',
              body: `В задаче "${task?.title || ''}": ${parsed.content.slice(0, 100)}`,
              link: `/projects/${task?.projectId}`,
              priority: 'HIGH',
            });
          }
        }
      }
    } catch {}
  }

  dispatchWebhookEvent('comment.created', task?.projectId || null, { comment: { id: comment.id, taskId: comment.taskId, content: comment.content.slice(0, 200) } });

  res.status(201).json(comment);
}));

// PATCH /comments/:id
commentsRouter.patch('/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { content } = req.body;
  if (!content || typeof content !== 'string' || content.length < 1) {
    res.status(400).json({ error: 'Content is required' });
    return;
  }
  const comment = await prisma.comment.findUnique({ where: { id: req.params.id } });
  if (!comment) { res.status(404).json({ error: 'Comment not found' }); return; }
  if (comment.userId !== req.user!.userId) { res.status(403).json({ error: 'Not your comment' }); return; }

  const updated = await prisma.comment.update({
    where: { id: req.params.id },
    data: { content },
  });
  res.json(updated);
}));

// DELETE /comments/:id
commentsRouter.delete('/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const comment = await prisma.comment.findUnique({ where: { id: req.params.id } });
  if (!comment) { res.status(404).json({ error: 'Comment not found' }); return; }
  if (comment.userId !== req.user!.userId) { res.status(403).json({ error: 'Not your comment' }); return; }
  await prisma.comment.delete({ where: { id: req.params.id } });
  res.status(204).send();
}));
