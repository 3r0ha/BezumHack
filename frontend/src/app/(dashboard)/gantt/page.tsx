"use client";

import { useEffect, useState, useMemo } from "react";
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Calendar,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { api } from "@/lib/api";
import { useLocale } from "@/contexts/locale-context";

interface GanttTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  startDate: Date;
  endDate: Date;
  estimatedHours: number;
  assigneeId: string | null;
  dependencies: string[];
  isCriticalPath?: boolean;
}

interface Project {
  id: string;
  title: string;
  tasks?: any[];
}

const statusColors: Record<string, string> = {
  BACKLOG: "bg-zinc-500",
  TODO: "bg-blue-500",
  IN_PROGRESS: "bg-amber-500",
  REVIEW: "bg-violet-500",
  DONE: "bg-emerald-500",
};

const priorityDotColors: Record<string, string> = {
  CRITICAL: "bg-red-500",
  HIGH: "bg-orange-500",
  MEDIUM: "bg-amber-400",
  LOW: "bg-gray-400",
};

const ROW_HEIGHT = 56;

const statusLabelKeys: Record<string, string> = {
  BACKLOG: "tasks.status.backlog",
  TODO: "tasks.status.todo",
  IN_PROGRESS: "tasks.status.in_progress",
  REVIEW: "tasks.status.review",
  DONE: "tasks.status.done",
};

