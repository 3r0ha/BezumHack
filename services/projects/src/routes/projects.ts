import { Router, Request, Response, NextFunction } from "express";
import prisma from "../prisma";
import { ProjectStatus } from "@prisma/client";
import { createProjectSchema, updateProjectSchema } from "../validators";
import { logAudit } from './audit';

export const projectsRouter = Router();

// Async handler wrapper to catch errors and forward to error middleware
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// GET / — list projects (optional query: clientId, managerId, status, search)
projectsRouter.get("/", asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { clientId, managerId, status, search } = req.query;

  const where: any = {};
  if (clientId) where.clientId = clientId as string;
  if (managerId) where.managerId = managerId as string;
  if (status) where.status = status as ProjectStatus;

  // Search in title and description
  if (search && typeof search === 'string') {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ];
  }

  const projects = await prisma.project.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { tasks: true, epochs: true, documents: true, meetings: true } },
      tasks: { select: { status: true } },
      epochs: { select: { id: true, title: true, status: true, startDate: true, endDate: true }, orderBy: { startDate: 'asc' }, take: 1 },
    },
  });

  res.json(projects);
}));

// GET /stats — return counts by status, total tasks count
projectsRouter.get("/stats", asyncHandler(async (_req: Request, res: Response): Promise<void> => {
  const [statusCounts, totalTasks] = await Promise.all([
    prisma.project.groupBy({
      by: ['status'],
      _count: { id: true },
    }),
    prisma.task.count(),
  ]);

  const byStatus: Record<string, number> = {};
  for (const item of statusCounts) {
    byStatus[item.status] = item._count.id;
  }

  const totalProjects = Object.values(byStatus).reduce((sum, count) => sum + count, 0);

  res.json({
    totalProjects,
    totalTasks,
    byStatus,
  });
}));

// GET /:id — get project with tasks and dependencies
projectsRouter.get("/:id", asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const project = await prisma.project.findUnique({
    where: { id: req.params.id },
    include: {
      tasks: {
        include: {
          blockedBy: { include: { blockingTask: true } },
          blocks: { include: { blockedTask: true } },
          documentRefs: { select: { id: true, documentId: true, quote: true } },
          epoch: { select: { id: true, title: true } },
        },
        orderBy: { createdAt: "asc" },
      },
      _count: { select: { epochs: true, documents: true, meetings: true } },
      epochs: {
        select: { id: true, title: true, status: true, startDate: true, endDate: true },
        orderBy: { startDate: 'asc' },
        take: 3,
      },
    },
  });

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  res.json(project);
}));

// POST / — create project
projectsRouter.post("/", asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const parsed = createProjectSchema.parse(req.body);
  const { title, description, clientId, managerId, deadline } = parsed;

  const project = await prisma.project.create({
    data: {
      title,
      description,
      clientId,
      managerId,
      deadline: deadline ? new Date(deadline) : undefined,
    },
  });

  logAudit({ userId: (req as any).user?.userId || '', action: 'project.created', entityType: 'project', entityId: project.id, details: { title: project.title } });

  res.status(201).json(project);
}));

// PATCH /:id — update project
projectsRouter.patch("/:id", asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const parsed = updateProjectSchema.parse(req.body);
  const { title, description, status, managerId, deadline, hourlyRate } = parsed;

  const existing = await prisma.project.findUnique({
    where: { id: req.params.id },
  });

  if (!existing) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const data: Record<string, unknown> = {};
  if (title !== undefined) data.title = title;
  if (description !== undefined) data.description = description;
  if (status !== undefined) data.status = status;
  if (managerId !== undefined) data.managerId = managerId;
  if (deadline !== undefined) data.deadline = deadline ? new Date(deadline) : null;
  if (hourlyRate !== undefined) data.hourlyRate = hourlyRate;

  const project = await prisma.project.update({
    where: { id: req.params.id },
    data,
  });

  logAudit({ userId: (req as any).user?.userId || '', action: 'project.updated', entityType: 'project', entityId: project.id, details: data });

  res.json(project);
}));

// DELETE /:id — delete project
projectsRouter.delete("/:id", asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const existing = await prisma.project.findUnique({
    where: { id: req.params.id },
  });

  if (!existing) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  await prisma.project.delete({
    where: { id: req.params.id },
  });

  logAudit({ userId: (req as any).user?.userId || '', action: 'project.deleted', entityType: 'project', entityId: req.params.id });

  res.status(204).send();
}));
