"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, FolderKanban, ListTodo, Clock, Loader2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { api } from "@/lib/api";
import { useLocale } from "@/contexts/locale-context";

interface Project {
  id: string;
  title: string;
  description?: string;
  status: string;
  updatedAt: string;
  tasks?: Task[];
}

interface Task {
  id: string;
  title: string;
  description?: string;
  status: string;
  priority: string;
  projectId: string;
  updatedAt: string;
}

interface Activity {
  id: string;
  type: string;
  description: string;
  projectTitle: string;
  userId: string | null;
  createdAt: string;
}

const projectStatusLabelKeys: Record<string, string> = {
  DRAFT: "search.project_status.draft",
  ACTIVE: "search.project_status.active",
  ON_HOLD: "search.project_status.on_hold",
  COMPLETED: "search.project_status.completed",
  CANCELLED: "search.project_status.cancelled",
};

const projectStatusColors: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  ACTIVE: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  ON_HOLD: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  COMPLETED: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  CANCELLED: "bg-red-500/15 text-red-700 dark:text-red-400",
};

const taskStatusLabelKeys: Record<string, string> = {
  BACKLOG: "search.task_status.backlog",
  TODO: "search.task_status.todo",
  IN_PROGRESS: "search.task_status.in_progress",
  REVIEW: "search.task_status.review",
  DONE: "search.task_status.done",
};

const taskStatusColors: Record<string, string> = {
  BACKLOG: "bg-muted text-muted-foreground",
  TODO: "bg-slate-500/15 text-slate-700 dark:text-slate-400",
  IN_PROGRESS: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  REVIEW: "bg-violet-500/15 text-violet-700 dark:text-violet-400",
  DONE: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
};

const priorityLabelKeys: Record<string, string> = {
  LOW: "search.priority.low",
  MEDIUM: "search.priority.medium",
  HIGH: "search.priority.high",
  CRITICAL: "search.priority.critical",
};

const priorityColors: Record<string, string> = {
  LOW: "bg-slate-500/15 text-slate-600 dark:text-slate-400",
  MEDIUM: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  HIGH: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  CRITICAL: "bg-red-500/15 text-red-600 dark:text-red-400",
};

const activityTypeLabelKeys: Record<string, string> = {
  task_created: "search.activity_type.task_created",
  status_changed: "search.activity_type.status_changed",
  comment: "search.activity_type.comment",
  approval_requested: "search.activity_type.approval_requested",
  approval_reviewed: "search.activity_type.approval_reviewed",
};

const activityTypeColors: Record<string, string> = {
  task_created: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  status_changed: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  comment: "bg-sky-500/15 text-sky-700 dark:text-sky-400",
  approval_requested: "bg-violet-500/15 text-violet-700 dark:text-violet-400",
  approval_reviewed: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
};

function formatRelativeDate(dateStr: string, t: (key: string) => string, locale: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return t('common.today');
    if (diffDays === 1) return t('common.yesterday');
    if (diffDays < 7) return `${diffDays} ${t('common.days_ago')}`;
    return date.toLocaleDateString(locale === 'en' ? 'en-US' : 'ru-RU', { day: "numeric", month: "short" });
  } catch {
    return dateStr;
  }
}

