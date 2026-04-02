// ==========================================
// Shared type definitions for Envelope platform
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
  refreshToken?: string;
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
  hourlyRate: number | null;
  createdAt: string;
  updatedAt: string;
  tasks?: Task[];
  approvals?: Approval[];
  invoices?: Invoice[];
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
  actualHours: number | null;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  blockedBy?: TaskDependency[];
  blocks?: TaskDependency[];
  comments?: Comment[];
  timeEntries?: TimeEntry[];
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
  hourlyRate?: number;
}

export interface CreateTaskRequest {
  title: string;
  description?: string;
  priority?: Priority;
  projectId: string;
  assigneeId?: string;
  dependsOn?: string[];
  dueDate?: string;
  estimatedHours?: number;
}

export interface ProjectStats {
  totalProjects: number;
  byStatus: Record<ProjectStatus, number>;
  totalTasks: number;
  tasksByStatus: Record<TaskStatus, number>;
}

// --- Comments ---

export interface Comment {
  id: string;
  content: string;
  userId: string;
  taskId: string;
  createdAt: string;
  updatedAt: string;
  userName?: string;
}

// --- Time Tracking ---

export interface TimeEntry {
  id: string;
  taskId: string;
  userId: string;
  startedAt: string;
  stoppedAt: string | null;
  hours: number | null;
  note: string | null;
  createdAt: string;
}

export interface TimeSummary {
  totalEstimated: number;
  totalActual: number;
  variance: number;
  byUser: Record<string, number>;
  tasks: {
    id: string;
    title: string;
    estimated: number | null;
    actual: number | null;
    variance: number;
  }[];
}

// --- Approvals ---

export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface Approval {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  status: ApprovalStatus;
  requestedBy: string;
  reviewedBy: string | null;
  reviewComment: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  requestedByName?: string;
  reviewedByName?: string;
}

// --- Invoices / Billing ---

export type InvoiceStatus = 'DRAFT' | 'ISSUED' | 'PAID' | 'OVERDUE' | 'CANCELLED';

export interface Invoice {
  id: string;
  projectId: string;
  number: string;
  totalAmount: number;
  status: InvoiceStatus;
  issuedAt: string | null;
  paidAt: string | null;
  items: InvoiceItem[];
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceItem {
  id: string;
  invoiceId: string;
  description: string;
  hours: number;
  rate: number;
  amount: number;
  taskId: string | null;
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

// --- Notifications ---

export type NotificationType =
  | 'TASK_ASSIGNED'
  | 'TASK_STATUS_CHANGED'
  | 'TASK_COMMENT'
  | 'BLOCKER_RESOLVED'
  | 'DEADLINE_APPROACHING'
  | 'APPROVAL_REQUESTED'
  | 'APPROVAL_REVIEWED'
  | 'INVOICE_ISSUED'
  | 'MESSAGE_RECEIVED'
  | 'PROJECT_UPDATE';

export type NotificationPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  readAt: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
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

// --- AI Autopilot ---

export interface AutopilotRequest {
  text: string;
  project_title?: string;
}

export interface AutopilotTask {
  title: string;
  description: string;
  priority: Priority;
  estimated_hours: number;
  phase: string;
  dependencies: string[];
  skills_required?: string[];
}

export interface AutopilotResult {
  project_title: string;
  project_description: string;
  phases: { name: string; description: string; order: number }[];
  tasks: AutopilotTask[];
  total_estimated_hours: number;
  estimated_weeks: number;
  risks: string[];
  tech_stack_suggestions: string[];
}

// --- AI Analytics ---

export interface ProjectAnalyticsInsight {
  type: 'warning' | 'success' | 'info' | 'critical';
  title: string;
  description: string;
}

export interface ProjectAnalytics {
  health_score: number;
  health_label: string;
  insights: ProjectAnalyticsInsight[];
  estimation_accuracy: {
    overall_percent: number;
    overestimated_count: number;
    underestimated_count: number;
    accurate_count: number;
  };
  velocity: {
    tasks_per_week: number;
    hours_per_week: number;
    trend: 'increasing' | 'stable' | 'decreasing';
  };
  deadline_prediction: {
    on_track: boolean;
    predicted_completion: string;
    confidence: 'high' | 'medium' | 'low';
    reasoning: string;
  };
}

export interface WeeklyReport {
  summary: string;
  completed_tasks: string[];
  in_progress: string[];
  planned_next_week: string[];
  risks: { title: string; mitigation: string }[];
  metrics: {
    tasks_completed: number;
    tasks_total: number;
    progress_percent: number;
    hours_this_week: number;
    budget_status: string;
  };
  client_action_required: string[];
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
