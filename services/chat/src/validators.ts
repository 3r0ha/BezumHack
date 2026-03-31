import { z } from 'zod';

export const createConversationSchema = z.object({
  projectId: z.string().uuid('Invalid projectId format'),
  title: z.string().optional(),
  participantIds: z.array(z.string().uuid('Invalid participant ID format')).min(1, 'At least one participant is required'),
});

export const sendMessageSchema = z.object({
  senderId: z.string().uuid('Invalid senderId format'),
  content: z.string().min(1, 'Message content cannot be empty'),
});

export const translateMessageSchema = z.object({
  targetLanguage: z.string().min(2, 'Target language code is required').default('en'),
});

export const socketMessageSchema = z.object({
  conversationId: z.string().uuid('Invalid conversationId format'),
  senderId: z.string().uuid('Invalid senderId format'),
  content: z.string().min(1, 'Message content cannot be empty'),
});

export const markReadSchema = z.object({
  userId: z.string().uuid('Invalid userId format'),
});

export type CreateConversationInput = z.infer<typeof createConversationSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type TranslateMessageInput = z.infer<typeof translateMessageSchema>;
export type SocketMessageInput = z.infer<typeof socketMessageSchema>;
export type MarkReadInput = z.infer<typeof markReadSchema>;
