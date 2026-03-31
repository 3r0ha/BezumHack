"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Search,
  FolderKanban,
  CalendarDays,
  Users,
  ListTodo,
  ArrowUpDown,
} from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api";

interface Project {
  id: string;
  title: string;
  description: string;
  status: string;
  client_name: string;
  progress: number;
  task_count: number;
  done_count: number;
  deadline: string | null;
  updated_at: string;
}

const statusConfig: Record<string, { label: string; className: string; dot: string }> = {
  DRAFT: {
    label: "Черновик",
    className: "bg-muted text-muted-foreground border-transparent",
    dot: "bg-muted-foreground",
  },
  ACTIVE: {
    label: "Активен",
    className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
    dot: "bg-emerald-500",
  },
  ON_HOLD: {
    label: "Приостановлен",
    className: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20",
    dot: "bg-amber-500",
  },
  COMPLETED: {
    label: "Завершён",
    className: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/20",
    dot: "bg-blue-500",
  },
  CANCELLED: {
    label: "Отменён",
    className: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/20",
    dot: "bg-red-500",
  },
};

const mockProjects: Project[] = [
  {
    id: "1",
    title: "Мобильное приложение для доставки",
    description: "Кроссплатформенное мобильное приложение для сервиса доставки еды с отслеживанием заказов в реальном времени и интеграцией платёжных систем.",
    status: "ACTIVE",
    client_name: "ООО Рога и Копыта",
    progress: 68,
    task_count: 24,
    done_count: 16,
    deadline: "2026-05-15",
    updated_at: "2026-03-24T10:30:00Z",
  },
  {
    id: "2",
    title: "CRM система для отдела продаж",
    description: "Веб-приложение для управления клиентами, сделками и аналитикой продаж. Интеграция с телефонией и почтой.",
    status: "ACTIVE",
    client_name: "Startup Inc.",
    progress: 45,
    task_count: 18,
    done_count: 8,
    deadline: "2026-06-01",
    updated_at: "2026-03-23T16:15:00Z",
  },
  {
    id: "3",
    title: "Редизайн корпоративного сайта",
    description: "Полный редизайн и перенос корпоративного сайта на современный стек: Next.js, TypeScript, Tailwind CSS.",
    status: "ON_HOLD",
    client_name: "ТехКорп",
    progress: 82,
    task_count: 12,
    done_count: 10,
    deadline: "2026-04-20",
    updated_at: "2026-03-22T09:00:00Z",
  },
  {
    id: "4",
    title: "API интеграция с платёжной системой",
    description: "Разработка и интеграция платёжного шлюза, поддержка нескольких провайдеров, рекуррентные платежи.",
    status: "ACTIVE",
    client_name: "ФинТех Групп",
    progress: 30,
    task_count: 8,
    done_count: 2,
    deadline: "2026-07-10",
    updated_at: "2026-03-21T14:45:00Z",
  },
  {
    id: "5",
    title: "Микросервис уведомлений",
    description: "Сервис рассылки push-уведомлений, email и SMS. Поддержка шаблонов и очередей.",
    status: "DRAFT",
    client_name: "Внутренний проект",
    progress: 5,
    task_count: 3,
    done_count: 0,
    deadline: null,
    updated_at: "2026-03-20T11:00:00Z",
  },
];

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "Не указан";
  try {
    return new Date(dateStr).toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function formatRelativeDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Сегодня";
    if (diffDays === 1) return "Вчера";
    if (diffDays < 7) return `${diffDays} дн. назад`;
    return date.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
  } catch {
    return dateStr;
  }
}

