"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  FolderKanban,
  ListTodo,
  Clock,
  MessageSquare,
  TrendingUp,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  PlusCircle,
  GitPullRequest,
  MessageCircle,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/contexts/auth-context";
import { api } from "@/lib/api";

interface StatCard {
  title: string;
  value: number;
  change: string;
  changeType: "positive" | "neutral";
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
}

interface RecentProject {
  id: string;
  title: string;
  status: string;
  progress: number;
  updatedAt: string;
  taskCount: number;
}

interface ActivityItem {
  id: string;
  type: "task_created" | "status_changed" | "message_sent" | "task_completed" | "pr_merged";
  description: string;
  time: string;
  user: string;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  DRAFT: { label: "Черновик", className: "bg-muted text-muted-foreground" },
  ACTIVE: { label: "Активен", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20" },
  ON_HOLD: { label: "Приостановлен", className: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20" },
  COMPLETED: { label: "Завершён", className: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/20" },
  CANCELLED: { label: "Отменён", className: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/20" },
  active: { label: "Активен", className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20" },
  planning: { label: "Планирование", className: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/20" },
  on_hold: { label: "Приостановлен", className: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20" },
  completed: { label: "Завершён", className: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/20" },
};

const activityIcons: Record<string, React.ElementType> = {
  task_created: PlusCircle,
  status_changed: GitPullRequest,
  message_sent: MessageCircle,
  task_completed: CheckCircle2,
  pr_merged: GitPullRequest,
};

const activityColors: Record<string, string> = {
  task_created: "text-blue-500",
  status_changed: "text-amber-500",
  message_sent: "text-violet-500",
  task_completed: "text-emerald-500",
  pr_merged: "text-purple-500",
};

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "short",
    });
  } catch {
    return dateStr;
  }
}

function getTodayFormatted(): string {
  return new Date().toLocaleDateString("ru-RU", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

const mockRecentProjects: RecentProject[] = [
  {
    id: "1",
    title: "Мобильное приложение для доставки",
    status: "ACTIVE",
    progress: 68,
    updatedAt: "2026-03-24T10:30:00Z",
    taskCount: 24,
  },
  {
    id: "2",
    title: "CRM система для отдела продаж",
    status: "ACTIVE",
    progress: 45,
    updatedAt: "2026-03-23T16:15:00Z",
    taskCount: 18,
  },
  {
    id: "3",
    title: "Редизайн корпоративного сайта",
    status: "ON_HOLD",
    progress: 82,
    updatedAt: "2026-03-22T09:00:00Z",
    taskCount: 12,
  },
  {
    id: "4",
    title: "API интеграция с платёжной системой",
    status: "ACTIVE",
    progress: 30,
    updatedAt: "2026-03-21T14:45:00Z",
    taskCount: 8,
  },
  {
    id: "5",
    title: "Микросервис уведомлений",
    status: "DRAFT",
    progress: 5,
    updatedAt: "2026-03-20T11:00:00Z",
    taskCount: 3,
  },
];

const mockActivity: ActivityItem[] = [
  {
    id: "a1",
    type: "task_completed",
    description: "Задача \"Интеграция OAuth 2.0\" завершена",
    time: "15 мин назад",
    user: "Алексей К.",
  },
  {
    id: "a2",
    type: "message_sent",
    description: "Новое сообщение в проекте \"CRM система\"",
    time: "1 час назад",
    user: "Мария С.",
  },
  {
    id: "a3",
    type: "task_created",
    description: "Создана задача \"Оптимизация запросов к БД\"",
    time: "2 часа назад",
    user: "Дмитрий В.",
  },
  {
    id: "a4",
    type: "status_changed",
    description: "Проект \"Редизайн сайта\" переведён в статус \"Приостановлен\"",
    time: "3 часа назад",
    user: "Анна П.",
  },
  {
    id: "a5",
    type: "task_created",
    description: "Создана задача \"Настройка CI/CD пайплайна\"",
    time: "5 часов назад",
    user: "Алексей К.",
  },
  {
    id: "a6",
    type: "task_completed",
    description: "Задача \"Миграция базы данных\" завершена",
    time: "Вчера",
    user: "Дмитрий В.",
  },
];

function StatCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-12 w-12 rounded-xl" />
        </div>
      </CardContent>
    </Card>
  );
}

function ProjectRowSkeleton() {
  return (
    <div className="flex items-center gap-4 py-3">
      <Skeleton className="h-4 flex-1 max-w-[200px]" />
      <Skeleton className="h-5 w-20" />
      <Skeleton className="h-2 w-24" />
      <Skeleton className="h-4 w-16" />
    </div>
  );
}

export default function DashboardHome() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<StatCard[]>([]);
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);
  const [activity] = useState<ActivityItem[]>(mockActivity);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);

      // Try to load real data, fall back to mock
      let projectData: RecentProject[] = mockRecentProjects;
      try {
        const projects = await api.get<any[]>("/api/projects/");
        if (projects && projects.length > 0) {
          projectData = projects.slice(0, 5).map((p) => ({
            id: p.id,
            title: p.title,
            status: p.status || "ACTIVE",
            progress: p.progress || 0,
            updatedAt: p.updated_at || new Date().toISOString(),
            taskCount: p.task_count || 0,
          }));
        }
      } catch {
        // Use mock data
      }

      setRecentProjects(projectData);

      const activeCount = projectData.filter(
        (p) => p.status === "ACTIVE" || p.status === "active"
      ).length;

      setStats([
        {
          title: "Активные проекты",
          value: activeCount || 3,
          change: "+2 за месяц",
          changeType: "positive",
          icon: FolderKanban,
          iconBg: "bg-blue-500/15",
          iconColor: "text-blue-600 dark:text-blue-400",
        },
        {
          title: "Открытые задачи",
          value: 24,
          change: "8 высокий приоритет",
          changeType: "neutral",
          icon: ListTodo,
          iconBg: "bg-amber-500/15",
          iconColor: "text-amber-600 dark:text-amber-400",
        },
        {
          title: "В работе",
          value: 7,
          change: "+3 за неделю",
          changeType: "positive",
          icon: Clock,
          iconBg: "bg-violet-500/15",
          iconColor: "text-violet-600 dark:text-violet-400",
        },
        {
          title: "Непрочитанные сообщения",
          value: 12,
          change: "5 упоминаний",
          changeType: "neutral",
          icon: MessageSquare,
          iconBg: "bg-emerald-500/15",
          iconColor: "text-emerald-600 dark:text-emerald-400",
        },
      ]);

      setLoading(false);
    };

