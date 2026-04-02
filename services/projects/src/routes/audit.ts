import { Router, Response, NextFunction } from 'express';
import prisma from '../prisma';
import { AuthRequest } from '../middleware/auth';

export const auditRouter = Router();

const asyncHandler = (fn: (req: any, res: Response, next: NextFunction) => Promise<void>) => {
  return (req: any, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Helper to log audit events (call from other routes)
export async function logAudit(data: {
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  details?: any;
  ipAddress?: string;
}) {
  try {
    await prisma.auditLog.create({ data });
  } catch (err) {
    console.error('Audit log error:', err);
  }
}

// GET /audit — list audit logs (with filters)
auditRouter.get('/', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { entityType, entityId, userId, limit, offset } = req.query;

  const where: any = {};
  if (entityType) where.entityType = entityType;
  if (entityId) where.entityId = entityId;
  if (userId) where.userId = userId;

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string) || 50,
      skip: parseInt(offset as string) || 0,
    }),
    prisma.auditLog.count({ where }),
  ]);

  res.json({ logs, total });
}));

// GET /audit/entity/:type/:id — audit log for specific entity
auditRouter.get('/entity/:type/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const logs = await prisma.auditLog.findMany({
    where: {
      entityType: req.params.type,
      entityId: req.params.id,
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  res.json(logs);
}));
