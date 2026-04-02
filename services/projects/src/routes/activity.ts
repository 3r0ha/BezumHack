import { Router, Response, NextFunction } from 'express';
import prisma from '../prisma';
import { AuthRequest } from '../middleware/auth';

export const activityRouter = Router();

const asyncHandler = (fn: (req: any, res: Response, next: NextFunction) => Promise<void>) => {
  return (req: any, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// GET /activity/recent — recent activity across projects
activityRouter.get('/recent', asyncHandler(async (req: AuthRequest, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 20;

  // Get recent tasks (created/updated)
  const recentTasks = await prisma.task.findMany({
    orderBy: { updatedAt: 'desc' },
    take: limit,
    include: { project: { select: { title: true } } },
  });

  // Get recent comments
  const recentComments = await prisma.comment.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: { task: { select: { title: true, project: { select: { title: true } } } } },
  });

  // Get recent approvals
  const recentApprovals = await prisma.approval.findMany({
    orderBy: { updatedAt: 'desc' },
    take: limit,
    include: { project: { select: { title: true } } },
  });

  // Merge and sort by date
  const activities = [
    ...recentTasks.map(t => ({
      id: `task-${t.id}`,
      type: t.createdAt.getTime() === t.updatedAt.getTime() ? 'task_created' : 'status_changed',
      description: t.createdAt.getTime() === t.updatedAt.getTime()
        ? `Создана задача "${t.title}"`
        : `Задача "${t.title}" → ${t.status}`,
      projectTitle: t.project.title,
      userId: t.assigneeId,
      createdAt: t.updatedAt.toISOString(),
    })),
    ...recentComments.map(c => ({
      id: `comment-${c.id}`,
      type: 'comment',
      description: `Комментарий к "${c.task.title}": ${c.content.slice(0, 80)}`,
      projectTitle: c.task.project.title,
      userId: c.userId,
      createdAt: c.createdAt.toISOString(),
    })),
    ...recentApprovals.map(a => ({
      id: `approval-${a.id}`,
      type: a.status === 'PENDING' ? 'approval_requested' : 'approval_reviewed',
      description: a.status === 'PENDING'
        ? `Запрос на согласование: "${a.title}"`
        : `${a.status === 'APPROVED' ? 'Одобрено' : 'Отклонено'}: "${a.title}"`,
      projectTitle: a.project.title,
      userId: a.requestedBy,
      createdAt: a.updatedAt.toISOString(),
    })),
  ]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);

  res.json(activities);
}));
