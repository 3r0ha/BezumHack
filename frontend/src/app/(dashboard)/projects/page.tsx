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
import { useAuth } from "@/contexts/auth-context";
import { useUsers } from "@/hooks/use-users";
import { useLocale } from "@/contexts/locale-context";
import { toast } from "@/components/ui/use-toast";

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

const statusStyles: Record<string, { className: string; dot: string }> = {
  DRAFT: {
    className: "bg-muted text-muted-foreground border-transparent",
    dot: "bg-muted-foreground",
  },
  ACTIVE: {
    className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
    dot: "bg-emerald-500",
  },
  ON_HOLD: {
    className: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20",
    dot: "bg-amber-500",
  },
  COMPLETED: {
    className: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/20",
    dot: "bg-blue-500",
  },
  CANCELLED: {
    className: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/20",
    dot: "bg-red-500",
  },
};

function formatDate(dateStr: string | null, t: (key: string) => string, locale: string = "ru"): string {
  if (!dateStr) return t('common.not_set');
  try {
    return new Date(dateStr).toLocaleDateString(locale === "en" ? "en-US" : "ru-RU", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function formatRelativeDate(dateStr: string, t: (key: string) => string, locale: string = "ru"): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return t('common.today');
    if (diffDays === 1) return t('common.yesterday');
    if (diffDays < 7) return `${diffDays} ${t('common.days_ago')}`;
    return date.toLocaleDateString(locale === "en" ? "en-US" : "ru-RU", { day: "numeric", month: "short" });
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
  const { user } = useAuth();
  const { getUserName } = useUsers();
  const { t } = useLocale();
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

  useEffect(() => {
    const fetchProjects = async () => {
      setLoading(true);
      try {
        const data = await api.get<any[]>("/api/projects/projects");
        if (data && data.length > 0) {
          setProjects(
            data.map((p) => ({
              id: p.id,
              title: p.title,
              description: p.description || "",
              status: p.status || "DRAFT",
              client_name: getUserName(p.clientId),
              progress: (() => {
                const tasks = p.tasks || [];
                const total = tasks.length;
                const done = tasks.filter((t: any) => t.status === "DONE").length;
                return total > 0 ? Math.round((done / total) * 100) : 0;
              })(),
              task_count: (p.tasks || []).length,
              done_count: (p.tasks || []).filter((t: any) => t.status === "DONE").length,
              deadline: p.deadline || null,
              updated_at: p.updatedAt || new Date().toISOString(),
            }))
          );
        } else {
          setProjects([]);
        }
      } catch {
        setProjects([]);
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
      const newProject = await api.post<any>("/api/projects/projects", {
        title: newTitle,
        description: newDescription,
        deadline: newDeadline || undefined,
        clientId: user?.id,
      });

      setProjects((prev) => [
        {
          id: newProject.id,
          title: newProject.title,
          description: newProject.description || "",
          status: newProject.status || "DRAFT",
          client_name: getUserName(newProject.clientId),
          progress: 0,
          task_count: 0,
          done_count: 0,
          deadline: newProject.deadline || null,
          updated_at: newProject.updatedAt || new Date().toISOString(),
        },
        ...prev,
      ]);
    } catch {
      toast({
        title: t('common.error'),
        description: t('common.error'),
        variant: "destructive",
      });
    } finally {
      setCreating(false);
      setDialogOpen(false);
      setNewTitle("");
      setNewDescription("");
      setNewDeadline("");
    }
  };

  const activeCount = projects.filter((p) => p.status === "ACTIVE").length;
  const totalCount = projects.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('projects.title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {totalCount} {t('projects.title').toLowerCase()} &middot; {activeCount} {t('projects.active')}
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 shadow-sm">
              <Plus className="h-4 w-4" />
              {t('projects.new')}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{t('projects.create_title')}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateProject} className="space-y-4 mt-2">
              <div className="space-y-2">
                <Label htmlFor="title">{t('common.title')} *</Label>
                <Input
                  id="title"
                  placeholder={t('projects.title_placeholder')}
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">{t('common.description')}</Label>
                <Textarea
                  id="description"
                  placeholder={t('common.description') + '...'}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="deadline">{t('common.deadline')}</Label>
                <Input
                  id="deadline"
                  type="date"
                  value={newDeadline}
                  onChange={(e) => setNewDeadline(e.target.value)}
                />
              </div>
              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  {t('common.cancel')}
                </Button>
                <Button type="submit" disabled={!newTitle.trim() || creating}>
                  {creating ? t('ai.creating') : t('common.create')}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 sm:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('projects.search')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-3">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="flex-1 sm:flex-none sm:w-[160px]">
              <SelectValue placeholder={t('common.status')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('projects.all_statuses')}</SelectItem>
              <SelectItem value="DRAFT">{t('projects.status.draft')}</SelectItem>
              <SelectItem value="ACTIVE">{t('projects.status.active')}</SelectItem>
              <SelectItem value="ON_HOLD">{t('projects.status.on_hold')}</SelectItem>
              <SelectItem value="COMPLETED">{t('projects.status.completed')}</SelectItem>
              <SelectItem value="CANCELLED">{t('projects.status.cancelled')}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="flex-1 sm:flex-none sm:w-[160px]">
              <SelectValue placeholder={t('projects.sort_by')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="updated">{t('projects.sort.updated')}</SelectItem>
              <SelectItem value="name">{t('projects.sort.name')}</SelectItem>
              <SelectItem value="status">{t('projects.sort.status')}</SelectItem>
              <SelectItem value="progress">{t('projects.sort.progress')}</SelectItem>
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
              ? t('projects.not_found')
              : t('projects.create_first')}
          </h3>
          <p className="text-sm text-muted-foreground text-center max-w-sm mb-4">
            {searchQuery || statusFilter !== "all"
              ? t('projects.try_change_search')
              : t('projects.create_first_desc')}
          </p>
          {!searchQuery && statusFilter === "all" && (
            <Button onClick={() => setDialogOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              {t('projects.create_title')}
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredProjects.map((project) => {
            const style = statusStyles[project.status] || {
              className: "bg-muted text-muted-foreground border-transparent",
              dot: "bg-muted-foreground",
            };
            const config = {
              label: t(`projects.status.${project.status.toLowerCase()}`),
              className: style.className,
              dot: style.dot,
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
                  <div className="flex items-center gap-4 text-sm text-muted-foreground truncate">
                    <span className="flex items-center gap-1.5 truncate">
                      <Users className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{project.client_name}</span>
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <ListTodo className="h-3.5 w-3.5 shrink-0" />
                      {project.done_count}/{project.task_count} {t('dashboard.tasks_count')}
                    </span>
                    {project.deadline && (
                      <span className="flex items-center gap-1.5">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {formatDate(project.deadline, t)}
                      </span>
                    )}
                  </div>

                  {/* Progress */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">{t('common.progress')}</span>
                      <span className="text-xs font-medium">{progressPercent}%</span>
                    </div>
                    <Progress value={progressPercent} className="h-1.5" />
                  </div>
                </CardContent>

                <CardFooter className="pt-3 border-t text-xs text-muted-foreground">
                  {t('common.updated')} {formatRelativeDate(project.updated_at, t)}
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
