import express from "express";
import cors from "cors";
import Redis from "ioredis";
import prisma from "./prisma";
import { projectsRouter } from "./routes/projects";
import { tasksRouter } from "./routes/tasks";
import { commentsRouter } from './routes/comments';
import { timeEntriesRouter } from './routes/time-entries';
import { approvalsRouter } from './routes/approvals';
import { invoicesRouter } from './routes/invoices';
import { activityRouter } from './routes/activity';
import { webhooksRouter } from './routes/webhooks';
import { auditRouter } from './routes/audit';
import { boardsRouter } from './routes/boards';
import { epochsRouter } from './routes/epochs';
import { documentsRouter } from './routes/documents';
import { meetingsRouter } from './routes/meetings';
import { releasesRouter } from './routes/releases';
import { authMiddleware } from './middleware/auth';

const app = express();
const PORT = process.env.PORT || 3002;

// Redis for notifications
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const redisPublisher = new Redis(redisUrl);
redisPublisher.on('error', (err) => console.warn('Redis error:', err.message));
app.set('redis', redisPublisher);

// Helper to publish notification
export function publishNotification(app: express.Application, data: {
  userId: string;
  type: string;
  title: string;
  body: string;
  link?: string;
  priority?: string;
}) {
  try {
    const redis = app.get('redis') as Redis;
    if (redis) redis.publish('notifications', JSON.stringify(data));
  } catch {}
}

app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} ${res.statusCode} ${Date.now() - start}ms`);
  });
  next();
});

// JWT auth middleware for all routes except health
app.use((req, res, next) => {
  if (req.path === '/health') return next();
  authMiddleware(req as any, res, next);
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "projects-service" });
});

app.use("/projects", projectsRouter);
app.use("/tasks", tasksRouter);
app.use("/comments", commentsRouter);
app.use("/time-entries", timeEntriesRouter);
app.use("/approvals", approvalsRouter);
app.use("/invoices", invoicesRouter);
app.use("/activity", activityRouter);
app.use("/webhooks", webhooksRouter);
app.use("/audit", auditRouter);
app.use("/boards", boardsRouter);
app.use("/epochs", epochsRouter);
app.use("/documents", documentsRouter);
app.use("/meetings", meetingsRouter);
app.use("/releases", releasesRouter);

// CI/CD webhook: GitLab/GitHub PR status → task status sync
app.post("/cicd/webhook", async (req, res) => {
  try {
    const event = req.headers['x-gitlab-event'] || req.headers['x-github-event'];
    const body = req.body;

    // Extract PR number from branch name or body
    let prNumber: string | undefined;
    let prStatus: string | undefined;
    let branchName: string | undefined;
    let gitTag: string | undefined;

    if (body.object_kind === 'merge_request' || event === 'merge_request') {
      // GitLab MR
      prNumber = String(body.object_attributes?.iid || body.object_attributes?.id || '');
      const mrState = body.object_attributes?.state;
      const mrAction = body.object_attributes?.action;
      branchName = body.object_attributes?.source_branch;
      if (mrState === 'merged') prStatus = 'MERGED';
      else if (mrAction === 'open' || mrAction === 'reopen') prStatus = 'OPEN';
      else if (mrAction === 'close') prStatus = 'CLOSED';
      else prStatus = mrAction?.toUpperCase() || mrState?.toUpperCase();
    } else if (event === 'pull_request') {
      // GitHub PR
      prNumber = String(body.pull_request?.number || '');
      const prAction = body.action;
      branchName = body.pull_request?.head?.ref;
      if (prAction === 'closed' && body.pull_request?.merged) prStatus = 'MERGED';
      else if (prAction === 'opened' || prAction === 'reopened') prStatus = 'OPEN';
      else if (prAction === 'closed') prStatus = 'CLOSED';
      else prStatus = prAction?.toUpperCase();
    } else if (body.object_kind === 'tag_push' || (event === 'push' && body.ref?.startsWith('refs/tags/'))) {
      // Tag push → find release
      gitTag = body.ref?.replace('refs/tags/', '');
    }

    if (gitTag) {
      // Update release by git tag
      const release = await prisma.release.findFirst({ where: { gitTag } });
      if (release) {
        await prisma.release.update({ where: { id: release.id }, data: { status: 'PUBLISHED', releasedAt: new Date() } });
      }
      res.json({ ok: true, entity: 'release', gitTag });
      return;
    }

    if (!prNumber) { res.json({ ok: true, skipped: true }); return; }

    // Find tasks by prNumber or branch name containing task reference (e.g. "feat/TASK-abc123")
    const tasksToUpdate: any[] = [];

    const byPrNumber = await prisma.task.findMany({ where: { prNumber } });
    tasksToUpdate.push(...byPrNumber);

    if (branchName && tasksToUpdate.length === 0) {
      const byBranch = await prisma.task.findMany({ where: { gitBranch: branchName } });
      tasksToUpdate.push(...byBranch);
    }

    // Map PR status to task status
    const taskStatusMap: Record<string, string> = {
      OPEN: 'REVIEW',
      MERGED: 'DONE',
      CLOSED: 'TODO',
    };
    const newTaskStatus = prStatus ? taskStatusMap[prStatus] : undefined;

    for (const task of tasksToUpdate) {
      await prisma.task.update({
        where: { id: task.id },
        data: {
          prStatus,
          ...(newTaskStatus ? { status: newTaskStatus as any } : {}),
        },
      });

      // Notify assignee
      if (task.assigneeId && prStatus) {
        const redis = req.app.get('redis');
        if (redis) {
          redis.publish('notifications', JSON.stringify({
            userId: task.assigneeId,
            type: 'TASK_STATUS_CHANGED',
            title: 'Статус PR обновлён',
            body: `PR #${prNumber} → ${prStatus}. Задача «${task.title}» обновлена`,
            link: `/projects/${task.projectId}`,
          }));
        }
      }
    }

    res.json({ ok: true, updatedTasks: tasksToUpdate.length, prStatus, prNumber });
  } catch (err: any) {
    console.error('[CI/CD webhook]', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Error handler - add after all routes
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(`[ERROR] ${req.method} ${req.path}:`, err.message);

  if (err.name === 'ZodError') {
    return res.status(400).json({ error: 'Validation error', details: err.errors });
  }

  if (err.name === 'PrismaClientKnownRequestError') {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'Resource already exists' });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Resource not found' });
    }
  }

  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Projects service running on port ${PORT}`);
});

export default app;
