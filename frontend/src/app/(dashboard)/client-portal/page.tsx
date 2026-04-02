"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Eye,
  CheckCircle2,
  Clock,
  AlertTriangle,
  TrendingUp,
  FileText,
  MessageSquare,
  Activity,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { useUsers } from "@/hooks/use-users";
import { useLocale } from "@/contexts/locale-context";

interface ProjectSummary {
  id: string;
  title: string;
  status: string;
  deadline: string | null;
  totalTasks: number;
  doneTasks: number;
  inProgressTasks: number;
  progress: number;
  totalHours: number;
  actualHours: number;
  pendingApprovals: number;
}

interface ActivityItem {
  description: string;
  createdAt: string;
}

function formatRelativeTime(dateStr: string): string {
  try {
    const now = Date.now();
    const date = new Date(dateStr).getTime();
    const diffMs = now - date;
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "только что";
    if (diffMin < 60) return `${diffMin} мин назад`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours} ч назад`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return "вчера";
    if (diffDays < 7) return `${diffDays} дн назад`;
    return new Date(dateStr).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
  } catch {
    return dateStr;
  }
}

const portalStatusColors: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  ACTIVE: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  ON_HOLD: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  COMPLETED: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  CANCELLED: "bg-red-500/15 text-red-700 dark:text-red-400",
};

function formatDate(dateStr: string | null, t: (key: string) => string, locale: string = "ru"): string {
  if (!dateStr) return t('common.not_set');
  return new Date(dateStr).toLocaleDateString(locale === "en" ? "en-US" : "ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function daysUntilDeadline(deadline: string | null): number | null {
  if (!deadline) return null;
  const diff = new Date(deadline).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export default function ClientPortalPage() {
  const { user } = useAuth();
  const { getUserName } = useUsers();
  const { t } = useLocale();
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await api.get<any[]>("/api/projects/projects");
        if (data && data.length > 0) {
          const mappedRaw = data.map((p) => {
              const tasks = p.tasks || [];
              const doneTasks = tasks.filter((t: any) => t.status === "DONE").length;
              const inProgressTasks = tasks.filter((t: any) => t.status === "IN_PROGRESS").length;
              return {
                id: p.id,
                title: p.title,
                status: p.status,
                deadline: p.deadline,
                totalTasks: tasks.length,
                doneTasks,
                inProgressTasks,
                progress: tasks.length > 0 ? Math.round((doneTasks / tasks.length) * 100) : 0,
                totalHours: tasks.reduce((s: number, t: any) => s + (t.estimatedHours || 0), 0),
                actualHours: tasks.reduce((s: number, t: any) => s + (t.actualHours || 0), 0),
                pendingApprovals: 0,
              };
            });
          const mapped: ProjectSummary[] = mappedRaw;
          for (const proj of mapped) {
            try {
              const approvals = await api.get<any[]>(`/api/projects/approvals/project/${proj.id}`);
              proj.pendingApprovals = (approvals || []).filter((a: any) => a.status === "PENDING").length;
            } catch {}
          }
          setProjects(mapped);
        } else {
          setProjects([]);
        }
      } catch {
        setProjects([]);
      }

      // Load recent activity
      try {
        const activityData = await api.get<any[]>("/api/projects/activity/recent?limit=5");
        if (activityData && activityData.length > 0) {
          setActivities(
            activityData.map((a: any) => ({
              description: a.description || a.message || a.title || "",
              createdAt: a.createdAt || a.created_at || a.timestamp || "",
            }))
          );
        }
      } catch {
        // Activity endpoint unavailable
      }

      setLoading(false);
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-[300px]" />
          <Skeleton className="h-[300px]" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white">
          <Eye className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">{t('portal.title')}</h1>
          <p className="text-sm text-muted-foreground">
            {t('dashboard.welcome')}, {user?.name}. {t('portal.welcome')}
          </p>
        </div>
      </div>

      {/* Projects */}
      {projects.map((project) => {
        const config = {
          label: t(`projects.status.${project.status.toLowerCase()}`),
          color: portalStatusColors[project.status] || portalStatusColors.ACTIVE,
        };
        const daysLeft = daysUntilDeadline(project.deadline);
        const isOverdue = daysLeft !== null && daysLeft < 0;
        const isUrgent = daysLeft !== null && daysLeft >= 0 && daysLeft <= 7;

        return (
          <Card key={project.id} className="overflow-hidden">
            <CardHeader className="p-4 sm:p-6 pb-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-xl">{project.title}</CardTitle>
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3 mt-2">
                    <Badge className={config.color}>{config.label}</Badge>
                    {project.deadline && (
                      <>
                        <span className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1">
                          {t('common.deadline') + ':'} {formatDate(project.deadline, t)}
                        </span>
                        {isOverdue && (
                          <Badge variant="outline" className="bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30 gap-1 font-semibold">
                            <AlertTriangle className="h-3 w-3" />
                            Просрочен на {Math.abs(daysLeft!)} дн
                          </Badge>
                        )}
                        {isUrgent && (
                          <Badge variant="outline" className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 gap-1 font-semibold animate-pulse">
                            <Clock className="h-3 w-3" />
                            {daysLeft} дн до дедлайна
                          </Badge>
                        )}
                      </>
                    )}
                  </div>
                </div>
                {project.pendingApprovals > 0 && (
                  <Link href="/approvals">
                    <Badge variant="outline" className="bg-violet-500/10 text-violet-700 dark:text-violet-400 gap-1 hover:bg-violet-500/20 transition-colors cursor-pointer">
                      <FileText className="h-3 w-3" />
                      {project.pendingApprovals} {t('portal.pending_approvals')}
                    </Badge>
                  </Link>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0 space-y-4 sm:space-y-6">
              {/* Progress bar */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">{t('portal.overall_progress')}</span>
                  <span className="text-xl sm:text-2xl font-bold">{project.progress}%</span>
                </div>
                <Progress value={project.progress} className="h-3" />
              </div>

              <Separator />

              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-4 items-start">
                <div className="space-y-1">
                  <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    {t('portal.completed')}
                  </p>
                  <p className="text-xl sm:text-2xl font-bold">
                    {project.doneTasks}
                    <span className="text-xs sm:text-sm font-normal text-muted-foreground">
                      /{project.totalTasks}
                    </span>
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-amber-500" />
                    {t('portal.in_progress')}
                  </p>
                  <p className="text-xl sm:text-2xl font-bold">{project.inProgressTasks}</p>
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1.5">
                    <TrendingUp className="h-3.5 w-3.5 text-blue-500" />
                    {t('portal.hours_spent')}
                  </p>
                  <p className="text-lg sm:text-xl font-bold">
                    Затрачено {project.actualHours} из {project.totalHours} ч
                    <span className="text-xs sm:text-sm font-normal text-muted-foreground ml-1.5">
                      ({Math.round((project.actualHours / Math.max(project.totalHours, 1)) * 100)}%)
                    </span>
                  </p>
                  <Progress
                    value={Math.round((project.actualHours / Math.max(project.totalHours, 1)) * 100)}
                    className="h-1.5 mt-1"
                  />
                </div>
              </div>

              {/* Recent Activity */}
              {activities.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-1.5">
                    <Activity className="h-3.5 w-3.5" />
                    {t('dashboard.recent_activity')}
                  </h3>
                  {activities.slice(0, 3).map((a, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <div className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                      <span className="truncate">{a.description}</span>
                      <span className="ml-auto shrink-0">{formatRelativeTime(a.createdAt)}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Task status breakdown */}
              <div className="flex items-center gap-1 h-4 rounded-full overflow-hidden bg-muted">
                {project.doneTasks > 0 && (
                  <div
                    className="h-full bg-emerald-500 rounded-l-full transition-all"
                    style={{
                      width: `${(project.doneTasks / project.totalTasks) * 100}%`,
                    }}
                  />
                )}
                {project.inProgressTasks > 0 && (
                  <div
                    className="h-full bg-amber-400 transition-all"
                    style={{
                      width: `${(project.inProgressTasks / project.totalTasks) * 100}%`,
                    }}
                  />
                )}
                <div className="h-full flex-1" />
              </div>
              <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  {t('portal.done')} ({project.doneTasks})
                </span>
                <span className="flex items-center gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                  {t('portal.in_progress')} ({project.inProgressTasks})
                </span>
                <span className="flex items-center gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />
                  {t('portal.waiting')} ({project.totalTasks - project.doneTasks - project.inProgressTasks})
                </span>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {projects.length === 0 && (
        <div className="text-center py-16">
          <Eye className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
          <h3 className="text-lg font-semibold mb-1">{t('portal.no_projects')}</h3>
          <p className="text-sm text-muted-foreground">
            {t('portal.no_projects_desc')}
          </p>
        </div>
      )}
    </div>
  );
}
