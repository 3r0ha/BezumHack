import { Server, Socket } from 'socket.io';
import { PrismaClient } from '@prisma/client';
import { socketMessageSchema } from '../validators';

const prisma = new PrismaClient();

export function setupSocket(io: Server): void {
  io.on('connection', (socket: Socket) => {
    console.log(`Socket connected: ${socket.id}`);

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

    // Disconnect
    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });
}
