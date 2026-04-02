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
      telegramChatId: true,
      telegramEnabled: true,
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

// GET /validate-key — validate API key (for inter-service calls)
router.get('/validate-key', asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const apiKey = req.headers['x-api-key'] as string;
  if (!apiKey) { res.status(401).json({ error: 'API key required' }); return; }

  const crypto = await import('crypto');
  const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
  const key = await prisma.apiKey.findUnique({ where: { keyHash } });

  if (!key) { res.status(401).json({ error: 'Invalid API key' }); return; }
  if (key.expiresAt && key.expiresAt < new Date()) { res.status(401).json({ error: 'Expired' }); return; }

  const user = await prisma.user.findUnique({
    where: { id: key.userId },
    select: { id: true, email: true, name: true, role: true },
  });

  if (!user) { res.status(401).json({ error: 'User not found' }); return; }

  prisma.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } }).catch(() => {});

  res.json({ user });
}));

// POST /api-keys — create API key
router.post('/api-keys', authMiddleware, asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { name, expiresIn } = req.body;
  if (!name || typeof name !== 'string' || name.length < 1) {
    res.status(400).json({ error: 'Name is required' });
    return;
  }

  // Generate random key: sk_live_<32 hex chars>
  const crypto = await import('crypto');
  const rawKey = 'sk_live_' + crypto.randomBytes(32).toString('hex');
  const prefix = rawKey.slice(0, 12) + '...';
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

  const expiresAt = expiresIn ? new Date(Date.now() + expiresIn * 24 * 60 * 60 * 1000) : null;

  const apiKey = await prisma.apiKey.create({
    data: {
      userId: req.user!.id,
      name,
      keyHash,
      prefix,
      expiresAt,
    },
  });

  // Return the raw key ONLY on creation (never stored, only hash)
  res.status(201).json({
    id: apiKey.id,
    name: apiKey.name,
    key: rawKey,
    prefix: apiKey.prefix,
    expiresAt: apiKey.expiresAt,
    createdAt: apiKey.createdAt,
  });
}));

// GET /api-keys — list user's API keys
router.get('/api-keys', authMiddleware, asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const keys = await prisma.apiKey.findMany({
    where: { userId: req.user!.id },
    select: {
      id: true,
      name: true,
      prefix: true,
      lastUsedAt: true,
      expiresAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ keys });
}));

// DELETE /api-keys/:id — revoke API key
router.delete('/api-keys/:id', authMiddleware, asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const key = await prisma.apiKey.findUnique({ where: { id: req.params.id } });
  if (!key) { res.status(404).json({ error: 'API key not found' }); return; }
  if (key.userId !== req.user!.id) { res.status(403).json({ error: 'Not your key' }); return; }
  await prisma.apiKey.delete({ where: { id: req.params.id } });
  res.status(204).send();
}));

// POST /invite — manager creates an account for someone
router.post('/invite', authMiddleware, asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  // Only managers can invite
  if (req.user!.role !== 'MANAGER') {
    res.status(403).json({ error: 'Only managers can invite users' });
    return;
  }

  const { email, name, role, password } = req.body;
  if (!email || !name || !role) {
    res.status(400).json({ error: 'email, name, and role are required' });
    return;
  }

  const validRoles = ['CLIENT', 'DEVELOPER', 'MANAGER'];
  if (!validRoles.includes(role)) {
    res.status(400).json({ error: 'Invalid role' });
    return;
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    res.status(409).json({ error: 'User with this email already exists' });
    return;
  }

  // Generate password or use provided
  const userPassword = password || Math.random().toString(36).slice(-8);
  const passwordHash = await bcrypt.hash(userPassword, 10);

  const user = await prisma.user.create({
    data: { email, name, role, passwordHash },
  });

  res.status(201).json({
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
    tempPassword: userPassword,
  });
}));

// PATCH /users/:id/role — manager changes user role
router.patch('/users/:id/role', authMiddleware, asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  if (req.user!.role !== 'MANAGER') {
    res.status(403).json({ error: 'Only managers can change roles' });
    return;
  }
  const { role } = req.body;
  if (!role || !['CLIENT', 'DEVELOPER', 'MANAGER'].includes(role)) {
    res.status(400).json({ error: 'Invalid role' });
    return;
  }
  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: { role },
    select: { id: true, email: true, name: true, role: true },
  });
  res.json({ user });
}));

// DELETE /users/:id — manager deletes user
router.delete('/users/:id', authMiddleware, asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  if (req.user!.role !== 'MANAGER') {
    res.status(403).json({ error: 'Only managers can delete users' });
    return;
  }
  if (req.params.id === req.user!.id) {
    res.status(400).json({ error: 'Cannot delete yourself' });
    return;
  }
  await prisma.user.delete({ where: { id: req.params.id } });
  res.status(204).send();
}));

// POST /change-password
router.post('/change-password', authMiddleware, asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: 'Current and new password required' });
    return;
  }
  if (newPassword.length < 6) {
    res.status(400).json({ error: 'New password must be at least 6 characters' });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user) { res.status(404).json({ error: 'User not found' }); return; }

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    res.status(400).json({ error: 'Current password is incorrect' });
    return;
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

  res.json({ message: 'Password changed successfully' });
}));

// POST /telegram/link — link Telegram chat ID
router.post('/telegram/link', authMiddleware, asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { chatId } = req.body;
  if (!chatId) { res.status(400).json({ error: 'chatId required' }); return; }

  await prisma.user.update({
    where: { id: req.user!.id },
    data: { telegramChatId: String(chatId), telegramEnabled: true },
  });
  res.json({ success: true });
}));

// POST /telegram/unlink — unlink Telegram
router.post('/telegram/unlink', authMiddleware, asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  await prisma.user.update({
    where: { id: req.user!.id },
    data: { telegramChatId: null, telegramEnabled: false },
  });
  res.json({ success: true });
}));

// GET /telegram/status — check if linked
router.get('/telegram/status', authMiddleware, asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: { telegramChatId: true, telegramEnabled: true },
  });
  res.json({ linked: !!user?.telegramChatId, enabled: user?.telegramEnabled || false });
}));

export default router;
