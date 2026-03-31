// ==========================================
// Shared type definitions for DevSync platform
// Used by frontend and all backend services
// ==========================================

// --- Auth ---

export type Role = 'CLIENT' | 'DEVELOPER' | 'MANAGER';

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  role: Role;
}

// --- Projects ---

export type ProjectStatus = 'DRAFT' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED';
export type TaskStatus = 'BACKLOG' | 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE';
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface Project {
  id: string;
  title: string;
  description: string | null;
  status: ProjectStatus;
  clientId: string;
  managerId: string | null;
  deadline: string | null;
  createdAt: string;
  updatedAt: string;
  tasks?: Task[];
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: Priority;
  assigneeId: string | null;
  projectId: string;
  estimatedHours: number | null;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  blockedBy?: TaskDependency[];
  blocks?: TaskDependency[];
}

export interface TaskDependency {
  id: string;
  blockedTaskId: string;
  blockingTaskId: string;
  blockedTask?: Task;
  blockingTask?: Task;
}

export interface CreateProjectRequest {
  title: string;
  description?: string;
  clientId: string;
  managerId?: string;
  deadline?: string;
}

export interface CreateTaskRequest {
  title: string;
  description?: string;
  priority?: Priority;
  projectId: string;
  assigneeId?: string;
  dependsOn?: string[];
  dueDate?: string;
}

export interface ProjectStats {
  totalProjects: number;
  byStatus: Record<ProjectStatus, number>;
  totalTasks: number;
  tasksByStatus: Record<TaskStatus, number>;
}

// --- Chat ---

export interface Conversation {
  id: string;
  projectId: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
  messages?: Message[];
  participants?: ConversationParticipant[];
  lastMessage?: Message;
  unreadCount?: number;
}

export interface ConversationParticipant {
  id: string;
  conversationId: string;
  userId: string;
  joinedAt: string;
  lastReadAt: string | null;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  translatedContent: string | null;
  createdAt: string;
}

export interface CreateConversationRequest {
  projectId: string;
  title?: string;
  participantIds: string[];
}

export interface SendMessageRequest {
  senderId: string;
  content: string;
}

// --- AI ---

export interface SummarizeRequest {
  text: string;
  max_length?: number;
}

export interface SummarizeResponse {
  summary: string;
  key_points: string[];
}

export interface TranslateRequest {
  text: string;
  source_lang?: string;
  target_lang?: string;
}

export interface TranslateResponse {
  translated_text: string;
  detected_language: string;
}

export interface EstimateRequest {
  title: string;
  description: string;
  context?: string;
}

export interface EstimateResponse {
  complexity: 'low' | 'medium' | 'high' | 'critical';
  estimated_hours: number;
  reasoning: string;
  suggested_subtasks: string[];
}

// --- Common ---

export interface ApiError {
  error: string;
  details?: unknown;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  skip: number;
  take: number;
}
