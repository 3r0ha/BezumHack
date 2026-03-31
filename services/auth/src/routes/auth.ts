import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma';
import { generateToken } from '../lib/jwt';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { registerSchema, loginSchema, updateUserSchema } from '../validators';

const router = Router();

// Async handler wrapper to catch errors and forward to error middleware
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// POST /register
router.post('/register', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const parsed = registerSchema.parse(req.body);
  const { email, password, name, role } = parsed;

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    res.status(409).json({ error: 'User with this email already exists' });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name,
      role: role || 'CLIENT',
    },
  });

  const token = generateToken(user.id);

  res.status(201).json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
  });
}));

// POST /login
router.post('/login', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const parsed = loginSchema.parse(req.body);
  const { email, password } = parsed;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  const isValidPassword = await bcrypt.compare(password, user.passwordHash);
  if (!isValidPassword) {
    res.status(401).json({ error: 'Invalid email or password' });
    return;
  }

  const token = generateToken(user.id);

  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
  });
}));

// GET /me
router.get('/me', authMiddleware, asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  res.json({ user: req.user });
}));

// GET /users — list users (for inter-service user lookups, with optional role filter)
router.get('/users', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { role } = req.query;

  const where: Record<string, unknown> = {};
  if (role && typeof role === 'string') {
    const validRoles = ['CLIENT', 'DEVELOPER', 'MANAGER'];
    if (validRoles.includes(role)) {
      where.role = role;
    }
  }

  const users = await prisma.user.findMany({
    where,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json({ users });
}));

// GET /users/:id (for inter-service calls)
router.get('/users/:id', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const user = await prisma.user.findUnique({
    where: { id: req.params.id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  res.json({ user });
}));

// PATCH /users/:id — update user profile (name, email)
router.patch('/users/:id', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const parsed = updateUserSchema.parse(req.body);

  const existing = await prisma.user.findUnique({
    where: { id: req.params.id },
  });

  if (!existing) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  const data: Record<string, unknown> = {};
  if (parsed.name !== undefined) data.name = parsed.name;
  if (parsed.email !== undefined) data.email = parsed.email;

  const user = await prisma.user.update({
    where: { id: req.params.id },
    data,
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  res.json({ user });
}));

export default router;