function ProjectCardSkeleton() {
  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-5 w-20 rounded-full" />
        </div>
        <Skeleton className="h-4 w-full mt-2" />
        <Skeleton className="h-4 w-2/3" />
      </CardHeader>
      <CardContent className="flex-1 pb-3">
        <div className="space-y-3">
          <Skeleton className="h-4 w-32" />
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-1.5 w-full rounded-full" />
          </div>
        </div>
      </CardContent>
      <CardFooter className="pt-3 border-t">
        <div className="flex items-center justify-between w-full">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-24" />
        </div>
      </CardFooter>
    </Card>
  );
}

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("updated");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  // Create form state
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newDeadline, setNewDeadline] = useState("");
  const [newClientEmail, setNewClientEmail] = useState("");

  useEffect(() => {
    const fetchProjects = async () => {
      setLoading(true);
      try {
        const data = await api.get<any[]>("/api/projects/");
        if (data && data.length > 0) {
          setProjects(
            data.map((p) => ({
              id: p.id,
              title: p.title,
              description: p.description || "",
              status: p.status || "ACTIVE",
              client_name: p.client_name || "Не указан",
              progress: p.progress || 0,
              task_count: p.task_count || 0,
              done_count: p.done_count || 0,
              deadline: p.deadline || null,
              updated_at: p.updated_at || new Date().toISOString(),
            }))
          );
        } else {
          setProjects(mockProjects);
        }
      } catch {
        setProjects(mockProjects);
      } finally {
        setLoading(false);
      }
    };

    fetchProjects();
  }, []);

  const filteredProjects = useMemo(() => {
    let result = [...projects];

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          p.client_name.toLowerCase().includes(q)
      );
    }

    // Status filter
    if (statusFilter !== "all") {
      result = result.filter((p) => p.status === statusFilter);
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case "name":
          return a.title.localeCompare(b.title, "ru");
        case "status":
          return a.status.localeCompare(b.status);
        case "progress":
          return b.progress - a.progress;
        case "updated":
        default:
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      }
    });

    return result;
  }, [projects, searchQuery, statusFilter, sortBy]);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);

    try {
      const newProject = await api.post<any>("/api/projects/", {
        title: newTitle,
        description: newDescription,
        deadline: newDeadline || null,
        client_email: newClientEmail || null,
      });

      setProjects((prev) => [
        {
          id: newProject.id || `temp-${Date.now()}`,
          title: newTitle,
          description: newDescription,
          status: "DRAFT",
          client_name: newClientEmail || "Не указан",
          progress: 0,
          task_count: 0,
          done_count: 0,
          deadline: newDeadline || null,
          updated_at: new Date().toISOString(),
        },
        ...prev,
      ]);
    } catch {
      // Add locally for demo
      setProjects((prev) => [
        {
          id: `temp-${Date.now()}`,
          title: newTitle,
          description: newDescription,
          status: "DRAFT",
          client_name: newClientEmail || "Не указан",
          progress: 0,
          task_count: 0,
          done_count: 0,
          deadline: newDeadline || null,
          updated_at: new Date().toISOString(),
        },
        ...prev,
      ]);
    } finally {
      setCreating(false);
      setDialogOpen(false);
      setNewTitle("");
      setNewDescription("");
      setNewDeadline("");
      setNewClientEmail("");
    }
  };

  const activeCount = projects.filter((p) => p.status === "ACTIVE").length;
  const totalCount = projects.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Проекты</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {totalCount} проектов &middot; {activeCount} активных
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 shadow-sm">
              <Plus className="h-4 w-4" />
              Новый проект
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Создать проект</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateProject} className="space-y-4 mt-2">
              <div className="space-y-2">
                <Label htmlFor="title">Название *</Label>
                <Input
                  id="title"
                  placeholder="Название проекта"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Описание</Label>
                <Textarea
                  id="description"
                  placeholder="Краткое описание проекта..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="deadline">Дедлайн</Label>
                  <Input
                    id="deadline"
                    type="date"
                    value={newDeadline}
                    onChange={(e) => setNewDeadline(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="client">Email клиента</Label>
                  <Input
                    id="client"
                    type="email"
                    placeholder="client@example.com"
                    value={newClientEmail}
                    onChange={(e) => setNewClientEmail(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
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

      {/* Filters bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Поиск проектов..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-3">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Статус" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все статусы</SelectItem>
              <SelectItem value="DRAFT">Черновик</SelectItem>
              <SelectItem value="ACTIVE">Активен</SelectItem>
              <SelectItem value="ON_HOLD">Приостановлен</SelectItem>
              <SelectItem value="COMPLETED">Завершён</SelectItem>
              <SelectItem value="CANCELLED">Отменён</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[160px]">
              <div className="flex items-center gap-2">
                <ArrowUpDown className="h-3.5 w-3.5" />
                <SelectValue placeholder="Сортировка" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="updated">По дате</SelectItem>
              <SelectItem value="name">По имени</SelectItem>
              <SelectItem value="status">По статусу</SelectItem>
              <SelectItem value="progress">По прогрессу</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Projects grid */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <ProjectCardSkeleton key={i} />
          ))}
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4">
          <div className="rounded-full bg-muted p-6 mb-4">
            <FolderKanban className="h-10 w-10 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-1">
            {searchQuery || statusFilter !== "all"
              ? "Проекты не найдены"
              : "Создайте первый проект"}
          </h3>
          <p className="text-sm text-muted-foreground text-center max-w-sm mb-4">
            {searchQuery || statusFilter !== "all"
              ? "Попробуйте изменить параметры поиска или фильтрации"
              : "Начните работу, создав ваш первый проект в DevSync"}
          </p>
          {!searchQuery && statusFilter === "all" && (
            <Button onClick={() => setDialogOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Создать проект
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredProjects.map((project) => {
            const config = statusConfig[project.status] || {
              label: project.status,
              className: "bg-muted text-muted-foreground border-transparent",
              dot: "bg-muted-foreground",
            };
            const progressPercent =
              project.task_count > 0
                ? Math.round((project.done_count / project.task_count) * 100)
                : project.progress;

            return (
              <Card
                key={project.id}
                className="flex flex-col cursor-pointer group hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
                onClick={() => router.push(`/projects/${project.id}`)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base font-semibold leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                      {project.title}
                    </CardTitle>
                    <Badge
                      variant="outline"
                      className={`shrink-0 text-[11px] font-medium whitespace-nowrap ${config.className}`}
                    >
                      <span className={`mr-1.5 h-1.5 w-1.5 rounded-full inline-block ${config.dot}`} />
                      {config.label}
                    </Badge>
                  </div>
                  {project.description && (
                    <CardDescription className="line-clamp-2 mt-1.5">
                      {project.description}
                    </CardDescription>
                  )}
                </CardHeader>

                <CardContent className="flex-1 pb-4 space-y-3">
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5" />
                      {project.client_name}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <ListTodo className="h-3.5 w-3.5" />
                      {project.done_count}/{project.task_count} задач
                    </span>
                    {project.deadline && (
                      <span className="flex items-center gap-1.5">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {formatDate(project.deadline)}
                      </span>
                    )}
                  </div>

                  {/* Progress */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Прогресс</span>
                      <span className="text-xs font-medium">{progressPercent}%</span>
                    </div>
                    <Progress value={progressPercent} className="h-1.5" />
                  </div>
                </CardContent>

                <CardFooter className="pt-3 border-t text-xs text-muted-foreground">
                  Обновлён {formatRelativeDate(project.updated_at)}
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
