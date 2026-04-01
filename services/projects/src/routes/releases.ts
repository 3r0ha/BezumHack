import { Router, Request, Response, NextFunction } from "express";
import prisma from "../prisma";
import { publishNotification } from "../index";

export const releasesRouter = Router();

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => Promise.resolve(fn(req, res, next)).catch(next);

function getUserId(req: Request): string {
  return (req as any).user?.userId || "";
}

// GET /epoch/:epochId — releases for an epoch
releasesRouter.get("/epoch/:epochId", asyncHandler(async (req, res) => {
  const releases = await prisma.release.findMany({
    where: { epochId: req.params.epochId },
    include: { epoch: { select: { id: true, title: true, projectId: true } } },
    orderBy: { createdAt: "desc" },
  });
  res.json(releases);
}));

// POST / — create release
releasesRouter.post("/", asyncHandler(async (req, res) => {
  const { epochId, title, version, notes, gitTag } = req.body;
  if (!epochId || !title || !version) {
    res.status(400).json({ error: "epochId, title, version are required" });
    return;
  }

  const epoch = await prisma.epoch.findUnique({ where: { id: epochId } });
  if (!epoch) { res.status(404).json({ error: "Epoch not found" }); return; }

  const release = await prisma.release.create({
    data: {
      epochId,
      title,
      version,
      notes: notes || null,
      gitTag: gitTag || null,
      createdBy: getUserId(req),
    },
    include: { epoch: { select: { id: true, title: true, projectId: true } } },
  });

  res.status(201).json(release);
}));

// GET /:id
releasesRouter.get("/:id", asyncHandler(async (req, res) => {
  const release = await prisma.release.findUnique({
    where: { id: req.params.id },
    include: { epoch: { select: { id: true, title: true, projectId: true } } },
  });
  if (!release) { res.status(404).json({ error: "Release not found" }); return; }
  res.json(release);
}));

// PATCH /:id — update / publish release
releasesRouter.patch("/:id", asyncHandler(async (req, res) => {
  const { title, version, notes, status, gitTag, releasedAt } = req.body;

  const existing = await prisma.release.findUnique({ where: { id: req.params.id } });
  if (!existing) { res.status(404).json({ error: "Release not found" }); return; }

  const data: Record<string, unknown> = {};
  if (title !== undefined) data.title = title;
  if (version !== undefined) data.version = version;
  if (notes !== undefined) data.notes = notes;
  if (status !== undefined) data.status = status;
  if (gitTag !== undefined) data.gitTag = gitTag;
  if (releasedAt !== undefined) data.releasedAt = new Date(releasedAt);

  // Auto-set releasedAt when publishing
  if (status === "PUBLISHED" && !existing.releasedAt) {
    data.releasedAt = new Date();
  }

  const release = await prisma.release.update({ where: { id: req.params.id }, data });
  res.json(release);
}));

// DELETE /:id
releasesRouter.delete("/:id", asyncHandler(async (req, res) => {
  const existing = await prisma.release.findUnique({ where: { id: req.params.id } });
  if (!existing) { res.status(404).json({ error: "Release not found" }); return; }
  await prisma.release.delete({ where: { id: req.params.id } });
  res.status(204).send();
}));
