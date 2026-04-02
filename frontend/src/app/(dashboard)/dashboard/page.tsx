"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
  Plus,
  Zap,
  LayoutGrid,
  FileText,
  Video,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/contexts/auth-context";
import { useLocale } from "@/contexts/locale-context";
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

const statusClassNames: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  ACTIVE: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
  ON_HOLD: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20",
  COMPLETED: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/20",
  CANCELLED: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/20",
  active: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
  planning: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/20",
  on_hold: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20",
  completed: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/20",
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

function formatDate(dateStr: string, locale: string = "ru"): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString(locale === "en" ? "en-US" : "ru-RU", {
      day: "numeric",
      month: "short",
    });
  } catch {
    return dateStr;
  }
}

function getTodayFormatted(locale: string = "ru"): string {
  return new Date().toLocaleDateString(locale === "en" ? "en-US" : "ru-RU", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function StatCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-4 sm:p-6">
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
  const { t, locale } = useLocale();
  const router = useRouter();

  // Redirect CLIENT to their portal
  useEffect(() => {
    if (user?.role === "CLIENT") {
      router.replace("/client-portal");
    }
  }, [user?.role, router]);

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<StatCard[]>([]);
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [pendingMeetings, setPendingMeetings] = useState(0);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);

      // Try to load real data
      let projectData: RecentProject[] = [];
      try {
        const projects = await api.get<any[]>("/api/projects/projects");
        if (projects && projects.length > 0) {
          projectData = projects.slice(0, 5).map((p) => {
            const tasks = p.tasks || [];
            const total = tasks.length;
            const done = tasks.filter((t: any) => t.status === "DONE").length;
            return {
              id: p.id,
              title: p.title,
              status: p.status || "DRAFT",
              progress: total > 0 ? Math.round((done / total) * 100) : 0,
              updatedAt: p.updatedAt || new Date().toISOString(),
              taskCount: total,
            };
          });
        }
      } catch {
        // API unavailable, projectData stays empty
      }

      setRecentProjects(projectData);

      // Load real stats from the stats endpoint
      let totalProjects = 0;
      let totalTasks = 0;
      let activeCount = 0;
      let draftCount = 0;
      try {
        const statsData = await api.get<{
          totalProjects: number;
          totalTasks: number;
          byStatus: Record<string, number>;
        }>("/api/projects/projects/stats");
        totalProjects = statsData.totalProjects || 0;
        totalTasks = statsData.totalTasks || 0;
        activeCount = statsData.byStatus?.ACTIVE || 0;
        draftCount = statsData.byStatus?.DRAFT || 0;
      } catch {
        // Fallback: derive active count from loaded projects
        activeCount = projectData.filter(
          (p) => p.status === "ACTIVE" || p.status === "active"
        ).length;
      }

      // Load notifications for activity feed
      let activityItems: ActivityItem[] = [];
      try {
        const notifications = await api.get<any[]>(
          "/api/notifications/notifications?limit=10"
        );
        if (notifications && notifications.length > 0) {
          activityItems = notifications.map((n: any) => {
            let type: ActivityItem["type"] = "task_created";
            const nType = (n.type || "").toLowerCase();
            if (nType.includes("complete")) type = "task_completed";
            else if (nType.includes("status")) type = "status_changed";
            else if (nType.includes("message") || nType.includes("chat")) type = "message_sent";
            else if (nType.includes("pr") || nType.includes("merge")) type = "pr_merged";

            const time = n.createdAt || n.created_at || "";
            let timeFormatted = "";
            try {
              timeFormatted = new Date(time).toLocaleDateString(locale === "en" ? "en-US" : "ru-RU", {
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              });
            } catch {
              timeFormatted = time;
            }

            return {
              id: n.id || String(Math.random()),
              type,
              description: n.message || n.title || n.text || t('notifications.title'),
              time: timeFormatted,
              user: n.userName || n.user_name || n.sender || "",
            };
          });
        }
      } catch {
        // Notifications unavailable
      }

      // If no notifications, try loading from activity endpoint
      if (activityItems.length === 0) {
        try {
          const recentActivity = await api.get<any[]>(
            "/api/projects/activity/recent"
          );
          if (recentActivity && recentActivity.length > 0) {
            activityItems = recentActivity.map((a: any) => {
              let type: ActivityItem["type"] = "task_created";
              const aType = (a.type || "").toLowerCase();
              if (aType.includes("complete")) type = "task_completed";
              else if (aType.includes("status")) type = "status_changed";
              else if (aType.includes("message") || aType.includes("chat")) type = "message_sent";
              else if (aType.includes("pr") || aType.includes("merge")) type = "pr_merged";

              const time = a.createdAt || a.created_at || a.timestamp || "";
              let timeFormatted = "";
              try {
                timeFormatted = new Date(time).toLocaleDateString(locale === "en" ? "en-US" : "ru-RU", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                });
              } catch {
                timeFormatted = time;
              }

              return {
                id: a.id || String(Math.random()),
                type,
                description: a.message || a.description || a.title || t('dashboard.recent_activity'),
                time: timeFormatted,
                user: a.userName || a.user_name || a.user || "",
              };
            });
          }
        } catch {
          // Activity endpoint unavailable
        }
      }

      setActivity(activityItems);

      // Load meetings needing slot vote
      let schedulingCount = 0;
      try {
        const projects = await api.get<any[]>("/api/projects/projects");
        if (projects && projects.length > 0) {
          for (const proj of projects.slice(0, 10)) {
            try {
              const mtgs = await api.get<any[]>(`/api/projects/meetings/project/${proj.id}`);
              schedulingCount += (mtgs || []).filter((m: any) => m.status === "SCHEDULING").length;
            } catch {}
          }
        }
      } catch {}
      setPendingMeetings(schedulingCount);

      setStats([
        {
          title: t('dashboard.active_projects'),
          value: activeCount,
          change: `${totalProjects} ${t('common.all').toLowerCase()}`,
          changeType: "positive",
          icon: FolderKanban,
          iconBg: "bg-blue-500/15",
          iconColor: "text-blue-600 dark:text-blue-400",
        },
        {
          title: t('dashboard.open_tasks'),
          value: totalTasks,
          change: `${draftCount} ${t('projects.status.draft').toLowerCase()}`,
          changeType: "neutral",
          icon: ListTodo,
          iconBg: "bg-amber-500/15",
          iconColor: "text-amber-600 dark:text-amber-400",
        },
        {
          title: t('projects.title'),
          value: totalProjects,
          change: `${activeCount} ${t('projects.active')}`,
          changeType: "positive",
          icon: Clock,
          iconBg: "bg-violet-500/15",
          iconColor: "text-violet-600 dark:text-violet-400",
        },
        {
          title: t('dashboard.notifications'),
          value: activityItems.length,
          change: activityItems.length > 0 ? t('dashboard.recent_activity') : t('notifications.empty'),
          changeType: "neutral",
          icon: MessageSquare,
          iconBg: "bg-emerald-500/15",
          iconColor: "text-emerald-600 dark:text-emerald-400",
        },
      ]);

      setLoading(false);
    };

    loadData();
  }, [locale, t]);

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Welcome banner */}
      <div className="relative overflow-hidden rounded-xl border bg-gradient-to-br from-primary/5 via-primary/3 to-transparent p-4 sm:p-6 lg:p-8">
        <div className="relative z-10">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight">
            {t('dashboard.welcome')}, {user?.name || t('common.user')}!
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
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
          : stats.map((stat) => (
              <Card
                key={stat.title}
                className="group hover:shadow-md transition-all duration-200 hover:-translate-y-0.5"
              >
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <p className="text-xs sm:text-sm font-medium text-muted-foreground">
                        {stat.title}
                      </p>
                      <p className="text-2xl sm:text-3xl font-bold tracking-tight">
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
                      className={`rounded-xl p-2 sm:p-3 ${stat.iconBg} transition-transform group-hover:scale-110`}
                    >
                      <stat.icon className={`h-5 w-5 sm:h-6 sm:w-6 ${stat.iconColor}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
      </div>

      {/* Quick Actions */}
      <div className="grid gap-3 grid-cols-3 sm:grid-cols-6">
        <Link href="/projects">
          <div className="rounded-xl border border-border/40 bg-card p-3 hover:bg-accent/50 transition-colors cursor-pointer group">
            <Plus className="h-4 w-4 text-primary mb-1.5 group-hover:scale-110 transition-transform" />
            <p className="text-xs font-medium">{t('projects.new')}</p>
          </div>
        </Link>
        <Link href="/docs">
          <div className="rounded-xl border border-border/40 bg-card p-3 hover:bg-accent/50 transition-colors cursor-pointer group">
            <FileText className="h-4 w-4 text-primary mb-1.5 group-hover:scale-110 transition-transform" />
            <p className="text-xs font-medium">Документы</p>
          </div>
        </Link>
        <Link href="/meetings">
          <div className="relative rounded-xl border border-border/40 bg-card p-3 hover:bg-accent/50 transition-colors cursor-pointer group">
            <Video className="h-4 w-4 text-primary mb-1.5 group-hover:scale-110 transition-transform" />
            <p className="text-xs font-medium">Встречи</p>
            {pendingMeetings > 0 && (
              <span className="absolute top-2 right-2 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">
                {pendingMeetings}
              </span>
            )}
          </div>
        </Link>
        <Link href="/ai/autopilot">
          <div className="rounded-xl border border-border/40 bg-card p-3 hover:bg-accent/50 transition-colors cursor-pointer group">
            <Zap className="h-4 w-4 text-primary mb-1.5 group-hover:scale-110 transition-transform" />
            <p className="text-xs font-medium">AI Автопилот</p>
          </div>
        </Link>
        <Link href="/chat">
          <div className="rounded-xl border border-border/40 bg-card p-3 hover:bg-accent/50 transition-colors cursor-pointer group">
            <MessageSquare className="h-4 w-4 text-primary mb-1.5 group-hover:scale-110 transition-transform" />
            <p className="text-xs font-medium">{t('nav.chat')}</p>
          </div>
        </Link>
        <Link href="/boards">
          <div className="rounded-xl border border-border/40 bg-card p-3 hover:bg-accent/50 transition-colors cursor-pointer group">
            <LayoutGrid className="h-4 w-4 text-primary mb-1.5 group-hover:scale-110 transition-transform" />
            <p className="text-xs font-medium">{t('nav.boards')}</p>
          </div>
        </Link>
      </div>

      {/* Two-column layout: Recent Projects + Activity */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Recent Projects (wider) */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">
                {t('dashboard.recent_projects')}
              </CardTitle>
              <Link
                href="/projects"
                className="text-sm text-primary hover:text-primary/80 font-medium flex items-center gap-1 transition-colors"
              >
                {t('dashboard.all_projects')}
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
                <p>{t('portal.no_projects')}</p>
              </div>
            ) : (
              <div className="space-y-0">
                {recentProjects.map((project, idx) => {
                  const statusKey = project.status.toLowerCase();
                  const config = {
                    label: t(`projects.status.${statusKey}`) || project.status,
                    className: statusClassNames[project.status] || "bg-muted text-muted-foreground",
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
                            {project.taskCount} {t('dashboard.tasks_count')}
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
              {t('dashboard.recent_activity')}
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
            ) : activity.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p>{t('dashboard.no_activity')}</p>
              </div>
            ) : (
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-3 sm:left-4 top-0 bottom-0 w-px bg-border" />

                <div className="space-y-4">
                  {activity.map((item) => {
                    const Icon = activityIcons[item.type] || PlusCircle;
                    const color = activityColors[item.type] || "text-muted-foreground";
                    return (
                      <div key={item.id} className="relative flex gap-3 pl-0">
                        <div
                          className={`relative z-10 flex h-6 w-6 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-full border bg-background ${color}`}
                        >
                          <Icon className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
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
