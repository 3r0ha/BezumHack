import { Router, Response, NextFunction } from 'express';
import prisma from '../prisma';
import { AuthRequest } from '../middleware/auth';
import { z } from 'zod';

export const boardsRouter = Router();

const asyncHandler = (fn: (req: any, res: Response, next: NextFunction) => Promise<void>) => {
  return (req: any, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

const createBoardSchema = z.object({
  title: z.string().min(1),
  projectId: z.string().uuid().optional(),
  isPublic: z.boolean().optional(),
});

const createElementSchema = z.object({
  type: z.string().min(1),
  x: z.number().optional(),
  y: z.number().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  rotation: z.number().optional(),
  content: z.string().optional(),
  color: z.string().optional(),
  fontSize: z.number().optional(),
  properties: z.any().optional(),
  zIndex: z.number().optional(),
});

// GET /boards — list boards
boardsRouter.get('/', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { projectId } = req.query;
  const where: any = {};
  if (projectId) where.projectId = projectId;

  const boards = await prisma.board.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    include: { _count: { select: { elements: true } } },
  });
  res.json(boards);
}));

// POST /boards — create board
boardsRouter.post('/', asyncHandler(async (req: AuthRequest, res: Response) => {
  const parsed = createBoardSchema.parse(req.body);
  const board = await prisma.board.create({
    data: {
      title: parsed.title,
      projectId: parsed.projectId || null,
      isPublic: parsed.isPublic || false,
      createdBy: req.user!.userId,
    },
  });
  res.status(201).json(board);
}));

// GET /boards/:id — get board with all elements
boardsRouter.get('/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const board = await prisma.board.findUnique({
    where: { id: req.params.id },
    include: {
      elements: { orderBy: { zIndex: 'asc' } },
    },
  });
  if (!board) { res.status(404).json({ error: 'Board not found' }); return; }
  res.json(board);
}));

// PATCH /boards/:id — update board
boardsRouter.patch('/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const { title, isPublic } = req.body;
  const data: any = {};
  if (title !== undefined) data.title = title;
  if (isPublic !== undefined) data.isPublic = isPublic;

  const board = await prisma.board.update({
    where: { id: req.params.id },
    data,
  });
  res.json(board);
}));

// DELETE /boards/:id — delete board
boardsRouter.delete('/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  await prisma.board.delete({ where: { id: req.params.id } });
  res.status(204).send();
}));

// POST /boards/:id/elements — create element
boardsRouter.post('/:id/elements', asyncHandler(async (req: AuthRequest, res: Response) => {
  const parsed = createElementSchema.parse(req.body);
  const element = await prisma.boardElement.create({
    data: {
      boardId: req.params.id,
      ...parsed,
      createdBy: req.user!.userId,
    },
  });
  res.status(201).json(element);
}));

// PATCH /boards/:boardId/elements/:id — update element
boardsRouter.patch('/:boardId/elements/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  const data: any = {};
  const fields = ['x', 'y', 'width', 'height', 'rotation', 'content', 'color', 'fontSize', 'properties', 'zIndex', 'type'];
  for (const f of fields) {
    if (req.body[f] !== undefined) data[f] = req.body[f];
  }

  const element = await prisma.boardElement.update({
    where: { id: req.params.id },
    data,
  });
  res.json(element);
}));

// DELETE /boards/:boardId/elements/:id — delete element
boardsRouter.delete('/:boardId/elements/:id', asyncHandler(async (req: AuthRequest, res: Response) => {
  await prisma.boardElement.delete({ where: { id: req.params.id } });
  res.status(204).send();
}));
