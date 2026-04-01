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
  Trash2,
  Loader2,
  Layers,
  FileText,
  Video,
  CheckCircle,
  GitBranch,
  Zap,
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
import { useUsers } from "@/hooks/use-users";
import { toast } from "@/components/ui/use-toast";
import { useLocale } from "@/contexts/locale-context";

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

const kanbanColumnKeys = [
  { key: "backlog", labelKey: "tasks.status.backlog", color: "bg-muted-foreground/20" },
  { key: "todo", labelKey: "tasks.status.todo", color: "bg-blue-500/20" },
  { key: "in_progress", labelKey: "tasks.status.in_progress", color: "bg-amber-500/20" },
  { key: "review", labelKey: "tasks.status.review", color: "bg-violet-500/20" },
  { key: "done", labelKey: "tasks.status.done", color: "bg-emerald-500/20" },
];

function getKanbanColumns(t: (key: string) => string) {
  return kanbanColumnKeys.map((col) => ({
    key: col.key,
    label: t(col.labelKey),
    color: col.color,
  }));
}

const priorityConfigStyles: Record<string, { className: string; order: number; labelKey: string }> = {
  critical: {
    className: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/20",
    order: 0,
    labelKey: "tasks.priority.critical",
  },
  high: {
    className: "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/20",
    order: 1,
    labelKey: "tasks.priority.high",
  },
  medium: {
    className: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20",
    order: 2,
    labelKey: "tasks.priority.medium",
  },
  low: {
    className: "bg-muted text-muted-foreground border-transparent",
    order: 3,
    labelKey: "tasks.priority.low",
  },
};

function getPriorityConfig(t: (key: string) => string) {
  const result: Record<string, { label: string; className: string; order: number }> = {};
  for (const [key, val] of Object.entries(priorityConfigStyles)) {
    result[key] = { label: t(val.labelKey), className: val.className, order: val.order };
  }
  return result;
}