function getDaysBetween(start: Date, end: Date): number {
  return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function formatShortDate(date: Date, locale: string = "ru"): string {
  return date.toLocaleDateString(locale === "en" ? "en-US" : "ru-RU", { day: "numeric", month: "short" });
}

function formatWeekHeader(date: Date, locale: string = "ru"): { monthName: string; day: number; isFirstWeekOfMonth: boolean } {
  const day = date.getDate();
  const isFirstWeekOfMonth = day <= 7;
  const monthName = date.toLocaleDateString(locale === "en" ? "en-US" : "ru-RU", { month: "long" });
  // Capitalize first letter
  const capitalized = monthName.charAt(0).toUpperCase() + monthName.slice(1);
  return { monthName: capitalized, day, isFirstWeekOfMonth };
}

// Simple critical path detection: tasks with no slack (longest path)
function computeCriticalPath(tasks: GanttTask[]): Set<string> {
  const taskMap = new Map(tasks.map((t) => [t.id, t]));
  const critical = new Set<string>();

  // Find tasks that have no dependents (end tasks)
  const hasDependent = new Set<string>();
  tasks.forEach((t) => t.dependencies.forEach((d) => hasDependent.add(d)));
  const endTasks = tasks.filter((t) => !hasDependent.has(t.id));

  // Trace back from end tasks through dependencies
  function traceBack(taskId: string) {
    critical.add(taskId);
    const task = taskMap.get(taskId);
    if (!task) return;
    // Find the dependency that ends latest (critical predecessor)
    let latestDep: GanttTask | null = null;
    for (const depId of task.dependencies) {
      const dep = taskMap.get(depId);
      if (dep && (!latestDep || dep.endDate > latestDep.endDate)) {
        latestDep = dep;
      }
    }
    if (latestDep) traceBack(latestDep.id);
  }

  // Find the end task that finishes latest
  let latestEnd: GanttTask | null = null;
  for (const t of endTasks) {
    if (!latestEnd || t.endDate > latestEnd.endDate) latestEnd = t;
  }
  if (latestEnd) traceBack(latestEnd.id);

  return critical;
}

export default function GanttPage() {
  const { t, locale } = useLocale();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [tasks, setTasks] = useState<GanttTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewWeeks, setViewWeeks] = useState(8);
  const [startOffset, setStartOffset] = useState(0);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await api.get<any[]>("/api/projects/projects");
        if (data && data.length > 0) {
          setProjects(data.map((p: any) => ({ id: p.id, title: p.title })));
          setSelectedProjectId(data[0].id);
        }
      } catch {
        // Mock data for demo
        setProjects([
          { id: "1", title: "Мобильное приложение для доставки" },
          { id: "2", title: "CRM система" },
        ]);
        setSelectedProjectId("1");
      }
      setLoading(false);
    };
    load();
  }, []);

  useEffect(() => {
    if (!selectedProjectId) return;
    const loadTasks = async () => {
      setLoading(true);
      try {
        const project = await api.get<any>(`/api/projects/projects/${selectedProjectId}`);
        if (project?.tasks) {
          const now = new Date();
          const ganttTasks: GanttTask[] = project.tasks.map((t: any, i: number) => {
            const estHours = t.estimatedHours || 8;
            const durationDays = Math.max(1, Math.ceil(estHours / 8));
            let start: Date;
            let end: Date;
            if (t.dueDate) {
              end = new Date(t.dueDate);
              start = addDays(end, -durationDays);
            } else {
              start = t.createdAt ? new Date(t.createdAt) : addDays(now, i * 2);
              end = addDays(start, durationDays);
            }
            return {
              id: t.id,
              title: t.title,
              status: t.status,
              priority: t.priority,
              startDate: start,
              endDate: end,
              estimatedHours: t.estimatedHours || 0,
              assigneeId: t.assigneeId,
              dependencies: (t.blockedBy || []).map((d: any) => d.blockingTaskId || d.blockingTask?.id).filter(Boolean),
            };
          });
          setTasks(ganttTasks);
        }
      } catch {
        // Generate mock tasks for demo
        const now = new Date();
        const mockTasks: GanttTask[] = [
          { id: "1", title: "Анализ требований", status: "DONE", priority: "HIGH", startDate: now, endDate: addDays(now, 3), estimatedHours: 24, assigneeId: null, dependencies: [] },
          { id: "2", title: "Проектирование БД", status: "DONE", priority: "HIGH", startDate: addDays(now, 3), endDate: addDays(now, 6), estimatedHours: 24, assigneeId: null, dependencies: ["1"] },
          { id: "3", title: "Дизайн UI/UX", status: "IN_PROGRESS", priority: "MEDIUM", startDate: addDays(now, 3), endDate: addDays(now, 10), estimatedHours: 56, assigneeId: null, dependencies: ["1"] },
          { id: "4", title: "Разработка API", status: "IN_PROGRESS", priority: "HIGH", startDate: addDays(now, 6), endDate: addDays(now, 16), estimatedHours: 80, assigneeId: null, dependencies: ["2"] },
          { id: "5", title: "Разработка Frontend", status: "TODO", priority: "HIGH", startDate: addDays(now, 10), endDate: addDays(now, 22), estimatedHours: 96, assigneeId: null, dependencies: ["3", "4"] },
          { id: "6", title: "Интеграция платежей", status: "TODO", priority: "CRITICAL", startDate: addDays(now, 16), endDate: addDays(now, 22), estimatedHours: 48, assigneeId: null, dependencies: ["4"] },
          { id: "7", title: "Тестирование", status: "BACKLOG", priority: "MEDIUM", startDate: addDays(now, 22), endDate: addDays(now, 28), estimatedHours: 48, assigneeId: null, dependencies: ["5", "6"] },
          { id: "8", title: "Деплой", status: "BACKLOG", priority: "HIGH", startDate: addDays(now, 28), endDate: addDays(now, 30), estimatedHours: 16, assigneeId: null, dependencies: ["7"] },
        ];
        setTasks(mockTasks);
      }
      setLoading(false);
    };
    loadTasks();
  }, [selectedProjectId]);

  const criticalPath = useMemo(() => computeCriticalPath(tasks), [tasks]);

  const tasksWithCritical = useMemo(
    () => tasks.map((t) => ({ ...t, isCriticalPath: criticalPath.has(t.id) })),
    [tasks, criticalPath]
  );

  // Calculate timeline
  const timelineStart = useMemo(() => {
    const baseDate = new Date();
    baseDate.setDate(baseDate.getDate() + startOffset * 7);
    baseDate.setHours(0, 0, 0, 0);
    // Find the start of the week (Monday)
    const day = baseDate.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    baseDate.setDate(baseDate.getDate() + diff);
    return baseDate;
  }, [startOffset]);

  const totalDays = viewWeeks * 7;
  const timelineEnd = addDays(timelineStart, totalDays);

  const weeks = useMemo(() => {
    const result = [];
    for (let i = 0; i < viewWeeks; i++) {
      const weekStart = addDays(timelineStart, i * 7);
      result.push(weekStart);
    }
    return result;
  }, [timelineStart, viewWeeks]);

  const getTaskPosition = (task: GanttTask) => {
    const startDays = Math.max(0, getDaysBetween(timelineStart, task.startDate));
    const duration = getDaysBetween(task.startDate, task.endDate);
    const left = (startDays / totalDays) * 100;
    const width = (duration / totalDays) * 100;
    return { left: `${Math.max(0, left)}%`, width: `${Math.min(width, 100 - left)}%` };
  };

  const today = new Date();
  const todayPosition = ((getDaysBetween(timelineStart, today)) / totalDays) * 100;

  if (loading && projects.length === 0) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-[500px] w-full" />
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={100}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-cyan-600 text-white">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">{t('gantt.title')}</h1>
              <p className="text-xs sm:text-sm text-muted-foreground hidden sm:block">{t('gantt.subtitle')}</p>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-wrap">
          {projects.length > 0 ? (
            <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
              <SelectTrigger className="w-full sm:w-[280px]">
                <SelectValue placeholder={t('gantt.select_project')} />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Skeleton className="h-10 w-full sm:w-[280px]" />
          )}

          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" onClick={() => setStartOffset((o) => o - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setStartOffset(0)}>
              {t('gantt.today')}
            </Button>
            <Button variant="outline" size="icon" onClick={() => setStartOffset((o) => o + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center gap-2 sm:ml-auto flex-wrap">
            <Badge variant="outline" className="gap-1 hidden sm:flex">
              <div className="h-2 w-2 rounded-full bg-red-500" />
              {t('gantt.critical_path')}
            </Badge>
            <Badge variant="outline" className="gap-1 hidden sm:flex">
              <Calendar className="h-3 w-3" />
              {formatShortDate(timelineStart, locale)} — {formatShortDate(timelineEnd, locale)}
            </Badge>
          </div>
        </div>

        {/* Gantt Chart */}
        <Card>
          <CardContent className="p-0">
            <ScrollArea className="w-full">
              <div className="min-w-[800px] relative">
                {/* Timeline Header */}
                <div className="flex border-b sticky top-0 bg-card z-10">
                  <div className="w-[200px] sm:w-[300px] shrink-0 p-2 sm:p-3 font-medium text-sm border-r">
                    {t('gantt.task')}
                  </div>
                  <div className="flex-1 flex relative">
                    {weeks.map((week, i) => {
                      const hdr = formatWeekHeader(week, locale);
                      return (
                        <div
                          key={i}
                          className={`flex-1 text-center py-2 text-xs border-r last:border-r-0 ${
                            hdr.isFirstWeekOfMonth ? "text-foreground font-semibold" : "text-muted-foreground"
                          }`}
                        >
                          {hdr.monthName} · {hdr.day}
                        </div>
                      );
                    })}
                    {/* Today label in header */}
                    {todayPosition > 0 && todayPosition < 100 && (
                      <div
                        className="absolute bottom-0 -translate-x-1/2 z-20"
                        style={{ left: `${todayPosition}%` }}
                      >
                        <span className="text-[9px] font-semibold text-red-400 bg-card px-1 rounded">
                          {t('gantt.today')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Tasks */}
                {tasksWithCritical.map((task) => {
                  const pos = getTaskPosition(task);
                  const barColor = task.isCriticalPath
                    ? "bg-red-500"
                    : statusColors[task.status] || "bg-gray-400";

                  return (
                    <div key={task.id} className="flex border-b last:border-b-0 hover:bg-accent/30 transition-colors min-h-[48px]">
                      <div className="w-[200px] sm:w-[300px] shrink-0 p-2 sm:py-3 sm:px-3 border-r">
                        <div className="flex items-center gap-2">
                          <div className={`h-2.5 w-2.5 rounded-full shrink-0 ${priorityDotColors[task.priority] || "bg-gray-400"}`} />
                          <p className="text-sm font-medium truncate">{task.title}</p>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-[10px] h-5">
                            {t(statusLabelKeys[task.status]) || task.status}
                          </Badge>
                          {task.estimatedHours > 0 && (
                            <span className="text-[10px] text-muted-foreground">
                              {task.estimatedHours}{t('gantt.hours_short')}
                            </span>
                          )}
                        </div>
                        {task.assigneeId && (
                          <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                            {task.assigneeId}
                          </p>
                        )}
                      </div>
                      <div className="flex-1 relative py-3 px-1">
                        {/* Grid lines */}
                        <div className="absolute inset-0 flex">
                          {weeks.map((_, i) => (
                            <div key={i} className="flex-1 border-r last:border-r-0 border-dashed opacity-30" />
                          ))}
                        </div>

                        {/* Today line */}
                        {todayPosition > 0 && todayPosition < 100 && (
                          <div
                            className="absolute top-0 bottom-0 w-0.5 z-10"
                            style={{
                              left: `${todayPosition}%`,
                              backgroundImage: "repeating-linear-gradient(to bottom, rgb(248 113 113) 0px, rgb(248 113 113) 4px, transparent 4px, transparent 8px)",
                            }}
                          />
                        )}

                        {/* Task bar */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div
                              className={`absolute top-1/2 -translate-y-1/2 h-8 rounded-md ${barColor} opacity-90 hover:opacity-100 transition-opacity cursor-pointer ${
                                task.isCriticalPath ? "ring-2 ring-red-500/40 animate-pulse" : ""
                              }`}
                              style={{
                                left: pos.left,
                                width: pos.width,
                                minWidth: "60px",
                              }}
                            >
                              <span className="absolute inset-0 flex items-center px-2 text-[11px] text-white font-medium truncate">
                                {task.title}
                              </span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="space-y-1">
                              <p className="font-medium">{task.title}</p>
                              <p className="text-xs">{formatShortDate(task.startDate, locale)} — {formatShortDate(task.endDate, locale)}</p>
                              <p className="text-xs">{task.estimatedHours}{t('gantt.hours_short')} {t('gantt.hours_estimate')}</p>
                              {task.isCriticalPath && (
                                <p className="text-xs text-red-400 flex items-center gap-1">
                                  <AlertTriangle className="h-3 w-3" />
                                  {t('gantt.critical_path')}
                                </p>
                              )}
                            </div>
                          </TooltipContent>
                        </Tooltip>

                      </div>
                    </div>
                  );
                })}

                {/* Dependency arrows overlay */}
                {tasksWithCritical.length > 0 && (() => {
                  const svgH = tasksWithCritical.length * ROW_HEIGHT;
                  const svgW = 1000; // virtual width, maps to 100%
                  return (
                    <svg
                      className="absolute pointer-events-none z-[5]"
                      preserveAspectRatio="none"
                      viewBox={`0 0 ${svgW} ${svgH}`}
                      style={{
                        left: '300px',
                        top: '41px',
                        width: 'calc(100% - 300px)',
                        height: `${svgH}px`,
                      }}
                    >
                      <defs>
                        <marker
                          id="dep-arrow"
                          markerWidth="8"
                          markerHeight="6"
                          refX="8"
                          refY="3"
                          orient="auto"
                        >
                          <polygon points="0 0, 8 3, 0 6" className="fill-muted-foreground opacity-60" />
                        </marker>
                      </defs>
                      {tasksWithCritical.map((task) =>
                        task.dependencies.filter(Boolean).map((depId) => {
                          const dep = tasksWithCritical.find((t) => t.id === depId);
                          if (!dep) return null;
                          const taskIdx = tasksWithCritical.indexOf(task);
                          const depIdx = tasksWithCritical.indexOf(dep);
                          const depPos = getTaskPosition(dep);
                          const taskPos = getTaskPosition(task);

                          // Source: end of dependency bar (percentage -> svgW scale)
                          const srcX = (parseFloat(depPos.left) + parseFloat(depPos.width)) / 100 * svgW;
                          const srcY = depIdx * ROW_HEIGHT + ROW_HEIGHT / 2;
                          // Target: start of task bar
                          const tgtX = parseFloat(taskPos.left) / 100 * svgW;
                          const tgtY = taskIdx * ROW_HEIGHT + ROW_HEIGHT / 2;

                          const midX = (srcX + tgtX) / 2;

                          return (
                            <path
                              key={`${depId}-${task.id}`}
                              d={`M ${srcX} ${srcY} C ${midX} ${srcY}, ${midX} ${tgtY}, ${tgtX} ${tgtY}`}
                              fill="none"
                              className="stroke-muted-foreground opacity-40"
                              strokeWidth="1.5"
                              markerEnd="url(#dep-arrow)"
                            />
                          );
                        })
                      )}
                    </svg>
                  );
                })()}

                {tasksWithCritical.length === 0 && !loading && (
                  <div className="flex items-center justify-center py-20 text-muted-foreground">
                    <div className="text-center">
                      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/50">
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-50">
                          <rect x="3" y="4" width="18" height="4" rx="1" />
                          <rect x="3" y="10" width="12" height="4" rx="1" />
                          <rect x="7" y="16" width="14" height="4" rx="1" />
                        </svg>
                      </div>
                      <p className="text-sm font-medium">{t('gantt.no_tasks')}</p>
                      <p className="text-xs mt-1.5 max-w-[240px] mx-auto">{t('gantt.create_tasks')}</p>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Legend */}
        <div className="flex flex-wrap gap-2 sm:gap-3">
          {Object.entries(statusColors).map(([status, color]) => (
            <div key={status} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <div className={`h-3 w-3 rounded-sm ${color}`} />
              {t(statusLabelKeys[status]) || status}
            </div>
          ))}
        </div>
      </div>
    </TooltipProvider>
  );
}