export default function SearchPage() {
  const router = useRouter();
  const { t, locale } = useLocale();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [searched, setSearched] = useState(false);

  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setProjects([]);
      setTasks([]);
      setActivities([]);
      setSearched(false);
      return;
    }

    setLoading(true);
    setSearched(true);
    const q = searchQuery.toLowerCase();

    try {
      // Fetch all projects (API supports search param or we filter client-side)
      const projectsData = await api.get<any[]>("/api/projects/projects");
      const filteredProjects = (projectsData || []).filter(
        (p: any) =>
          p.title?.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q)
      );
      setProjects(filteredProjects);

      // Collect all tasks from projects
      const allTasks: Task[] = [];
      for (const proj of projectsData || []) {
        if (proj.tasks) {
          for (const t of proj.tasks) {
            allTasks.push({
              ...t,
              projectId: proj.id,
            });
          }
        }
      }
      const filteredTasks = allTasks.filter(
        (t) =>
          t.title?.toLowerCase().includes(q) ||
          t.description?.toLowerCase().includes(q)
      );
      setTasks(filteredTasks);

      // Fetch recent activity and filter
      try {
        const activityData = await api.get<Activity[]>("/api/projects/activity/recent?limit=50");
        const filteredActivity = (activityData || []).filter(
          (a) =>
            a.description?.toLowerCase().includes(q) ||
            a.projectTitle?.toLowerCase().includes(q)
        );
        setActivities(filteredActivity);
      } catch {
        setActivities([]);
      }
    } catch {
      setProjects([]);
      setTasks([]);
      setActivities([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch(query);
    }, 400);
    return () => clearTimeout(timer);
  }, [query, performSearch]);

  const totalResults = projects.length + tasks.length + activities.length;

  return (
    <div className="space-y-4 sm:space-y-6 max-w-4xl mx-auto px-0 sm:px-0">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight">{t('search.title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t('search.subtitle')}
        </p>
      </div>

      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          placeholder={t('search.enter_query')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-11 h-10 sm:h-12 text-sm sm:text-base w-full"
          autoFocus
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground animate-spin" />
        )}
      </div>

      {/* Results summary */}
      {searched && !loading && (
        <p className="text-sm text-muted-foreground">
          {totalResults === 0
            ? t('search.no_results')
            : `${t('search.results_count')}: ${totalResults}`}
        </p>
      )}

      {/* Projects section */}
      {projects.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <FolderKanban className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">{t('search.results_projects')}</h2>
            <Badge variant="secondary" className="text-xs">{projects.length}</Badge>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {projects.map((project) => (
              <Card
                key={project.id}
                className="cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
                onClick={() => router.push(`/projects/${project.id}`)}
              >
                <CardHeader className="p-3 sm:p-4 lg:p-6 pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-sm sm:text-base font-semibold">
                      {project.title}
                    </CardTitle>
                    <Badge
                      variant="outline"
                      className={`shrink-0 text-[11px] font-medium ${projectStatusColors[project.status] || ""}`}
                    >
                      {projectStatusLabelKeys[project.status] ? t(projectStatusLabelKeys[project.status]) : project.status}
                    </Badge>
                  </div>
                  {project.description && (
                    <CardDescription className="line-clamp-2 text-xs sm:text-sm">
                      {project.description}
                    </CardDescription>
                  )}
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Tasks section */}
      {tasks.length > 0 && (
        <>
          {projects.length > 0 && <Separator />}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <ListTodo className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold">{t('search.results_tasks')}</h2>
              <Badge variant="secondary" className="text-xs">{tasks.length}</Badge>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {tasks.map((task) => (
                <Card
                  key={task.id}
                  className="cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
                  onClick={() => router.push(`/projects/${task.projectId}`)}
                >
                  <CardHeader className="p-3 sm:p-4 lg:p-6 pb-2">
                    <div className="flex flex-col sm:flex-row items-start justify-between gap-2">
                      <CardTitle className="text-sm sm:text-base font-semibold">
                        {task.title}
                      </CardTitle>
                      <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                        <Badge
                          variant="outline"
                          className={`text-[11px] font-medium ${priorityColors[task.priority] || ""}`}
                        >
                          {priorityLabelKeys[task.priority] ? t(priorityLabelKeys[task.priority]) : task.priority}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={`text-[11px] font-medium ${taskStatusColors[task.status] || ""}`}
                        >
                          {taskStatusLabelKeys[task.status] ? t(taskStatusLabelKeys[task.status]) : task.status}
                        </Badge>
                      </div>
                    </div>
                    {task.description && (
                      <CardDescription className="line-clamp-2 text-xs sm:text-sm">
                        {task.description}
                      </CardDescription>
                    )}
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Activity section */}
      {activities.length > 0 && (
        <>
          {(projects.length > 0 || tasks.length > 0) && <Separator />}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold">{t('search.results_activity')}</h2>
              <Badge variant="secondary" className="text-xs">{activities.length}</Badge>
            </div>
            <div className="grid gap-2">
              {activities.map((activity) => (
                <Card key={activity.id} className="py-0">
                  <CardContent className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 py-2 sm:py-3 px-3 sm:px-4">
                    <Badge
                      variant="outline"
                      className={`shrink-0 text-[11px] font-medium w-fit ${activityTypeColors[activity.type] || ""}`}
                    >
                      {activityTypeLabelKeys[activity.type] ? t(activityTypeLabelKeys[activity.type]) : activity.type}
                    </Badge>
                    <span className="text-xs sm:text-sm flex-1 min-w-0 truncate">
                      {activity.description}
                    </span>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {formatRelativeDate(activity.createdAt, t, locale)}
                    </span>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Empty state */}
      {!searched && !loading && (
        <div className="flex flex-col items-center justify-center py-16 px-4">
          <div className="rounded-full bg-muted p-6 mb-4">
            <Search className="h-10 w-10 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-1">
            {t('search.global_search')}
          </h3>
          <p className="text-sm text-muted-foreground text-center max-w-sm">
            {t('search.start_typing')}
          </p>
        </div>
      )}

      {/* No results state */}
      {searched && !loading && totalResults === 0 && (
        <div className="flex flex-col items-center justify-center py-16 px-4">
          <div className="rounded-full bg-muted p-6 mb-4">
            <Search className="h-10 w-10 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-1">
            {t('search.nothing_found')}
          </h3>
          <p className="text-sm text-muted-foreground text-center max-w-sm">
            {t('search.try_different')}
          </p>
        </div>
      )}
    </div>
  );
}