const statusConfigStyles: Record<string, { className: string; labelKey: string }> = {
  DRAFT: { className: "bg-muted text-muted-foreground", labelKey: "projects.status.draft" },
  ACTIVE: { className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20", labelKey: "projects.status.active" },
  ON_HOLD: { className: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20", labelKey: "projects.status.on_hold" },
  COMPLETED: { className: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/20", labelKey: "projects.status.completed" },
  CANCELLED: { className: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/20", labelKey: "projects.status.cancelled" },
};

function getStatusConfig(t: (key: string) => string) {
  const result: Record<string, { label: string; className: string }> = {};
  for (const [key, val] of Object.entries(statusConfigStyles)) {
    result[key] = { label: t(val.labelKey), className: val.className };
  }
  return result;
}


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
          <Skeleton className="h-7 w-48 sm:w-64" />
          <Skeleton className="h-4 w-64 sm:w-96" />
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
  resolveUser,
  t,
}: {
  task: Task;
  allTasks: Task[];
  onClick: () => void;
  resolveUser: (id: string | null) => string;
  t: (key: string) => string;
}) {
  const blocked = getBlockedBy(task, allTasks);
  const isBlocked = blocked.length > 0;
  const priorityConfig = getPriorityConfig(t);
  const priority = priorityConfig[task.priority] || priorityConfig.medium;
  const assigneeName = task.assignee ? resolveUser(task.assignee) : null;
  const assigneeInitials = assigneeName
    ? assigneeName.split(/\s+/).map((w: string) => w[0]).join("").toUpperCase().slice(0, 2)
    : null;

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData("text/plain", task.id);
    e.dataTransfer.effectAllowed = "move";
    (e.target as HTMLElement).style.opacity = "0.5";
  };

  const handleDragEnd = (e: React.DragEvent) => {
    (e.target as HTMLElement).style.opacity = "1";
  };

  return (
    <div
      onClick={onClick}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      className={`
        group rounded-lg border bg-card p-3.5 cursor-grab active:cursor-grabbing
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
                <p>{t('tasks.blocked')}: {blocked.map((b) => b.title).join(", ")}</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>
        {assigneeName && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Avatar className="h-6 w-6">
                <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                  {assigneeInitials}
                </AvatarFallback>
              </Avatar>
            </TooltipTrigger>
            <TooltipContent>
              <p>{assigneeName}</p>
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
  onTaskDrop,
  resolveUser,
  t,
}: {
  column: { key: string; label: string; color: string };
  tasks: Task[];
  allTasks: Task[];
  onTaskClick: (task: Task) => void;
  onTaskDrop: (taskId: string, newStatus: string) => void;
  resolveUser: (id: string | null) => string;
  t: (key: string) => string;
}) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const taskId = e.dataTransfer.getData("text/plain");
    if (taskId) {
      onTaskDrop(taskId, column.key);
    }
  };

  return (
    <div
      className={`flex flex-col min-w-[220px] sm:min-w-[260px] max-w-[320px] flex-1 rounded-lg transition-colors ${
        isDragOver ? "bg-primary/5 ring-2 ring-primary/20" : ""
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
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
              resolveUser={resolveUser}
              t={t}
            />
          ))}
          {tasks.length === 0 && (
            <div className={`rounded-lg border border-dashed p-4 text-center ${isDragOver ? "border-primary" : ""}`}>
              <p className="text-xs text-muted-foreground">
                {isDragOver ? t('tasks.drop_here') : t('tasks.no_tasks')}
              </p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// --- Dependencies Tab ---

function DependenciesTab({ tasks, t }: { tasks: Task[]; t: (key: string) => string }) {
  const circularIds = useMemo(() => detectCircularDeps(tasks), [tasks]);
  const taskMap = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);

  const tasksWithDeps = tasks.filter(
    (t) => t.depends_on.length > 0 || getBlocks(t.id, tasks).length > 0
  );

  if (tasksWithDeps.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">{t('tasks.no_deps')}</p>
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
                {t('tasks.circular_deps')}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t('tasks.circular_deps_marked')}
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

          const pc = getPriorityConfig(t);
          const priority = pc[task.priority] || pc.medium;

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
                        {t('tasks.cycle')}
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
                        {t('tasks.depends_on')}
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
                        {t('tasks.blocks')}
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
  onDelete,
  t,
}: {
  project: Project;
  onUpdate: (p: Partial<Project>) => void;
  onDelete: () => void;
  t: (key: string) => string;
}) {
  const [title, setTitle] = useState(project.title);
  const [description, setDescription] = useState(project.description);
  const [status, setStatus] = useState(project.status);
  const [deadline, setDeadline] = useState(project.deadline || "");
  const [manager, setManager] = useState(project.manager || "");
  const [hourlyRate, setHourlyRate] = useState(String((project as any).hourlyRate || ""));
  const [saving, setSaving] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.patch(`/api/projects/projects/${project.id}`, {
        title,
        description,
        status,
        deadline: deadline || null,
        managerId: manager || null,
        hourlyRate: hourlyRate ? parseFloat(hourlyRate) : null,
      });
    } catch (err) {
      toast({ title: t('common.error'), description: err instanceof Error ? err.message : t('projects.save_error'), variant: "destructive" });
    }
    onUpdate({ title, description, status, deadline: deadline || null, manager: manager || null });
    setSaving(false);
  };

  return (
    <form onSubmit={handleSave} className="w-full max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('projects.settings')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="proj-title">{t('projects.project_title')}</Label>
            <Input
              id="proj-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="proj-desc">{t('common.description')}</Label>
            <Textarea
              id="proj-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('common.status')}</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DRAFT">{t('projects.status.draft')}</SelectItem>
                  <SelectItem value="ACTIVE">{t('projects.status.active')}</SelectItem>
                  <SelectItem value="ON_HOLD">{t('projects.status.on_hold')}</SelectItem>
                  <SelectItem value="COMPLETED">{t('projects.status.completed')}</SelectItem>
                  <SelectItem value="CANCELLED">{t('projects.status.cancelled')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="proj-deadline">{t('common.deadline')}</Label>
              <Input
                id="proj-deadline"
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="proj-manager">{t('projects.manager')}</Label>
              <Input
                id="proj-manager"
                value={manager}
                onChange={(e) => setManager(e.target.value)}
                placeholder={t('projects.manager_placeholder')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="proj-rate">{t('projects.hourly_rate')}</Label>
              <Input
                id="proj-rate"
                type="number"
                min="0"
                value={hourlyRate}
                onChange={(e) => setHourlyRate(e.target.value)}
                placeholder="4000"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? t('tasks.saving') : t('projects.save_changes')}
        </Button>
      </div>

      <Separator />

      <Card className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-base text-destructive">{t('projects.danger_zone')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            {t('projects.delete_irreversible')}
          </p>
          <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
            <DialogTrigger asChild>
              <Button variant="destructive" className="gap-2">
                <Trash2 className="h-4 w-4" />
                {t('projects.delete')}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>{t('projects.delete_confirm_title')}</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">
                {t('projects.delete_confirm')}
              </p>
              <DialogFooter className="pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDeleteConfirmOpen(false)}
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={deleting}
                  onClick={async () => {
                    setDeleting(true);
                    try {
                      await api.delete(`/api/projects/projects/${project.id}`);
                      setDeleteConfirmOpen(false);
                      onDelete();
                    } catch (err) {
                      toast({ title: t('common.error'), description: err instanceof Error ? err.message : t('projects.delete_error'), variant: "destructive" });
                    } finally {
                      setDeleting(false);
                    }
                  }}
                >
                  {deleting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t('projects.deleting')}
                    </>
                  ) : (
                    t('common.delete')
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>
    </form>
  );
}

// --- Task Edit Dialog ---

function TaskEditDialog({
  task,
  allTasks,
  allUsers,
  getUserName,
  onClose,
  onSave,
  t,
}: {
  task: Task | null;
  allTasks: Task[];
  allUsers: { id: string; name: string }[];
  getUserName: (id: string | null) => string;
  onClose: () => void;
  onSave: (task: Task) => void;
  t: (key: string) => string;
}) {
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPriority, setEditPriority] = useState("medium");
  const [editStatus, setEditStatus] = useState("backlog");
  const [editAssignee, setEditAssignee] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (task) {
      setEditTitle(task.title);
      setEditDescription(task.description);
      setEditPriority(task.priority);
      setEditStatus(task.status);
      setEditAssignee(task.assignee || "");
    }
  }, [task]);

  const handleSaveTask = async () => {
    if (!task) return;
    setSaving(true);
    try {
      await api.patch(`/api/projects/tasks/${task.id}`, {
        title: editTitle,
        description: editDescription,
        priority: editPriority.toUpperCase(),
        status: editStatus.toUpperCase(),
        assigneeId: editAssignee || null,
      });
      onSave({
        ...task,
        title: editTitle,
        description: editDescription,
        priority: editPriority,
        status: editStatus,
        assignee: editAssignee || null,
      });
    } catch (err) {
      toast({ title: t('common.error'), description: err instanceof Error ? err.message : t('projects.task_save_error'), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={!!task}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        {task && (
          <>
            <DialogHeader>
              <DialogTitle>{t('tasks.edit')}</DialogTitle>
            </DialogHeader>

            <div className="space-y-4 mt-2">
              <div className="space-y-2">
                <Label htmlFor="edit-task-title">{t('common.title')}</Label>
                <Input
                  id="edit-task-title"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-task-desc">{t('common.description')}</Label>
                <Textarea
                  id="edit-task-desc"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('tasks.priority')}</Label>
                  <Select value={editPriority} onValueChange={setEditPriority}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">{t('tasks.priority.low')}</SelectItem>
                      <SelectItem value="medium">{t('tasks.priority.medium')}</SelectItem>
                      <SelectItem value="high">{t('tasks.priority.high')}</SelectItem>
                      <SelectItem value="critical">{t('tasks.priority.critical')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t('common.status')}</Label>
                  <Select value={editStatus} onValueChange={setEditStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {getKanbanColumns(t).map((col) => (
                        <SelectItem key={col.key} value={col.key}>
                          {col.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t('tasks.assignee')}</Label>
                <Select value={editAssignee} onValueChange={setEditAssignee}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('tasks.unassigned')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">{t('tasks.unassigned')}</SelectItem>
                    {allUsers.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {task.depends_on.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                      {t('tasks.dependencies')}
                    </Label>
                    <div className="mt-2 space-y-1.5">
                      {task.depends_on.map((depId) => {
                        const dep = allTasks.find((t) => t.id === depId);
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

              {getBlocks(task.id, allTasks).length > 0 && (
                <>
                  <Separator />
                  <div>
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                      {t('tasks.blocks')}
                    </Label>
                    <div className="mt-2 space-y-1.5">
                      {getBlocks(task.id, allTasks).map((blocked) => (
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

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={onClose}>
                {t('common.cancel')}
              </Button>
              <Button
                type="button"
                disabled={!editTitle.trim() || saving}
                onClick={handleSaveTask}
              >
                {saving ? t('tasks.saving') : t('common.save')}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// --- Epochs Tab ---

function EpochsTab({ projectId, router }: { projectId: string; router: any }) {
  const [epochs, setEpochs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", startDate: "", endDate: "", goals: "" });

  useEffect(() => { loadEpochs(); }, [projectId]);

  async function loadEpochs() {
    setLoading(true);
    try {
      const data = await api.get<any[]>(`/api/projects/epochs/project/${projectId}`);
      setEpochs(data || []);
    } catch { setEpochs([]); }
    finally { setLoading(false); }
  }

  async function handleCreate() {
    if (!form.title || !form.startDate || !form.endDate) return;
    setCreating(true);
    try {
      await api.post("/api/projects/epochs", {
        title: form.title,
        description: form.description || null,
        projectId,
        startDate: form.startDate,
        endDate: form.endDate,
        goals: form.goals ? form.goals.split("\n").filter(Boolean) : [],
      });
      setCreateOpen(false);
      setForm({ title: "", description: "", startDate: "", endDate: "", goals: "" });
      await loadEpochs();
    } catch {} finally { setCreating(false); }
  }

  const epochStatusColor: Record<string, string> = {
    PLANNED: "bg-muted text-muted-foreground",
    ACTIVE: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
    COMPLETED: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    CANCELLED: "bg-red-100 text-red-700",
  };

  if (loading) return <div className="space-y-3">{[1,2].map(i => <Skeleton key={i} className="h-32 w-full" />)}</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Создать эпоху
        </Button>
      </div>

      {epochs.length === 0 ? (
        <div className="text-center py-12">
          <Layers className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
          <p className="text-muted-foreground">Эпох пока нет. Создайте первый спринт.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {epochs.map(epoch => (
            <Card key={epoch.id}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold">{epoch.title}</h3>
                      <Badge className={`${epochStatusColor[epoch.status]} text-xs`}>{epoch.status}</Badge>
                    </div>
                    {epoch.description && <p className="text-sm text-muted-foreground mb-2">{epoch.description}</p>}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground mb-3">
                      <span>{new Date(epoch.startDate).toLocaleDateString("ru")} — {new Date(epoch.endDate).toLocaleDateString("ru")}</span>
                      <span className="flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" />
                        {epoch.doneCount}/{epoch.taskCount} задач
                      </span>
                      <span className="flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        {epoch.documents?.length || 0} документов
                      </span>
                      <span className="flex items-center gap-1">
                        <Video className="h-3 w-3" />
                        {epoch.meetings?.length || 0} встреч
                      </span>
                    </div>
                    {/* Progress bar */}
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${epoch.progress || 0}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{epoch.progress || 0}% выполнено</p>

                    {epoch.goals?.length > 0 && (
                      <div className="mt-3">
                        <p className="text-xs font-medium text-muted-foreground mb-1">Цели:</p>
                        <ul className="space-y-0.5">
                          {epoch.goals.map((g: string, i: number) => (
                            <li key={i} className="text-xs text-muted-foreground flex items-center gap-1">
                              <div className="h-1 w-1 rounded-full bg-muted-foreground" />
                              {g}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    <Button size="sm" variant="outline" onClick={() => router.push(`/docs?epochId=${epoch.id}`)}>
                      <FileText className="h-3 w-3 mr-1" />
                      Документы
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => api.post(`/api/projects/epochs/${epoch.id}/sync-status`).then(() => loadEpochs())}>
                      <Zap className="h-3 w-3 mr-1" />
                      Синк статуса
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Новая эпоха</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Название *</Label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Эпоха 1: MVP" />
            </div>
            <div className="space-y-2">
              <Label>Описание</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Начало *</Label>
                <Input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Конец *</Label>
                <Input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Цели (по одной на строку)</Label>
              <Textarea value={form.goals} onChange={e => setForm(f => ({ ...f, goals: e.target.value }))} placeholder="Реализовать авторизацию&#10;Запустить базовый Kanban" rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Отмена</Button>
            <Button onClick={handleCreate} disabled={!form.title || !form.startDate || !form.endDate || creating}>
              {creating ? "Создание..." : "Создать"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// --- Main Page Component ---

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { getUserName, users: allUsers } = useUsers();
  const { t, locale } = useLocale();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [creating, setCreating] = useState(false);
  const [kanbanFilter, setKanbanFilter] = useState({ priority: 'all', assignee: 'all' });

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
        const data = await api.get<any>(`/api/projects/projects/${projectId}`);
        if (data) {
          setProject({
            id: data.id,
            title: data.title,
            description: data.description || "",
            status: data.status || "ACTIVE",
            client_name: getUserName(data.clientId),
            deadline: data.deadline || null,
            manager: data.managerId ? getUserName(data.managerId) : null,
            tasks: (data.tasks || []).map((t: any) => ({
              id: t.id,
              title: t.title,
              description: t.description || "",
              status: (t.status || "BACKLOG").toLowerCase(),
              priority: (t.priority || "MEDIUM").toLowerCase(),
              assignee: t.assigneeId || null,
              depends_on: (t.blockedBy || []).map((d: any) => d.blockingTaskId),
            })),
          });
        } else {
          setProject(null);
        }
      } catch {
        setProject(null);
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

    try {
      const result = await api.post<any>("/api/projects/tasks", {
        title: newTitle,
        description: newDescription,
        priority: newPriority.toUpperCase(),
        status: newStatus.toUpperCase(),
        assigneeId: newAssignee || undefined,
        projectId,
        blockedByIds: newDependsOn.length > 0 ? newDependsOn : undefined,
      });
      setProject({
        ...project,
        tasks: [
          ...project.tasks,
          {
            id: result.id,
            title: result.title || newTitle,
            description: result.description || newDescription,
            status: (result.status || newStatus).toLowerCase(),
            priority: (result.priority || newPriority).toLowerCase(),
            assignee: result.assigneeId || newAssignee || null,
            depends_on: (result.blockedBy || []).map((d: any) => d.blockingTaskId || d),
          },
        ],
      });
    } catch {
      // Show error, don't add fake task
      // Could not create task on server
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
        <p className="text-muted-foreground">{t('projects.not_found_single')}</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push("/projects")}>
          {t('projects.go_to_list')}
        </Button>
      </div>
    );
  }

  const kanbanColumns = getKanbanColumns(t);
  const priorityConfig = getPriorityConfig(t);
  const statusConfig = getStatusConfig(t);

  const projectStatusConfig = statusConfig[project.status] || {
    label: project.status,
    className: "bg-muted text-muted-foreground",
  };

  const filteredTasks = project.tasks.filter(t => {
    if (kanbanFilter.priority !== 'all' && t.priority !== kanbanFilter.priority) return false;
    if (kanbanFilter.assignee === 'unassigned' && t.assignee) return false;
    if (kanbanFilter.assignee !== 'all' && kanbanFilter.assignee !== 'unassigned' && t.assignee !== kanbanFilter.assignee) return false;
    return true;
  });

  const tasksByColumn = kanbanColumns.map((col) => ({
    ...col,
    tasks: filteredTasks
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
          <div className="flex flex-wrap items-center gap-x-4 sm:gap-x-6 gap-y-2 text-xs sm:text-sm text-muted-foreground pl-12">
            {project.client_name && <span>{t('projects.client')}: {project.client_name}</span>}
            {project.deadline && <span>{t('common.deadline')}: {new Date(project.deadline).toLocaleDateString(locale === "en" ? "en-US" : "ru-RU")}</span>}
            <span>
              {t('tasks.count')}: {doneCount}/{totalTasks} ({progressPercent}%)
            </span>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="tasks">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="overflow-x-auto -mx-1 px-1">
              <TabsList>
                <TabsTrigger value="tasks">{t('tasks.count')}</TabsTrigger>
                <TabsTrigger value="epochs">
                  <Layers className="h-4 w-4 mr-1" />
                  Эпохи
                </TabsTrigger>
                <TabsTrigger value="dependencies">{t('tasks.dependencies')}</TabsTrigger>
                <TabsTrigger value="settings">{t('nav.settings')}</TabsTrigger>
              </TabsList>
            </div>

            {/* Add task button (shown on tasks tab) */}
            <Dialog open={addTaskOpen} onOpenChange={setAddTaskOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-2 shadow-sm">
                  <Plus className="h-4 w-4" />
                  {t('tasks.new')}
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>{t('tasks.new_task')}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreateTask} className="space-y-4 mt-2">
                  <div className="space-y-2">
                    <Label htmlFor="task-title">{t('common.title')} *</Label>
                    <Input
                      id="task-title"
                      placeholder={t('tasks.title')}
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="task-desc">{t('common.description')}</Label>
                    <Textarea
                      id="task-desc"
                      placeholder={t('tasks.description')}
                      value={newDescription}
                      onChange={(e) => setNewDescription(e.target.value)}
                      rows={3}
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{t('tasks.priority')}</Label>
                      <Select value={newPriority} onValueChange={setNewPriority}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">{t('tasks.priority.low')}</SelectItem>
                          <SelectItem value="medium">{t('tasks.priority.medium')}</SelectItem>
                          <SelectItem value="high">{t('tasks.priority.high')}</SelectItem>
                          <SelectItem value="critical">{t('tasks.priority.critical')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>{t('tasks.column')}</Label>
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
                    <Label>{t('tasks.assignee')}</Label>
                    <Select value={newAssignee} onValueChange={setNewAssignee}>
                      <SelectTrigger>
                        <SelectValue placeholder={t('tasks.unassigned')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">{t('tasks.unassigned')}</SelectItem>
                        {allUsers.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {project.tasks.length > 0 && (
                    <div className="space-y-2">
                      <Label>{t('tasks.depends_on')}</Label>
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

          {/* Tasks Tab - Kanban Board */}
          <TabsContent value="tasks" className="mt-4">
            <div className="flex flex-wrap gap-2 mb-3">
              <Select value={kanbanFilter.priority} onValueChange={(v) => setKanbanFilter(prev => ({...prev, priority: v}))}>
                <SelectTrigger className="w-[140px] h-8 text-xs">
                  <SelectValue placeholder={t('tasks.priority')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('tasks.all_priorities')}</SelectItem>
                  <SelectItem value="critical">{t('tasks.priority.critical')}</SelectItem>
                  <SelectItem value="high">{t('tasks.priority.high')}</SelectItem>
                  <SelectItem value="medium">{t('tasks.priority.medium')}</SelectItem>
                  <SelectItem value="low">{t('tasks.priority.low')}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={kanbanFilter.assignee} onValueChange={(v) => setKanbanFilter(prev => ({...prev, assignee: v}))}>
                <SelectTrigger className="w-[160px] h-8 text-xs">
                  <SelectValue placeholder={t('tasks.assignee')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('tasks.all_assignees')}</SelectItem>
                  <SelectItem value="unassigned">{t('tasks.unassigned')}</SelectItem>
                  {allUsers.map(u => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(kanbanFilter.priority !== 'all' || kanbanFilter.assignee !== 'all') && (
                <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setKanbanFilter({ priority: 'all', assignee: 'all' })}>
                  {t('common.reset')}
                </Button>
              )}
            </div>
            <ScrollArea orientation="horizontal" className="pb-4">
              <div className="flex gap-4 min-w-max">
                {tasksByColumn.map((col) => (
                  <KanbanColumn
                    key={col.key}
                    column={col}
                    tasks={col.tasks}
                    allTasks={project.tasks}
                    onTaskClick={(task) => setSelectedTask(task)}
                    resolveUser={getUserName}
                    t={t}
                    onTaskDrop={async (taskId, newStatus) => {
                      // Update locally immediately
                      setProject({
                        ...project,
                        tasks: project.tasks.map((t) =>
                          t.id === taskId ? { ...t, status: newStatus } : t
                        ),
                      });
                      // Persist to API
                      try {
                        await api.patch(`/api/projects/tasks/${taskId}`, {
                          status: newStatus.toUpperCase(),
                        });
                      } catch (err) {
                        toast({ title: t('common.error'), description: err instanceof Error ? err.message : t('projects.task_status_error'), variant: "destructive" });
                      }
                    }}
                  />
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Epochs Tab */}
          <TabsContent value="epochs" className="mt-4">
            <EpochsTab projectId={projectId} router={router} />
          </TabsContent>

          {/* Dependencies Tab */}
          <TabsContent value="dependencies" className="mt-4">
            <DependenciesTab tasks={project.tasks} t={t} />
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="mt-4">
            <SettingsTab project={project} onUpdate={handleProjectUpdate} onDelete={() => router.push("/projects")} t={t} />
          </TabsContent>
        </Tabs>

        {/* Task Edit Dialog */}
        <TaskEditDialog
          task={selectedTask}
          allTasks={project.tasks}
          allUsers={allUsers}
          getUserName={getUserName}
          t={t}
          onClose={() => setSelectedTask(null)}
          onSave={(updatedTask) => {
            setProject({
              ...project,
              tasks: project.tasks.map((t) =>
                t.id === updatedTask.id ? updatedTask : t
              ),
            });
            setSelectedTask(null);
          }}
        />
      </div>
    </TooltipProvider>
  );
}
