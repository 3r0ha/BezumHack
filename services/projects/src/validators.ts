import { z } from 'zod';

export const createProjectSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  clientId: z.string().uuid('Invalid clientId format'),
  managerId: z.string().uuid('Invalid managerId format').optional(),
  deadline: z.string().datetime({ offset: true }).optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional()),
});

export const updateProjectSchema = z.object({
  title: z.string().min(1, 'Title cannot be empty').optional(),
  description: z.string().optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED']).optional(),
  managerId: z.string().uuid('Invalid managerId format').nullable().optional(),
  deadline: z.string().datetime({ offset: true }).nullable().optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/).nullable().optional()),
  hourlyRate: z.number().min(0).nullable().optional(),
});

export const createTaskSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  projectId: z.string().uuid('Invalid projectId format'),
  assigneeId: z.string().uuid('Invalid assigneeId format').optional(),
  estimatedHours: z.number().positive('Estimated hours must be positive').optional(),
  dueDate: z.string().datetime({ offset: true }).optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional()),
  dependsOn: z.array(z.string().uuid()).optional(),
});

export const updateTaskSchema = z.object({
  title: z.string().min(1, 'Title cannot be empty').optional(),
  description: z.string().optional(),
  status: z.enum(['BACKLOG', 'TODO', 'IN_PROGRESS', 'REVIEW', 'DONE']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).optional(),
  assigneeId: z.string().uuid('Invalid assigneeId format').nullable().optional(),
  estimatedHours: z.number().positive('Estimated hours must be positive').nullable().optional(),
  dueDate: z.string().datetime({ offset: true }).nullable().optional().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/).nullable().optional()),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;

// Comment validators
export const createCommentSchema = z.object({
  content: z.string().min(1, 'Content is required'),
  taskId: z.string().uuid(),
});

// Time entry validators
export const startTimerSchema = z.object({
  taskId: z.string().uuid(),
  note: z.string().optional(),
});

export const manualEntrySchema = z.object({
  taskId: z.string().uuid(),
  hours: z.number().positive(),
  note: z.string().optional(),
  startedAt: z.string().datetime().optional(),
});

// Approval validators
export const createApprovalSchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().min(1),
  description: z.string().optional(),
});

export const reviewApprovalSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  reviewComment: z.string().optional(),
});
