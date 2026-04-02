import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret';

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    role?: string;
  };
}

export async function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  // Check for API key first
  const apiKey = req.headers['x-api-key'] as string | undefined;
  if (apiKey) {
    try {
      const authUrl = process.env.AUTH_SERVICE_URL || 'http://auth:3001';
      const resp = await fetch(`${authUrl}/validate-key`, {
        headers: { 'x-api-key': apiKey },
      });
      if (resp.ok) {
        const { user } = await resp.json() as { user: { id: string } };
        req.user = { userId: user.id };
        next();
        return;
      }
    } catch {}
    res.status(401).json({ error: 'Invalid API key' });
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authorization token required' });
    return;
  }

  try {
    const token = authHeader.split(' ')[1];
    const payload = jwt.verify(token, JWT_SECRET) as { userId: string };
    req.user = { userId: payload.userId };

    // Also try to get role from auth service cache or header
    const role = req.headers['x-user-role'] as string;
    if (role) req.user.role = role;

    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    if (roles.length > 0 && req.user.role && !roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }
    next();
  };
}
