import { Router, Request, Response, NextFunction } from "express";
import prisma from "../prisma";
import { publishNotification } from "../index";

export const documentsRouter = Router();

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => Promise.resolve(fn(req, res, next)).catch(next);

function getRole(req: Request): string {
  return (req as any).user?.role || "DEVELOPER";
}

function getUserId(req: Request): string {
  return (req as any).user?.userId || "";
}

// Role-based visibility filter
function visibilityFilter(role: string) {
  if (role === "MANAGER") return undefined; // sees everything
  if (role === "DEVELOPER") return { in: ["PUBLIC", "TEAM"] as const };
  return { equals: "PUBLIC" as const };
}

// GET /project/:projectId — list documents (role-filtered)
documentsRouter.get("/project/:projectId", asyncHandler(async (req, res) => {
  const role = getRole(req);
  const visFilter = visibilityFilter(role);
  const { epochId, status } = req.query;

  const where: Record<string, unknown> = { projectId: req.params.projectId };
  if (visFilter) where.visibility = visFilter;
  if (epochId) where.epochId = epochId as string;
  if (status) where.status = status as string;

  const docs = await prisma.document.findMany({
    where,
    include: {
      versions: { orderBy: { version: "desc" }, take: 1, select: { version: true, createdAt: true, changelog: true } },
      taskRefs: { include: { task: { select: { id: true, title: true, status: true } } } },
      meetings: { include: { meeting: { select: { id: true, title: true, status: true, scheduledAt: true } } } },
      epoch: { select: { id: true, title: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  res.json(docs);
}));

// POST / — create document (saves initial version automatically)
documentsRouter.post("/", asyncHandler(async (req, res) => {
  const { title, content, projectId, epochId, visibility, status } = req.body;
  if (!title || !projectId) {
    res.status(400).json({ error: "title and projectId are required" });
    return;
  }

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) { res.status(404).json({ error: "Project not found" }); return; }

  const userId = getUserId(req);
  const docContent = content || { type: "doc", content: [] };

  const doc = await prisma.document.create({
    data: {
      title,
      content: docContent,
      projectId,
      epochId: epochId || null,
      visibility: visibility || "PUBLIC",
      status: status || "DRAFT",
      createdBy: userId,
      updatedBy: userId,
      versions: {
        create: {
          version: 1,
          title,
          content: docContent,
          changelog: "Initial version",
          createdBy: userId,
        },
      },
    },
    include: {
      versions: { orderBy: { version: "desc" }, take: 1 },
      epoch: { select: { id: true, title: true } },
    },
  });

  res.status(201).json(doc);
}));

// GET /:id — get document (with versions, task refs, meetings)
documentsRouter.get("/:id", asyncHandler(async (req, res) => {
  const role = getRole(req);
  const doc = await prisma.document.findUnique({
    where: { id: req.params.id },
    include: {
      versions: { orderBy: { version: "desc" } },
      taskRefs: {
        include: { task: { select: { id: true, title: true, status: true, priority: true, assigneeId: true } } },
      },
      meetings: {
        include: {
          meeting: {
            select: { id: true, title: true, status: true, scheduledAt: true, summary: true },
          },
        },
      },
      epoch: { select: { id: true, title: true } },
    },
  });

  if (!doc) { res.status(404).json({ error: "Document not found" }); return; }

  // Check visibility
  if (role === "CLIENT" && doc.visibility !== "PUBLIC") {
    res.status(403).json({ error: "Access denied" }); return;
  }
  if (role === "DEVELOPER" && doc.visibility === "MANAGERS_ONLY") {
    res.status(403).json({ error: "Access denied" }); return;
  }

  res.json(doc);
}));

// PATCH /:id — update document content (creates a new version)
documentsRouter.patch("/:id", asyncHandler(async (req, res) => {
  const { title, content, status, visibility, epochId, changelog, meetingId } = req.body;
  const userId = getUserId(req);

  const existing = await prisma.document.findUnique({
    where: { id: req.params.id },
    include: { versions: { orderBy: { version: "desc" }, take: 1 } },
  });
  if (!existing) { res.status(404).json({ error: "Document not found" }); return; }

  const data: Record<string, unknown> = { updatedBy: userId };
  if (title !== undefined) data.title = title;
  if (status !== undefined) data.status = status;
  if (visibility !== undefined) data.visibility = visibility;
  if (epochId !== undefined) data.epochId = epochId;

  // If content changed — save a new version
  let newVersionNumber = existing.versions[0]?.version || 0;
  if (content !== undefined) {
    data.content = content;
    newVersionNumber = newVersionNumber + 1;
    await prisma.documentVersion.create({
      data: {
        documentId: existing.id,
        version: newVersionNumber,
        title: title ?? existing.title,
        content,
        changelog: changelog || null,
        createdBy: userId,
        meetingId: meetingId || null,
      },
    });
  }

  const doc = await prisma.document.update({
    where: { id: req.params.id },
    data,
    include: {
      versions: { orderBy: { version: "desc" }, take: 3 },
      taskRefs: { include: { task: { select: { id: true, title: true, status: true } } } },
      epoch: { select: { id: true, title: true } },
    },
  });

  // Notify linked task watchers if status = PENDING_REVIEW
  if (status === "PENDING_REVIEW") {
    for (const ref of doc.taskRefs) {
      if (ref.task.assigneeId) {
        publishNotification(req.app, {
          userId: ref.task.assigneeId,
          type: "DOCUMENT_REVIEW_REQUESTED",
          title: "Документ требует проверки",
          body: `Документ «${doc.title}» отправлен на проверку (задача «${ref.task.title}»)`,
          link: `/docs/${doc.id}`,
          priority: "HIGH",
        });
      }
    }
  }

  res.json({ ...doc, currentVersion: newVersionNumber });
}));

// DELETE /:id
documentsRouter.delete("/:id", asyncHandler(async (req, res) => {
  const existing = await prisma.document.findUnique({ where: { id: req.params.id } });
  if (!existing) { res.status(404).json({ error: "Document not found" }); return; }
  await prisma.document.delete({ where: { id: req.params.id } });
  res.status(204).send();
}));

// GET /:id/versions — version history
documentsRouter.get("/:id/versions", asyncHandler(async (req, res) => {
  const versions = await prisma.documentVersion.findMany({
    where: { documentId: req.params.id },
    orderBy: { version: "desc" },
  });
  res.json(versions);
}));

// GET /:id/versions/:version — get specific version content
documentsRouter.get("/:id/versions/:version", asyncHandler(async (req, res) => {
  const version = await prisma.documentVersion.findUnique({
    where: {
      documentId_version: {
        documentId: req.params.id,
        version: parseInt(req.params.version, 10),
      },
    },
  });
  if (!version) { res.status(404).json({ error: "Version not found" }); return; }
  res.json(version);
}));

// POST /:id/task-refs — link a task to document (with optional quote for inline citation)
documentsRouter.post("/:id/task-refs", asyncHandler(async (req, res) => {
  const { taskId, quote } = req.body;
  if (!taskId) { res.status(400).json({ error: "taskId is required" }); return; }

  const [doc, task] = await Promise.all([
    prisma.document.findUnique({ where: { id: req.params.id } }),
    prisma.task.findUnique({ where: { id: taskId } }),
  ]);
  if (!doc) { res.status(404).json({ error: "Document not found" }); return; }
  if (!task) { res.status(404).json({ error: "Task not found" }); return; }

  const ref = await prisma.taskDocumentRef.upsert({
    where: { taskId_documentId: { taskId, documentId: req.params.id } },
    create: { taskId, documentId: req.params.id, quote: quote || null, createdBy: getUserId(req) },
    update: { quote: quote || null },
    include: { task: { select: { id: true, title: true, status: true } } },
  });

  // Notify task assignee about new document link
  if (task.assigneeId) {
    publishNotification(req.app, {
      userId: task.assigneeId,
      type: "DOCUMENT_LINKED",
      title: "Документ привязан к задаче",
      body: `Документ «${doc.title}» привязан к задаче «${task.title}»`,
      link: `/docs/${doc.id}`,
    });
  }

  res.status(201).json(ref);
}));

// DELETE /:id/task-refs/:taskId — unlink task from document
documentsRouter.delete("/:id/task-refs/:taskId", asyncHandler(async (req, res) => {
  const ref = await prisma.taskDocumentRef.findUnique({
    where: { taskId_documentId: { taskId: req.params.taskId, documentId: req.params.id } },
  });
  if (!ref) { res.status(404).json({ error: "Reference not found" }); return; }
  await prisma.taskDocumentRef.delete({
    where: { taskId_documentId: { taskId: req.params.taskId, documentId: req.params.id } },
  });
  res.status(204).send();
}));

// POST /:id/approve — approve document (MANAGER only)
documentsRouter.post("/:id/approve", asyncHandler(async (req, res) => {
  const role = getRole(req);
  if (role !== "MANAGER") { res.status(403).json({ error: "Only managers can approve documents" }); return; }

  const doc = await prisma.document.update({
    where: { id: req.params.id },
    data: { status: "APPROVED", updatedBy: getUserId(req) },
  });
  res.json(doc);
}));
