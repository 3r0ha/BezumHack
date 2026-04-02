import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../lib/jwt';
import { prisma } from '../lib/prisma';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string;
    role: string;
  };
}

export async function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  // Check for API key first
  const apiKeyHeader = req.headers['x-api-key'] as string | undefined;
  if (apiKeyHeader) {
    try {
      const crypto = await import('crypto');
      const keyHash = crypto.createHash('sha256').update(apiKeyHeader).digest('hex');
      const apiKey = await prisma.apiKey.findUnique({ where: { keyHash } });

      if (!apiKey) {
        res.status(401).json({ error: 'Invalid API key' });
        return;
      }

      if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
        res.status(401).json({ error: 'API key expired' });
        return;
      }

      const user = await prisma.user.findUnique({
        where: { id: apiKey.userId },
        select: { id: true, email: true, name: true, role: true },
      });

      if (!user) {
        res.status(401).json({ error: 'User not found' });
        return;
      }

      // Update last used
      prisma.apiKey.update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } }).catch(() => {});

      req.user = user;
      next();
      return;
    } catch {
      res.status(401).json({ error: 'Invalid API key' });
      return;
    }
  }

  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Authorization token required' });
      return;
    }

    const token = authHeader.split(' ')[1];
    const payload = verifyToken(token);

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true, name: true, role: true },
    });

    if (!user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}
