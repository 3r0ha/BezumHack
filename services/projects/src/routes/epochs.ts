import { Router, Request, Response, NextFunction } from "express";
import prisma from "../prisma";
import { publishNotification } from "../index";

export const epochsRouter = Router();

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => Promise.resolve(fn(req, res, next)).catch(next);

// Derive epoch status from task completion
async function computeEpochStatus(epochId: string): Promise<string> {
  const tasks = await prisma.task.findMany({ where: { epochId }, select: { status: true } });
  if (tasks.length === 0) return "PLANNED";
  const done = tasks.filter(t => t.status === "DONE").length;
  if (done === tasks.length) return "COMPLETED";
  if (done > 0 || tasks.some(t => t.status === "IN_PROGRESS" || t.status === "REVIEW")) return "ACTIVE";
  return "PLANNED";
}

// GET /project/:projectId — list epochs for project
epochsRouter.get("/project/:projectId", asyncHandler(async (req, res) => {
  const epochs = await prisma.epoch.findMany({
    where: { projectId: req.params.projectId },
    include: {
      tasks: { select: { id: true, status: true, title: true, priority: true, assigneeId: true } },
      documents: { select: { id: true, title: true, status: true, visibility: true } },
      releases: { select: { id: true, title: true, version: true, status: true } },
      meetings: { select: { id: true, title: true, status: true, scheduledAt: true } },
    },
    orderBy: { startDate: "asc" },
  });

  // Enrich with computed progress
  const enriched = epochs.map(epoch => {
    const total = epoch.tasks.length;
    const done = epoch.tasks.filter(t => t.status === "DONE").length;
    return {
      ...epoch,
      progress: total > 0 ? Math.round((done / total) * 100) : 0,
      taskCount: total,
      doneCount: done,
    };
  });

  res.json(enriched);
}));

// POST / — create epoch
epochsRouter.post("/", asyncHandler(async (req, res) => {
  const { title, description, projectId, startDate, endDate, goals } = req.body;
  if (!title || !projectId || !startDate || !endDate) {
    res.status(400).json({ error: "title, projectId, startDate, endDate are required" });
    return;
  }

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) { res.status(404).json({ error: "Project not found" }); return; }

  const epoch = await prisma.epoch.create({
    data: {
      title,
      description,
      projectId,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      goals: goals || [],
    },
    include: { tasks: true, documents: true, releases: true },
  });

  res.status(201).json(epoch);
}));

// GET /:id — get epoch
epochsRouter.get("/:id", asyncHandler(async (req, res) => {
  const epoch = await prisma.epoch.findUnique({
    where: { id: req.params.id },
    include: {
      tasks: {
        include: {
          blockedBy: { include: { blockingTask: true } },
          blocks: { include: { blockedTask: true } },
          documentRefs: { include: { document: { select: { id: true, title: true, status: true } } } },
        },
      },
      documents: { include: { versions: { orderBy: { version: "desc" }, take: 1 } } },
      releases: true,
      meetings: { include: { slots: true } },
    },
  });

  if (!epoch) { res.status(404).json({ error: "Epoch not found" }); return; }

  const total = epoch.tasks.length;
  const done = epoch.tasks.filter(t => t.status === "DONE").length;

  res.json({
    ...epoch,
    progress: total > 0 ? Math.round((done / total) * 100) : 0,
    taskCount: total,
    doneCount: done,
  });
}));

// PATCH /:id — update epoch
epochsRouter.patch("/:id", asyncHandler(async (req, res) => {
  const { title, description, startDate, endDate, status, goals } = req.body;

  const existing = await prisma.epoch.findUnique({ where: { id: req.params.id } });
  if (!existing) { res.status(404).json({ error: "Epoch not found" }); return; }

  const data: Record<string, unknown> = {};
  if (title !== undefined) data.title = title;
  if (description !== undefined) data.description = description;
  if (startDate !== undefined) data.startDate = new Date(startDate);
  if (endDate !== undefined) data.endDate = new Date(endDate);
  if (status !== undefined) data.status = status;
  if (goals !== undefined) data.goals = goals;

  const epoch = await prisma.epoch.update({ where: { id: req.params.id }, data });
  res.json(epoch);
}));

// DELETE /:id
epochsRouter.delete("/:id", asyncHandler(async (req, res) => {
  const existing = await prisma.epoch.findUnique({ where: { id: req.params.id } });
  if (!existing) { res.status(404).json({ error: "Epoch not found" }); return; }
  await prisma.epoch.delete({ where: { id: req.params.id } });
  res.status(204).send();
}));

// POST /:id/sync-status — auto-sync epoch status from task statuses
epochsRouter.post("/:id/sync-status", asyncHandler(async (req, res) => {
  const existing = await prisma.epoch.findUnique({ where: { id: req.params.id } });
  if (!existing) { res.status(404).json({ error: "Epoch not found" }); return; }

  const derivedStatus = await computeEpochStatus(req.params.id);
  const epoch = await prisma.epoch.update({
    where: { id: req.params.id },
    data: { status: derivedStatus as any },
  });

  res.json({ epoch, derivedStatus });
}));
