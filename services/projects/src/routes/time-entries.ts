import { Router, Response, NextFunction } from 'express';
import prisma from '../prisma';
import { AuthRequest } from '../middleware/auth';
import { z } from 'zod';

export const timeEntriesRouter = Router();

const asyncHandler = (fn: (req: any, res: Response, next: NextFunction) => Promise<void>) => {
  return (req: any, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

const startTimerSchema = z.object({
  taskId: z.string().uuid(),
  note: z.string().optional(),
});

const manualEntrySchema = z.object({
  taskId: z.string().uuid(),
  hours: z.number().positive(),
  note: z.string().optional(),
  startedAt: z.string().datetime().optional(),
});

// GET /time-entries/task/:taskId
timeEntriesRouter.get('/task/:taskId', asyncHandler(async (req: AuthRequest, res: Response) => {
  const entries = await prisma.timeEntry.findMany({
    where: { taskId: req.params.taskId },
    orderBy: { startedAt: 'desc' },
  });
  res.json(entries);
}));

// GET /time-entries/my/active — get current running timer
timeEntriesRouter.get('/my/active', asyncHandler(async (req: AuthRequest, res: Response) => {
  const active = await prisma.timeEntry.findFirst({
    where: { userId: req.user!.userId, stoppedAt: null },
    orderBy: { startedAt: 'desc' },
  });
  res.json(active);
}));

// POST /time-entries/start — start timer
timeEntriesRouter.post('/start', asyncHandler(async (req: AuthRequest, res: Response) => {
  const parsed = startTimerSchema.parse(req.body);

  // Stop any running timer first
  const running = await prisma.timeEntry.findFirst({
    where: { userId: req.user!.userId, stoppedAt: null },
  });
  if (running) {
    const hours = (Date.now() - running.startedAt.getTime()) / 3600000;
    await prisma.timeEntry.update({
      where: { id: running.id },
      data: { stoppedAt: new Date(), hours },
    });
  }

  const entry = await prisma.timeEntry.create({
    data: {
      taskId: parsed.taskId,
      userId: req.user!.userId,
      startedAt: new Date(),
      note: parsed.note,
    },
  });
  res.status(201).json(entry);
}));

// POST /time-entries/stop — stop running timer
timeEntriesRouter.post('/stop', asyncHandler(async (req: AuthRequest, res: Response) => {
  const running = await prisma.timeEntry.findFirst({
    where: { userId: req.user!.userId, stoppedAt: null },
  });
  if (!running) { res.status(404).json({ error: 'No running timer' }); return; }

  const hours = (Date.now() - running.startedAt.getTime()) / 3600000;
  const entry = await prisma.timeEntry.update({
    where: { id: running.id },
    data: { stoppedAt: new Date(), hours },
  });

  // Update task actualHours
  const totalHours = await prisma.timeEntry.aggregate({
    where: { taskId: running.taskId, stoppedAt: { not: null } },
    _sum: { hours: true },
  });
  await prisma.task.update({
    where: { id: running.taskId },
    data: { actualHours: totalHours._sum.hours || 0 },
  });

  res.json(entry);
}));

// POST /time-entries/manual — add manual time entry
timeEntriesRouter.post('/manual', asyncHandler(async (req: AuthRequest, res: Response) => {
  const parsed = manualEntrySchema.parse(req.body);
  const startedAt = parsed.startedAt ? new Date(parsed.startedAt) : new Date();
  const stoppedAt = new Date(startedAt.getTime() + parsed.hours * 3600000);

  const entry = await prisma.timeEntry.create({
    data: {
      taskId: parsed.taskId,
      userId: req.user!.userId,
      startedAt,
      stoppedAt,
      hours: parsed.hours,
      note: parsed.note,
    },
  });

  // Update task actualHours
  const totalHours = await prisma.timeEntry.aggregate({
    where: { taskId: parsed.taskId, stoppedAt: { not: null } },
    _sum: { hours: true },
  });
  await prisma.task.update({
    where: { id: parsed.taskId },
    data: { actualHours: totalHours._sum.hours || 0 },
  });

  res.status(201).json(entry);
}));

// GET /time-entries/project/:projectId/summary — time summary for project
timeEntriesRouter.get('/project/:projectId/summary', asyncHandler(async (req: AuthRequest, res: Response) => {
  const tasks = await prisma.task.findMany({
    where: { projectId: req.params.projectId },
    select: { id: true, title: true, estimatedHours: true, actualHours: true },
  });

  const taskIds = tasks.map(t => t.id);
  const entries = await prisma.timeEntry.findMany({
    where: { taskId: { in: taskIds }, stoppedAt: { not: null } },
  });

  const totalEstimated = tasks.reduce((sum, t) => sum + (t.estimatedHours || 0), 0);
  const totalActual = tasks.reduce((sum, t) => sum + (t.actualHours || 0), 0);

  // Group by user
  const byUser: Record<string, number> = {};
  for (const e of entries) {
    byUser[e.userId] = (byUser[e.userId] || 0) + (e.hours || 0);
  }

  res.json({
    totalEstimated,
    totalActual,
    variance: totalActual - totalEstimated,
    byUser,
    tasks: tasks.map(t => ({
      id: t.id,
      title: t.title,
      estimated: t.estimatedHours,
      actual: t.actualHours,
      variance: (t.actualHours || 0) - (t.estimatedHours || 0),
    })),
  });
}));