    loadData();
  }, []);

  return (
    <div className="space-y-8">
      {/* Welcome banner */}
      <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-primary/5 via-primary/3 to-transparent p-6 lg:p-8">
        <div className="relative z-10">
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">
            Добро пожаловать, {user?.name || "Пользователь"}!
          </h1>
          <p className="mt-2 text-muted-foreground flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            {getTodayFormatted()}
          </p>
        </div>
        {/* Decorative circles */}
        <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-primary/5" />
        <div className="absolute -right-4 -bottom-4 h-24 w-24 rounded-full bg-primary/3" />
      </div>

      {/* Stats grid */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
          : stats.map((stat) => (
              <Card
                key={stat.title}
                className="group hover:shadow-md transition-all duration-200 hover:-translate-y-0.5"
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">
                        {stat.title}
                      </p>
                      <p className="text-3xl font-bold tracking-tight">
                        {stat.value}
                      </p>
                      <div className="flex items-center gap-1 text-xs">
                        {stat.changeType === "positive" && (
                          <TrendingUp className="h-3 w-3 text-emerald-500" />
                        )}
                        <span
                          className={
                            stat.changeType === "positive"
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-muted-foreground"
                          }
                        >
                          {stat.change}
                        </span>
                      </div>
                    </div>
                    <div
                      className={`rounded-xl p-3 ${stat.iconBg} transition-transform group-hover:scale-110`}
                    >
                      <stat.icon className={`h-6 w-6 ${stat.iconColor}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
      </div>

      {/* Two-column layout: Recent Projects + Activity */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Recent Projects (wider) */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">
                Последние проекты
              </CardTitle>
              <Link
                href="/projects"
                className="text-sm text-primary hover:text-primary/80 font-medium flex items-center gap-1 transition-colors"
              >
                Все проекты
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <ProjectRowSkeleton key={i} />
                ))}
              </div>
            ) : recentProjects.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FolderKanban className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p>Нет проектов</p>
              </div>
            ) : (
              <div className="space-y-0">
                {recentProjects.map((project, idx) => {
                  const config = statusConfig[project.status] || {
                    label: project.status,
                    className: "bg-muted text-muted-foreground",
                  };
                  return (
                    <div key={project.id}>
                      {idx > 0 && <Separator />}
                      <Link
                        href={`/projects/${project.id}`}
                        className="flex items-center gap-4 py-3 px-2 -mx-2 rounded-lg hover:bg-accent/50 transition-colors group"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                            {project.title}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {project.taskCount} задач
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className={`shrink-0 text-[11px] font-medium ${config.className}`}
                        >
                          {config.label}
                        </Badge>
                        <div className="hidden sm:flex items-center gap-2 shrink-0 w-32">
                          <Progress
                            value={project.progress}
                            className="h-1.5 flex-1"
                          />
                          <span className="text-xs font-medium text-muted-foreground w-8 text-right">
                            {project.progress}%
                          </span>
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0 hidden md:block w-20 text-right">
                          {formatDate(project.updatedAt)}
                        </span>
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">
              Последняя активность
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex gap-3">
                    <Skeleton className="h-8 w-8 rounded-full shrink-0" />
                    <div className="space-y-1.5 flex-1">
                      <Skeleton className="h-3.5 w-full" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />

                <div className="space-y-4">
                  {activity.map((item) => {
                    const Icon = activityIcons[item.type] || PlusCircle;
                    const color = activityColors[item.type] || "text-muted-foreground";
                    return (
                      <div key={item.id} className="relative flex gap-3 pl-0">
                        <div
                          className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-background ${color}`}
                        >
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                        <div className="flex-1 min-w-0 pt-0.5">
                          <p className="text-sm leading-snug">
                            {item.description}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-muted-foreground">
                              {item.user}
                            </span>
                            <span className="text-xs text-muted-foreground/50">
                              &middot;
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {item.time}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
