import { Router, Response, NextFunction } from 'express';
import prisma from '../prisma';
import { AuthRequest } from '../middleware/auth';
import { z } from 'zod';

export const invoicesRouter = Router();

const asyncHandler = (fn: (req: any, res: Response, next: NextFunction) => Promise<void>) => {
  return (req: any, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

const createInvoiceSchema = z.object({
  projectId: z.string().uuid(),
  items: z.array(z.object({
    description: z.string(),
    hours: z.number().min(0),
    rate: z.number().min(0),
    taskId: z.string().uuid().optional(),
  })).min(1),
});

// GET /invoices/project/:projectId
invoicesRouter.get('/project/:projectId', asyncHandler(async (req: AuthRequest, res: Response) => {
  const invoices = await prisma.invoice.findMany({
    where: { projectId: req.params.projectId },
    include: { items: true },
    orderBy: { createdAt: 'desc' },
  });
  res.json(invoices);
}));

// POST /invoices — create invoice
invoicesRouter.post('/', asyncHandler(async (req: AuthRequest, res: Response) => {
  const parsed = createInvoiceSchema.parse(req.body);
  const items = parsed.items.map(item => ({
    ...item,
    amount: item.hours * item.rate,
  }));
  const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);

  // Generate invoice number: INV-YYYYMM-XXXX
  const count = await prisma.invoice.count();
  const now = new Date();
  const number = `INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-${String(count + 1).padStart(4, '0')}`;

  const invoice = await prisma.invoice.create({
    data: {
      projectId: parsed.projectId,
      number,
      totalAmount,
      items: { create: items },
    },
    include: { items: true },
  });
  res.status(201).json(invoice);
}));

// POST /invoices/generate/:projectId — auto-generate from time entries
invoicesRouter.post('/generate/:projectId', asyncHandler(async (req: AuthRequest, res: Response) => {
  const project = await prisma.project.findUnique({ where: { id: req.params.projectId } });
  if (!project) { res.status(404).json({ error: 'Project not found' }); return; }

  const rate = project.hourlyRate || 0;

  // Get all tasks with tracked time that haven't been invoiced
  const tasks = await prisma.task.findMany({
    where: { projectId: req.params.projectId, actualHours: { gt: 0 } },
    select: { id: true, title: true, actualHours: true },
  });

  if (tasks.length === 0) { res.status(400).json({ error: 'No billable time entries found' }); return; }

  const items = tasks.map(task => ({
    description: task.title,
    hours: task.actualHours || 0,
    rate,
    amount: (task.actualHours || 0) * rate,
    taskId: task.id,
  }));

  const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);
  const count = await prisma.invoice.count();
  const now = new Date();
  const number = `INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-${String(count + 1).padStart(4, '0')}`;

  const invoice = await prisma.invoice.create({
    data: {
      projectId: req.params.projectId,
      number,
      totalAmount,
      items: { create: items },
    },
    include: { items: true },
  });
  res.status(201).json(invoice);
}));

// PATCH /invoices/:id/status — update invoice status
invoicesRouter.patch('/:id/status', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { status } = z.object({ status: z.enum(['ISSUED', 'PAID', 'OVERDUE', 'CANCELLED']) }).parse(req.body);

  const invoice = await prisma.invoice.findUnique({ where: { id: req.params.id } });
  if (!invoice) { res.status(404).json({ error: 'Invoice not found' }); return; }

  const data: Record<string, unknown> = { status };
  if (status === 'ISSUED') data.issuedAt = new Date();
  if (status === 'PAID') data.paidAt = new Date();

  const updated = await prisma.invoice.update({
    where: { id: req.params.id },
    data,
    include: { items: true },
  });
  res.json(updated);
}));

// DELETE /invoices/:id
invoicesRouter.delete('/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const invoice = await prisma.invoice.findUnique({ where: { id: req.params.id } });
  if (!invoice) { res.status(404).json({ error: 'Invoice not found' }); return; }
  if (invoice.status !== 'DRAFT') { res.status(400).json({ error: 'Only draft invoices can be deleted' }); return; }
  await prisma.invoice.delete({ where: { id: req.params.id } });
  res.status(204).send();
}));
