import { Router, Response, NextFunction } from 'express';
import prisma from '../prisma';
import { AuthRequest } from '../middleware/auth';
import { publishNotification } from '../index';
import { dispatchWebhookEvent } from './webhooks';
import { logAudit } from './audit';
import { z } from 'zod';

export const approvalsRouter = Router();

const asyncHandler = (fn: (req: any, res: Response, next: NextFunction) => Promise<void>) => {
  return (req: any, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

const createApprovalSchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().optional(),
});

const reviewApprovalSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  reviewComment: z.string().optional(),
});

// GET /approvals/project/:projectId
approvalsRouter.get('/project/:projectId', asyncHandler(async (req: AuthRequest, res: Response) => {
  const approvals = await prisma.approval.findMany({
    where: { projectId: req.params.projectId },
    orderBy: { createdAt: 'desc' },
  });
  res.json(approvals);
}));

// POST /approvals
approvalsRouter.post('/', asyncHandler(async (req: AuthRequest, res: Response) => {
  const parsed = createApprovalSchema.parse(req.body);
  const approval = await prisma.approval.create({
    data: {
      ...parsed,
      requestedBy: req.user!.userId,
    },
  });

  // Notify project manager/client about new approval request
  const project = await prisma.project.findUnique({ where: { id: parsed.projectId } });
  if (project?.clientId) {
    publishNotification(req.app, {
      userId: project.clientId,
      type: 'APPROVAL_REQUESTED',
      title: 'Запрос на согласование',
      body: `Новый запрос: "${approval.title}"`,
      link: `/approvals`,
      priority: 'HIGH',
    });
  }

  dispatchWebhookEvent('approval.requested', approval.projectId, { approval: { id: approval.id, title: approval.title } });

  logAudit({ userId: req.user!.userId, action: 'approval.created', entityType: 'approval', entityId: approval.id, details: { title: approval.title, projectId: approval.projectId } });

  res.status(201).json(approval);
}));

// PATCH /approvals/:id/review — approve or reject
approvalsRouter.patch('/:id/review', asyncHandler(async (req: AuthRequest, res: Response) => {
  const parsed = reviewApprovalSchema.parse(req.body);
  const existing = await prisma.approval.findUnique({ where: { id: req.params.id } });
  if (!existing) { res.status(404).json({ error: 'Approval not found' }); return; }
  if (existing.status !== 'PENDING') { res.status(400).json({ error: 'Already reviewed' }); return; }

  const approval = await prisma.approval.update({
    where: { id: req.params.id },
    data: {
      status: parsed.status,
      reviewedBy: req.user!.userId,
      reviewComment: parsed.reviewComment,
      reviewedAt: new Date(),
    },
  });

  // Notify the requester about review result
  publishNotification(req.app, {
    userId: existing.requestedBy,
    type: 'APPROVAL_REVIEWED',
    title: parsed.status === 'APPROVED' ? 'Согласование одобрено' : 'Согласование отклонено',
    body: `"${existing.title}" — ${parsed.status === 'APPROVED' ? 'одобрено' : 'отклонено'}${parsed.reviewComment ? ': ' + parsed.reviewComment : ''}`,
    link: `/approvals`,
    priority: parsed.status === 'REJECTED' ? 'HIGH' : 'MEDIUM',
  });

  dispatchWebhookEvent('approval.reviewed', approval.projectId, { approval: { id: approval.id, title: existing.title, status: parsed.status } });

  logAudit({ userId: req.user!.userId, action: 'approval.reviewed', entityType: 'approval', entityId: approval.id, details: { title: existing.title, status: parsed.status, reviewComment: parsed.reviewComment } });

  res.json(approval);
}));
