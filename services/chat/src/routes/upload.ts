import { Router, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret';

const prisma = new PrismaClient();
const router = Router();

const UPLOAD_DIR = '/app/uploads';

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = crypto.randomBytes(16).toString('hex') + ext;
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
      'application/pdf',
      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/zip', 'application/x-rar-compressed',
      'text/plain', 'text/csv',
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed'));
    }
  },
});

const asyncHandler = (fn: (req: any, res: Response, next: NextFunction) => Promise<void>) => {
  return (req: any, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// POST /upload/:conversationId — upload file and create message
router.post('/:conversationId', upload.single('file'), asyncHandler(async (req: any, res: Response) => {
  const { conversationId } = req.params;
  const file = req.file;

  if (!file) {
    res.status(400).json({ error: 'No file uploaded' });
    return;
  }

  const senderId = req.body.senderId || req.user?.userId;
  if (!senderId) {
    res.status(400).json({ error: 'senderId required' });
    return;
  }

  const fileUrl = `/uploads/${file.filename}`;
  const isImage = file.mimetype.startsWith('image/');

  const message = await prisma.message.create({
    data: {
      conversationId,
      senderId,
      content: isImage ? '' : file.originalname,
      fileName: file.originalname,
      fileUrl,
      fileType: file.mimetype,
      fileSize: file.size,
    },
  });

  // Update conversation updatedAt
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  });

  // Emit via Socket.IO
  const io = req.app.get('io');
  if (io) {
    io.to(conversationId).emit('new_message', message);
  }

  res.status(201).json(message);
}));

// GET /file/:filename — serve file with auth check (supports ?token= for img/download)
router.get('/file/:filename', asyncHandler(async (req: any, res: Response) => {
  const { filename } = req.params;

  // Auth: check JWT from header or ?token= query
  let userId = req.user?.userId;
  if (!userId && req.query.token) {
    try {
      const payload = jwt.verify(req.query.token as string, JWT_SECRET) as { userId: string };
      userId = payload.userId;
    } catch {}
  }
  if (!userId) { res.status(401).json({ error: 'Auth required' }); return; }

  // Find message with this file
  const message = await prisma.message.findFirst({
    where: { fileUrl: `/uploads/${filename}` },
    select: { conversationId: true },
  });
  if (!message) { res.status(404).json({ error: 'File not found' }); return; }

  // Check user is participant
  const participant = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId: message.conversationId, userId } },
  });
  if (!participant) { res.status(403).json({ error: 'Access denied' }); return; }

  const filePath = path.join(UPLOAD_DIR, filename);
  if (!fs.existsSync(filePath)) { res.status(404).json({ error: 'File not found' }); return; }
  res.sendFile(filePath);
}));

export { router as uploadRouter };
