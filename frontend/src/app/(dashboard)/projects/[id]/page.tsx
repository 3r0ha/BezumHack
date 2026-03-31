"use client";

import { useEffect, useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Plus,
  ArrowLeft,
  Lock,
  AlertTriangle,
  ChevronRight,
  GripVertical,
  ArrowRight,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";

// --- Types ---

interface Task {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  assignee: string | null;
  depends_on: string[];
}

interface Project {
  id: string;
  title: string;
  description: string;
  status: string;
  client_name: string;
  deadline: string | null;
  manager: string | null;
  tasks: Task[];
}

// --- Config ---

const kanbanColumns = [
  { key: "backlog", label: "Backlog", color: "bg-muted-foreground/20" },
  { key: "todo", label: "Todo", color: "bg-blue-500/20" },
  { key: "in_progress", label: "In Progress", color: "bg-amber-500/20" },
  { key: "review", label: "Review", color: "bg-violet-500/20" },
  { key: "done", label: "Done", color: "bg-emerald-500/20" },
];

const priorityConfig: Record<string, { label: string; className: string; order: number }> = {
  critical: {
    label: "Критический",
    className: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/20",
    order: 0,
  },
  high: {
    label: "Высокий",
    className: "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/20",
    order: 1,
  },
  medium: {
    label: "Средний",
    className: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20",
    order: 2,
  },
  low: {
    label: "Низкий",
    className: "bg-muted text-muted-foreground border-transparent",
    order: 3,
  },
};

const statusConfig: Record<string, { label: string; className: string }> = {
  DRAFT: { label: "Черновик", className: "bg-muted text-muted-foreground" },
  ACTIVE: { label: "Активен", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20" },
  ON_HOLD: { label: "Приостановлен", className: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20" },
  COMPLETED: { label: "Завершён", className: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/20" },
  CANCELLED: { label: "Отменён", className: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/20" },
};

const assigneeAvatars: Record<string, { name: string; initials: string; color: string }> = {
  alex: { name: "Алексей К.", initials: "АК", color: "bg-blue-500/15 text-blue-700 dark:text-blue-400" },
  maria: { name: "Мария С.", initials: "МС", color: "bg-pink-500/15 text-pink-700 dark:text-pink-400" },
  dmitry: { name: "Дмитрий В.", initials: "ДВ", color: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
  anna: { name: "Анна П.", initials: "АП", color: "bg-violet-500/15 text-violet-700 dark:text-violet-400" },
  ivan: { name: "Иван Л.", initials: "ИЛ", color: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
};

// --- Mock Data ---

const mockProject: Project = {
  id: "1",
  title: "Мобильное приложение для доставки",
  description:
    "Разработка кроссплатформенного мобильного приложения для сервиса доставки еды с отслеживанием заказов в реальном времени, интеграцией платёжных систем и push-уведомлениями.",
  status: "ACTIVE",
  client_name: "ООО Рога и Копыта",
  deadline: "2026-05-15",
  manager: "Алексей К.",
  tasks: [
    {
      id: "t1",
      title: "Дизайн UI/UX",
      description: "Создать макеты всех экранов в Figma, провести ревью с клиентом",
      status: "done",
      priority: "high",
      assignee: "anna",
      depends_on: [],
    },
    {
      id: "t2",
      title: "Архитектура БД",
      description: "Проектирование схемы базы данных, миграции",
      status: "done",
      priority: "high",
      assignee: "dmitry",
      depends_on: [],
    },
    {
      id: "t3",
      title: "REST API — авторизация",
      description: "JWT аутентификация, OAuth 2.0, refresh tokens",
      status: "review",
      priority: "critical",
      assignee: "alex",
      depends_on: ["t2"],
    },
    {
      id: "t4",
      title: "REST API — заказы",
      description: "CRUD для заказов, фильтрация, пагинация",
      status: "in_progress",
      priority: "high",
      assignee: "alex",
      depends_on: ["t2", "t3"],
    },
    {
      id: "t5",
      title: "Экран каталога",
      description: "Реализация экрана каталога с поиском и фильтрами",
      status: "in_progress",
      priority: "medium",
      assignee: "maria",
      depends_on: ["t1"],
    },
    {
      id: "t6",
      title: "Экран корзины и оформления",
      description: "Корзина, промокоды, выбор адреса и способа оплаты",
      status: "todo",
      priority: "medium",
      assignee: "maria",
      depends_on: ["t1", "t5"],
    },
    {
      id: "t7",
      title: "Интеграция платёжного шлюза",
      description: "Подключение Stripe/YooKassa, обработка webhook-ов",
      status: "backlog",
      priority: "high",
      assignee: "dmitry",
      depends_on: ["t4"],
    },
    {
      id: "t8",
      title: "Push-уведомления",
      description: "FCM, APNs, фоновая доставка, настройки пользователя",
      status: "backlog",
      priority: "medium",
      assignee: null,
      depends_on: ["t3"],
    },
    {
      id: "t9",
      title: "Unit & Integration тесты",
      description: "Покрытие тестами API и бизнес-логики (>80%)",
      status: "todo",
      priority: "medium",
      assignee: "ivan",
      depends_on: ["t3", "t4"],
    },
    {
      id: "t10",
      title: "CI/CD пайплайн",
      description: "GitHub Actions, автодеплой на staging, Docker",
      status: "backlog",
      priority: "low",
      assignee: "ivan",
      depends_on: ["t9"],
    },
  ],
};

// --- Helpers ---

function getBlockedBy(task: Task, allTasks: Task[]): Task[] {
  return allTasks.filter(
    (t) => task.depends_on.includes(t.id) && t.status !== "done"
  );
}

function getBlocks(taskId: string, allTasks: Task[]): Task[] {
  return allTasks.filter((t) => t.depends_on.includes(taskId));
}

function detectCircularDeps(tasks: Task[]): Set<string> {
  const circular = new Set<string>();
  const visited = new Set<string>();
  const inStack = new Set<string>();
  const taskMap = new Map(tasks.map((t) => [t.id, t]));

  function dfs(id: string) {
    if (inStack.has(id)) {
      circular.add(id);
      return;
    }
    if (visited.has(id)) return;
    visited.add(id);
    inStack.add(id);
    const task = taskMap.get(id);
    if (task) {
      for (const depId of task.depends_on) {
        dfs(depId);
        if (circular.has(depId)) circular.add(id);
      }
    }
    inStack.delete(id);
  }

  tasks.forEach((t) => dfs(t.id));
  return circular;
}

// --- Loading Skeleton ---

function ProjectSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-9" />
        <div className="space-y-2">
          <Skeleton className="h-7 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
      </div>
      <Skeleton className="h-10 w-80" />
      <div className="flex gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex-1 min-w-[240px]">
            <Skeleton className="h-8 w-full mb-3" />
            <div className="space-y-3">
              <Skeleton className="h-24 w-full rounded-lg" />
              <Skeleton className="h-24 w-full rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Task Card Component ---

function TaskCard({
  task,
  allTasks,
  onClick,
}: {
  task: Task;
  allTasks: Task[];
  onClick: () => void;
}) {
  const blocked = getBlockedBy(task, allTasks);
  const isBlocked = blocked.length > 0;
  const priority = priorityConfig[task.priority] || priorityConfig.medium;
  const assignee = task.assignee ? assigneeAvatars[task.assignee] : null;

  return (
    <div
      onClick={onClick}
      className={`
        group rounded-lg border bg-card p-3.5 cursor-pointer
        transition-all duration-200 hover:shadow-md hover:-translate-y-0.5
        ${isBlocked ? "border-amber-500/30 bg-amber-500/5" : "hover:border-primary/30"}
      `}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h4 className="text-sm font-medium leading-snug group-hover:text-primary transition-colors line-clamp-2">
          {task.title}
        </h4>
        <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>

      {task.description && (
        <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
          {task.description}
        </p>
      )}

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Badge
            variant="outline"
            className={`text-[10px] px-1.5 py-0 h-5 font-medium ${priority.className}`}
          >
            {priority.label}
          </Badge>
          {isBlocked && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center">
                  <Lock className="h-3.5 w-3.5 text-amber-500" />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>Заблокирована: {blocked.map((b) => b.title).join(", ")}</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
        {assignee && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Avatar className="h-6 w-6">
                <AvatarFallback className={`text-[10px] ${assignee.color}`}>
                  {assignee.initials}
                </AvatarFallback>
              </Avatar>
            </TooltipTrigger>
            <TooltipContent>
              <p>{assignee.name}</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
}

// --- Kanban Column Component ---

function KanbanColumn({
  column,
  tasks,
  allTasks,
  onTaskClick,
}: {
  column: (typeof kanbanColumns)[0];
  tasks: Task[];
  allTasks: Task[];
  onTaskClick: (task: Task) => void;
}) {
  return (
    <div className="flex flex-col min-w-[260px] max-w-[320px] flex-1">
      <div className="flex items-center gap-2 mb-3 px-1">
        <div className={`h-2.5 w-2.5 rounded-full ${column.color}`} />
        <h3 className="text-sm font-semibold">{column.label}</h3>
        <span className="text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5">
          {tasks.length}
        </span>
      </div>
      <ScrollArea className="flex-1 pr-1" style={{ maxHeight: "calc(100vh - 340px)" }}>
        <div className="space-y-2.5 pb-2">
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              allTasks={allTasks}
              onClick={() => onTaskClick(task)}
            />
          ))}
          {tasks.length === 0 && (
            <div className="rounded-lg border border-dashed p-4 text-center">
              <p className="text-xs text-muted-foreground">Нет задач</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// --- Dependencies Tab ---

function DependenciesTab({ tasks }: { tasks: Task[] }) {
  const circularIds = useMemo(() => detectCircularDeps(tasks), [tasks]);
  const taskMap = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);

  const tasksWithDeps = tasks.filter(
    (t) => t.depends_on.length > 0 || getBlocks(t.id, tasks).length > 0
  );

  if (tasksWithDeps.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Нет зависимостей между задачами</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {circularIds.size > 0 && (
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
            <div>
              <p className="text-sm font-medium text-red-700 dark:text-red-400">
                Обнаружены циклические зависимости
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Задачи с циклическими зависимостями отмечены красным
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {tasks.map((task) => {
          const deps = task.depends_on
            .map((id) => taskMap.get(id))
            .filter(Boolean) as Task[];
          const blocks = getBlocks(task.id, tasks);
          const isCircular = circularIds.has(task.id);

          if (deps.length === 0 && blocks.length === 0) return null;

          const priority = priorityConfig[task.priority] || priorityConfig.medium;

          return (
            <Card
              key={task.id}
              className={isCircular ? "border-red-500/30 bg-red-500/5" : ""}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold">{task.title}</h4>
                    <Badge
                      variant="outline"
                      className={`text-[10px] px-1.5 py-0 h-5 ${priority.className}`}
                    >
                      {priority.label}
                    </Badge>
                    {isCircular && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/20">
                        Цикл
                      </Badge>
                    )}
                  </div>
                  <Badge variant="outline" className="text-[10px] shrink-0">
                    {task.status}
                  </Badge>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {deps.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Зависит от
                      </p>
                      {deps.map((dep) => (
                        <div
                          key={dep.id}
                          className="flex items-center gap-2 text-sm pl-3 border-l-2 border-amber-500/40 py-1"
                        >
                          <ArrowRight className="h-3 w-3 text-amber-500 shrink-0" />
                          <span className="truncate">{dep.title}</span>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 ml-auto shrink-0">
                            {dep.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}

                  {blocks.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Блокирует
                      </p>
                      {blocks.map((blocked) => (
                        <div
                          key={blocked.id}
                          className="flex items-center gap-2 text-sm pl-3 border-l-2 border-blue-500/40 py-1"
                        >
                          <ChevronRight className="h-3 w-3 text-blue-500 shrink-0" />
                          <span className="truncate">{blocked.title}</span>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 ml-auto shrink-0">
                            {blocked.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// --- Settings Tab ---

function SettingsTab({
  project,
  onUpdate,
}: {
  project: Project;
  onUpdate: (p: Partial<Project>) => void;
}) {
  const [title, setTitle] = useState(project.title);
  const [description, setDescription] = useState(project.description);
  const [status, setStatus] = useState(project.status);
  const [deadline, setDeadline] = useState(project.deadline || "");
  const [manager, setManager] = useState(project.manager || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch(`/api/projects/${project.id}`, {
        title,
        description,
        status,
        deadline: deadline || null,
        manager: manager || null,
      });
    } catch {
      // Apply locally
    }
    onUpdate({ title, description, status, deadline: deadline || null, manager: manager || null });
    setSaving(false);
  };

  return (
    <form onSubmit={handleSave} className="max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Основные настройки</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="proj-title">Название проекта</Label>
            <Input
              id="proj-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="proj-desc">Описание</Label>
            <Textarea
              id="proj-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Статус</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DRAFT">Черновик</SelectItem>
                  <SelectItem value="ACTIVE">Активен</SelectItem>
                  <SelectItem value="ON_HOLD">Приостановлен</SelectItem>
                  <SelectItem value="COMPLETED">Завершён</SelectItem>
                  <SelectItem value="CANCELLED">Отменён</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="proj-deadline">Дедлайн</Label>
              <Input
                id="proj-deadline"
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="proj-manager">Менеджер проекта</Label>
            <Input
              id="proj-manager"
              value={manager}
              onChange={(e) => setManager(e.target.value)}
              placeholder="Имя менеджера"
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? "Сохранение..." : "Сохранить изменения"}
        </Button>
      </div>
    </form>
  );
}

// --- Main Page Component ---

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [creating, setCreating] = useState(false);

  // Add task form
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newPriority, setNewPriority] = useState("medium");
  const [newStatus, setNewStatus] = useState("backlog");
  const [newAssignee, setNewAssignee] = useState("");
  const [newDependsOn, setNewDependsOn] = useState<string[]>([]);

  useEffect(() => {
    const fetchProject = async () => {
      setLoading(true);
      try {
        const data = await api.get<any>(`/api/projects/${projectId}`);
        if (data) {
          setProject({
            id: data.id,
            title: data.title,
            description: data.description || "",
            status: data.status || "ACTIVE",
            client_name: data.client_name || "",
            deadline: data.deadline || null,
            manager: data.manager || null,
            tasks: (data.tasks || []).map((t: any) => ({
              id: t.id,
              title: t.title,
              description: t.description || "",
              status: t.status || "backlog",
              priority: t.priority || "medium",
              assignee: t.assignee || null,
              depends_on: Array.isArray(t.depends_on)
                ? t.depends_on
                : t.depends_on
                ? [t.depends_on]
                : [],
            })),
          });
        } else {
          setProject({ ...mockProject, id: projectId });
        }
      } catch {
        setProject({ ...mockProject, id: projectId });
      } finally {
        setLoading(false);
      }
    };

    fetchProject();
  }, [projectId]);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project) return;
    setCreating(true);

    const taskData = {
      title: newTitle,
      description: newDescription,
      priority: newPriority,
      status: newStatus,
      assignee: newAssignee || null,
      depends_on: newDependsOn,
    };

    try {
      const result = await api.post<any>(`/api/projects/${projectId}/tasks`, taskData);
      setProject({
        ...project,
        tasks: [
          ...project.tasks,
          {
            id: result?.id || `t${Date.now()}`,
            ...taskData,
          },
        ],
      });
    } catch {
      setProject({
        ...project,
        tasks: [
          ...project.tasks,
          {
            id: `t${Date.now()}`,
            ...taskData,
          },
        ],
      });
    } finally {
      setCreating(false);
      setAddTaskOpen(false);
      setNewTitle("");
      setNewDescription("");
      setNewPriority("medium");
      setNewStatus("backlog");
      setNewAssignee("");
      setNewDependsOn([]);
    }
  };

  const handleProjectUpdate = (updates: Partial<Project>) => {
    if (project) {
      setProject({ ...project, ...updates });
    }
  };

  const toggleDependency = (taskId: string) => {
    setNewDependsOn((prev) =>
      prev.includes(taskId)
        ? prev.filter((id) => id !== taskId)
        : [...prev, taskId]
    );
  };

  if (loading) {
    return (
      <TooltipProvider>
        <ProjectSkeleton />
      </TooltipProvider>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">Проект не найден</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push("/projects")}>
          К списку проектов
        </Button>
      </div>
    );
  }

  const projectStatusConfig = statusConfig[project.status] || {
    label: project.status,
    className: "bg-muted text-muted-foreground",
  };

  const tasksByColumn = kanbanColumns.map((col) => ({
    ...col,
    tasks: project.tasks
      .filter((t) => t.status === col.key)
      .sort(
        (a, b) =>
          (priorityConfig[a.priority]?.order ?? 99) -
          (priorityConfig[b.priority]?.order ?? 99)
      ),
  }));

  const doneCount = project.tasks.filter((t) => t.status === "done").length;
  const totalTasks = project.tasks.length;
  const progressPercent = totalTasks > 0 ? Math.round((doneCount / totalTasks) * 100) : 0;

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={() => router.push("/projects")}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-xl lg:text-2xl font-bold tracking-tight truncate">
                  {project.title}
                </h1>
                <Badge
                  variant="outline"
                  className={`text-xs font-medium ${projectStatusConfig.className}`}
                >
                  {projectStatusConfig.label}
                </Badge>
              </div>
              {project.description && (
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                  {project.description}
                </p>
              )}
            </div>
          </div>

          {/* Project meta */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground pl-12">
            {project.client_name && <span>Клиент: {project.client_name}</span>}
            {project.deadline && <span>Дедлайн: {new Date(project.deadline).toLocaleDateString("ru-RU")}</span>}
            <span>
              Задачи: {doneCount}/{totalTasks} ({progressPercent}%)
            </span>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="tasks">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <TabsList>
              <TabsTrigger value="tasks">Задачи</TabsTrigger>
              <TabsTrigger value="dependencies">Зависимости</TabsTrigger>
              <TabsTrigger value="settings">Настройки</TabsTrigger>
            </TabsList>

            {/* Add task button (shown on tasks tab) */}
            <Dialog open={addTaskOpen} onOpenChange={setAddTaskOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-2 shadow-sm">
                  <Plus className="h-4 w-4" />
                  Добавить задачу
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Новая задача</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreateTask} className="space-y-4 mt-2">
                  <div className="space-y-2">
                    <Label htmlFor="task-title">Название *</Label>
                    <Input
                      id="task-title"
                      placeholder="Название задачи"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="task-desc">Описание</Label>
                    <Textarea
                      id="task-desc"
                      placeholder="Описание задачи..."
                      value={newDescription}
                      onChange={(e) => setNewDescription(e.target.value)}
                      rows={3}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Приоритет</Label>
                      <Select value={newPriority} onValueChange={setNewPriority}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">Низкий</SelectItem>
                          <SelectItem value="medium">Средний</SelectItem>
                          <SelectItem value="high">Высокий</SelectItem>
                          <SelectItem value="critical">Критический</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Колонка</Label>
                      <Select value={newStatus} onValueChange={setNewStatus}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {kanbanColumns.map((col) => (
                            <SelectItem key={col.key} value={col.key}>
                              {col.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Исполнитель</Label>
                    <Select value={newAssignee} onValueChange={setNewAssignee}>
                      <SelectTrigger>
                        <SelectValue placeholder="Не назначен" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Не назначен</SelectItem>
                        {Object.entries(assigneeAvatars).map(([key, val]) => (
                          <SelectItem key={key} value={key}>
                            {val.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {project.tasks.length > 0 && (
                    <div className="space-y-2">
                      <Label>Зависит от</Label>
                      <div className="max-h-32 overflow-y-auto space-y-1 rounded-md border p-2">
                        {project.tasks.map((task) => (
                          <label
                            key={task.id}
                            className="flex items-center gap-2 text-sm py-1 px-1 rounded hover:bg-accent cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={newDependsOn.includes(task.id)}
                              onChange={() => toggleDependency(task.id)}
                              className="rounded border-input"
                            />
                            <span className="truncate">{task.title}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                  <DialogFooter className="pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setAddTaskOpen(false)}
                    >
                      Отмена
                    </Button>
                    <Button type="submit" disabled={!newTitle.trim() || creating}>
                      {creating ? "Создание..." : "Создать"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {/* Tasks Tab - Kanban Board */}
          <TabsContent value="tasks" className="mt-4">
            <ScrollArea orientation="horizontal" className="pb-4">
              <div className="flex gap-4 min-w-max">
                {tasksByColumn.map((col) => (
                  <KanbanColumn
                    key={col.key}
                    column={col}
                    tasks={col.tasks}
                    allTasks={project.tasks}
                    onTaskClick={(task) => setSelectedTask(task)}
                  />
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Dependencies Tab */}
          <TabsContent value="dependencies" className="mt-4">
            <DependenciesTab tasks={project.tasks} />
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="mt-4">
            <SettingsTab project={project} onUpdate={handleProjectUpdate} />
          </TabsContent>
        </Tabs>

        {/* Task Detail Dialog */}
        <Dialog
          open={!!selectedTask}
          onOpenChange={(open) => {
            if (!open) setSelectedTask(null);
          }}
        >
          <DialogContent className="max-w-lg">
            {selectedTask && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    {selectedTask.title}
                    <Badge
                      variant="outline"
                      className={`text-[10px] ml-1 ${
                        (priorityConfig[selectedTask.priority] || priorityConfig.medium)
                          .className
                      }`}
                    >
                      {(priorityConfig[selectedTask.priority] || priorityConfig.medium).label}
                    </Badge>
                  </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 mt-2">
                  {selectedTask.description && (
                    <div>
                      <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                        Описание
                      </Label>
                      <p className="text-sm mt-1">{selectedTask.description}</p>
                    </div>
                  )}

                  <Separator />

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                        Статус
                      </Label>
                      <p className="text-sm mt-1 capitalize">
                        {kanbanColumns.find((c) => c.key === selectedTask.status)?.label ||
                          selectedTask.status}
                      </p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                        Исполнитель
                      </Label>
                      <div className="flex items-center gap-2 mt-1">
                        {selectedTask.assignee &&
                        assigneeAvatars[selectedTask.assignee] ? (
                          <>
                            <Avatar className="h-6 w-6">
                              <AvatarFallback
                                className={`text-[10px] ${assigneeAvatars[selectedTask.assignee].color}`}
                              >
                                {assigneeAvatars[selectedTask.assignee].initials}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm">
                              {assigneeAvatars[selectedTask.assignee].name}
                            </span>
                          </>
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            Не назначен
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {selectedTask.depends_on.length > 0 && (
                    <>
                      <Separator />
                      <div>
                        <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                          Зависимости
                        </Label>
                        <div className="mt-2 space-y-1.5">
                          {selectedTask.depends_on.map((depId) => {
                            const dep = project.tasks.find((t) => t.id === depId);
                            if (!dep) return null;
                            const isDone = dep.status === "done";
                            return (
                              <div
                                key={depId}
                                className="flex items-center gap-2 text-sm"
                              >
                                <div
                                  className={`h-2 w-2 rounded-full ${
                                    isDone ? "bg-emerald-500" : "bg-amber-500"
                                  }`}
                                />
                                <span className={isDone ? "line-through text-muted-foreground" : ""}>
                                  {dep.title}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  )}

                  {getBlocks(selectedTask.id, project.tasks).length > 0 && (
                    <>
                      <Separator />
                      <div>
                        <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                          Блокирует
                        </Label>
                        <div className="mt-2 space-y-1.5">
                          {getBlocks(selectedTask.id, project.tasks).map((blocked) => (
                            <div
                              key={blocked.id}
                              className="flex items-center gap-2 text-sm"
                            >
                              <Lock className="h-3 w-3 text-amber-500" />
                              <span>{blocked.title}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}
