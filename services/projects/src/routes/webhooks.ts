import { Router, Response, NextFunction } from 'express';
import prisma from '../prisma';
import { AuthRequest } from '../middleware/auth';
import { z } from 'zod';
import crypto from 'crypto';

export const webhooksRouter = Router();

const asyncHandler = (fn: (req: any, res: Response, next: NextFunction) => Promise<void>) => {
  return (req: any, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

const VALID_EVENTS = [
  'task.created', 'task.status_changed', 'task.completed',
  'comment.created', 'approval.requested', 'approval.reviewed',
  'invoice.created', 'project.updated',
];

const createWebhookSchema = z.object({
  url: z.string().url('Must be a valid URL'),
  projectId: z.string().uuid().optional(),
  events: z.array(z.enum(VALID_EVENTS as [string, ...string[]])).min(1, 'At least one event required'),
});

// GET /webhooks — list user's webhooks
webhooksRouter.get('/', asyncHandler(async (req: AuthRequest, res: Response) => {
  const webhooks = await prisma.webhook.findMany({
    where: { userId: req.user!.userId },
    orderBy: { createdAt: 'desc' },
  });
  // Don't expose secrets
  res.json(webhooks.map(w => ({ ...w, secret: w.secret.slice(0, 8) + '...' })));
}));

// POST /webhooks — create webhook
webhooksRouter.post('/', asyncHandler(async (req: AuthRequest, res: Response) => {
  const parsed = createWebhookSchema.parse(req.body);
  const secret = 'whsec_' + crypto.randomBytes(24).toString('hex');

  const webhook = await prisma.webhook.create({
    data: {
      userId: req.user!.userId,
      url: parsed.url,
      projectId: parsed.projectId,
      events: parsed.events,
      secret,
    },
  });

  // Return full secret only on creation
  res.status(201).json(webhook);
}));

// PATCH /webhooks/:id — update webhook
webhooksRouter.patch('/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const webhook = await prisma.webhook.findUnique({ where: { id: req.params.id } });
  if (!webhook) { res.status(404).json({ error: 'Webhook not found' }); return; }
  if (webhook.userId !== req.user!.userId) { res.status(403).json({ error: 'Forbidden' }); return; }

  const { url, events, active } = req.body;
  const data: any = {};
  if (url) data.url = url;
  if (events) data.events = events;
  if (active !== undefined) data.active = active;

  const updated = await prisma.webhook.update({
    where: { id: req.params.id },
    data,
  });
  res.json({ ...updated, secret: updated.secret.slice(0, 8) + '...' });
}));

// DELETE /webhooks/:id — delete webhook
webhooksRouter.delete('/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const webhook = await prisma.webhook.findUnique({ where: { id: req.params.id } });
  if (!webhook) { res.status(404).json({ error: 'Webhook not found' }); return; }
  if (webhook.userId !== req.user!.userId) { res.status(403).json({ error: 'Forbidden' }); return; }
  await prisma.webhook.delete({ where: { id: req.params.id } });
  res.status(204).send();
}));

// POST /webhooks/test/:id — send test event
webhooksRouter.post('/test/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const webhook = await prisma.webhook.findUnique({ where: { id: req.params.id } });
  if (!webhook) { res.status(404).json({ error: 'Webhook not found' }); return; }
  if (webhook.userId !== req.user!.userId) { res.status(403).json({ error: 'Forbidden' }); return; }

  const payload = {
    event: 'test',
    timestamp: new Date().toISOString(),
    data: { message: 'This is a test webhook event from Envelope platform' },
  };

  try {
    const result = await triggerWebhook(webhook, payload);
    res.json({ success: true, statusCode: result.status });
  } catch (err: any) {
    res.json({ success: false, error: err.message });
  }
}));

// Helper: trigger a webhook with HMAC signature
export async function triggerWebhook(webhook: any, payload: any): Promise<globalThis.Response> {
  const body = JSON.stringify(payload);
  const signature = crypto.createHmac('sha256', webhook.secret).update(body).digest('hex');

  const response = await fetch(webhook.url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Envelope-Signature': `sha256=${signature}`,
      'X-Envelope-Event': payload.event,
      'X-Envelope-Delivery': crypto.randomUUID(),
    },
    body,
    signal: AbortSignal.timeout(10000),
  });

  // Update webhook status
  await prisma.webhook.update({
    where: { id: webhook.id },
    data: {
      lastTriggeredAt: new Date(),
      lastError: response.ok ? null : `HTTP ${response.status}`,
    },
  }).catch(() => {});

  return response;
}

// Helper: dispatch event to all matching webhooks
export async function dispatchWebhookEvent(event: string, projectId: string | null, payload: any) {
  try {
    const where: any = { active: true, events: { has: event } };
    if (projectId) {
      where.OR = [
        { projectId },
        { projectId: null },
      ];
    }

    const webhooks = await prisma.webhook.findMany({ where });

    const fullPayload = {
      event,
      timestamp: new Date().toISOString(),
      data: payload,
    };

    // Fire and forget
    for (const webhook of webhooks) {
      triggerWebhook(webhook, fullPayload).catch((err) => {
        prisma.webhook.update({
          where: { id: webhook.id },
          data: { lastError: err.message, lastTriggeredAt: new Date() },
        }).catch(() => {});
      });
    }
  } catch (err) {
    console.error('Webhook dispatch error:', err);
  }
}
