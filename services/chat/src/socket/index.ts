import { Server, Socket } from 'socket.io';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { socketMessageSchema } from '../validators';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret';

export function setupSocket(io: Server): void {
  io.on('connection', (socket: Socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // Resolve user identity: JWT token → userId, or guest fallback
    let userId: string | null = null;
    let displayName: string | null = null;

    // Try JWT token
    const token = socket.handshake.auth?.token;
    if (token) {
      try {
        const payload = jwt.verify(token, JWT_SECRET) as { userId: string };
        userId = payload.userId;
      } catch {
        console.warn(`Socket ${socket.id}: invalid JWT`);
      }
    }

    // Try explicit userId
    if (!userId) {
      userId = socket.handshake.auth?.userId || socket.handshake.query?.userId || null;
    }

    // Guest fallback
    if (!userId) {
      userId = socket.handshake.auth?.guestId || `guest-${socket.id}`;
    }

    displayName = socket.handshake.auth?.guestName || socket.handshake.auth?.name || null;

    socket.join(`user:${userId}`);
    (socket as any).userId = userId;
    (socket as any).displayName = displayName;
    console.log(`Socket ${socket.id} joined user room user:${userId} name:${displayName}`);

    // Join a conversation room
    socket.on('join_conversation', (conversationId: string) => {
      if (!conversationId || typeof conversationId !== 'string') {
        socket.emit('error', { error: 'Invalid conversationId' });
        return;
      }
      socket.join(conversationId);
      console.log(`Socket ${socket.id} joined conversation ${conversationId}`);
    });

    // Leave a conversation room
    socket.on('leave_conversation', (conversationId: string) => {
      if (!conversationId || typeof conversationId !== 'string') {
        socket.emit('error', { error: 'Invalid conversationId' });
        return;
      }
      socket.leave(conversationId);
      console.log(`Socket ${socket.id} left conversation ${conversationId}`);
    });

    // Send a message
    socket.on('send_message', async (data: { conversationId: string; senderId: string; content: string }) => {
      try {
        // Validate input with Zod
        const parsed = socketMessageSchema.parse(data);
        const { conversationId, senderId, content } = parsed;

        // Verify conversation exists
        const conversation = await prisma.conversation.findUnique({
          where: { id: conversationId },
        });

        if (!conversation) {
          socket.emit('error', { error: 'Conversation not found' });
          return;
        }

        const message = await prisma.message.create({
          data: {
            conversationId,
            senderId,
            content,
          },
        });

        // Update conversation's updatedAt
        await prisma.conversation.update({
          where: { id: conversationId },
          data: { updatedAt: new Date() },
        });

        // Broadcast to conversation room
        io.to(conversationId).emit('new_message', message);
      } catch (error: any) {
        console.error('Error saving message via socket:', error);
        if (error.name === 'ZodError') {
          socket.emit('error', { error: 'Validation error', details: error.errors });
        } else {
          socket.emit('error', { error: 'Failed to send message' });
        }
      }
    });

    // Typing indicator
    socket.on('typing', (data: { conversationId: string; userId: string }) => {
      if (!data || !data.conversationId || !data.userId) {
        socket.emit('error', { error: 'conversationId and userId are required for typing indicator' });
        return;
      }
      socket.to(data.conversationId).emit('user_typing', {
        userId: data.userId,
        conversationId: data.conversationId,
      });
    });

    // Stop typing indicator
    socket.on('stop_typing', (data: { conversationId: string; userId: string }) => {
      if (!data || !data.conversationId || !data.userId) {
        socket.emit('error', { error: 'conversationId and userId are required for stop_typing' });
        return;
      }
      socket.to(data.conversationId).emit('user_stop_typing', {
        userId: data.userId,
        conversationId: data.conversationId,
      });
    });

    // === Call signaling ===

    // Initiate a call
    socket.on('call.initiate', async (data: { callId: string; conversationId: string; participants: string[]; type: string }) => {
      console.log(`Call initiated: ${data.callId} by ${(socket as any).userId || 'unknown'}`);
      // Notify all participants
      for (const userId of data.participants) {
        io.to(`user:${userId}`).emit('call.incoming', {
          callId: data.callId,
          conversationId: data.conversationId,
          initiatorId: (socket as any).userId,
          type: data.type,
          participants: data.participants,
        });
      }
    });

    // Join a call room
    socket.on('call.join', (data: { callId: string; userName?: string }) => {
      socket.join(`call:${data.callId}`);
      console.log(`[Call] ${(socket as any).userId} joined call ${data.callId}`);
      socket.to(`call:${data.callId}`).emit('call.user-joined', {
        userId: (socket as any).userId,
        userName: data.userName || (socket as any).displayName || null,
        callId: data.callId,
      });
    });

    // Leave a call
    socket.on('call.leave', (data: { callId: string }) => {
      socket.to(`call:${data.callId}`).emit('call.user-left', {
        userId: (socket as any).userId,
        callId: data.callId,
      });
      socket.leave(`call:${data.callId}`);
    });

    // WebRTC offer
    socket.on('call.offer', (data: { callId: string; targetUserId: string; offer: any }) => {
      io.to(`user:${data.targetUserId}`).emit('call.offer', {
        callId: data.callId,
        fromUserId: (socket as any).userId,
        fromUserName: (socket as any).displayName || data.callId,
        offer: data.offer,
      });
    });

    // WebRTC answer
    socket.on('call.answer', (data: { callId: string; targetUserId: string; answer: any }) => {
      io.to(`user:${data.targetUserId}`).emit('call.answer', {
        callId: data.callId,
        fromUserId: (socket as any).userId,
        fromUserName: (socket as any).displayName || null,
        answer: data.answer,
      });
    });

    // ICE candidate
    socket.on('call.ice-candidate', (data: { callId: string; targetUserId: string; candidate: any }) => {
      io.to(`user:${data.targetUserId}`).emit('call.ice-candidate', {
        callId: data.callId,
        fromUserId: (socket as any).userId,
        candidate: data.candidate,
      });
    });

    // Kick user from call
    socket.on('call.kick', (data: { callId: string; targetUserId: string }) => {
      io.to(`user:${data.targetUserId}`).emit('call.kicked', {
        callId: data.callId,
        kickedBy: (socket as any).userId,
      });
    });

    // End call for all
    socket.on('call.end', (data: { callId: string }) => {
      io.to(`call:${data.callId}`).emit('call.ended', {
        callId: data.callId,
        endedBy: (socket as any).userId,
      });
    });

    // In-call chat message
    socket.on('call.chat', (data: { callId: string; content: string }) => {
      socket.to(`call:${data.callId}`).emit('call.chat', {
        callId: data.callId,
        userId: (socket as any).userId,
        content: data.content,
        timestamp: new Date().toISOString(),
      });
    });

    // === Board collaboration ===

    socket.on('board.join', (data: { boardId: string }) => {
      socket.join(`board:${data.boardId}`);
      socket.to(`board:${data.boardId}`).emit('board.user-joined', {
        userId: (socket as any).userId,
        userName: (socket as any).displayName,
      });
    });

    socket.on('board.leave', (data: { boardId: string }) => {
      socket.to(`board:${data.boardId}`).emit('board.user-left', {
        userId: (socket as any).userId,
      });
      socket.leave(`board:${data.boardId}`);
    });

    socket.on('board.element.create', (data: { boardId: string; element: any }) => {
      socket.to(`board:${data.boardId}`).emit('board.element.created', data.element);
    });

    socket.on('board.element.update', (data: { boardId: string; element: any }) => {
      socket.to(`board:${data.boardId}`).emit('board.element.updated', data.element);
    });

    socket.on('board.element.delete', (data: { boardId: string; elementId: string }) => {
      socket.to(`board:${data.boardId}`).emit('board.element.deleted', { id: data.elementId });
    });

    socket.on('board.cursor', (data: { boardId: string; x: number; y: number }) => {
      socket.to(`board:${data.boardId}`).emit('board.cursor', {
        userId: (socket as any).userId,
        userName: (socket as any).displayName,
        x: data.x,
        y: data.y,
      });
    });

    // Disconnect
    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });
}
