"use client";

import { useState } from "react";
import {
  Rocket,
  Upload,
  Loader2,
  Sparkles,
  AlertTriangle,
  Clock,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FolderKanban,
  Zap,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { api } from "@/lib/api";
import { useLocale } from "@/contexts/locale-context";

interface AutopilotTask {
  title: string;
  description: string;
  priority: string;
  estimated_hours: number;
  phase: string;
  dependencies: string[];
  skills_required?: string[];
}

interface AutopilotResult {
  project_title: string;
  project_description: string;
  phases: { name: string; description: string; order: number }[];
  tasks: AutopilotTask[];
  total_estimated_hours: number;
  estimated_weeks: number;
  risks: string[];
  tech_stack_suggestions: string[];
}

const priorityColors: Record<string, string> = {
  CRITICAL: "bg-red-500/15 text-red-700 dark:text-red-400",
  HIGH: "bg-orange-500/15 text-orange-700 dark:text-orange-400",
  MEDIUM: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  LOW: "bg-muted text-muted-foreground",
};

export default function AutopilotPage() {
  const { t } = useLocale();
  const [text, setText] = useState("");
  const [projectTitle, setProjectTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AutopilotResult | null>(null);
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState(false);

  const handleGenerate = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setResult(null);
    setCreated(false);
    try {
      const res = await api.post<AutopilotResult>("/api/ai/autopilot", {
        text,
        project_title: projectTitle || undefined,
      });
      setResult(res);
      // Auto-expand all phases
      if (res.phases) {
        setExpandedPhases(new Set(res.phases.map((p) => p.name)));
      }
    } catch {
      // Show error state
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async () => {
    if (!result) return;
    setCreating(true);
    try {
      // Create project
      const project = await api.post<any>("/api/projects/projects", {
        title: result.project_title,
        description: result.project_description,
        clientId: "auto", // Will be set by backend from JWT
      });

      // Create tasks with dependencies
      const taskMap = new Map<string, string>(); // title -> id
      for (const task of result.tasks) {
        const created = await api.post<any>("/api/projects/tasks", {
          title: task.title,
          description: task.description,
          priority: task.priority,
          estimatedHours: task.estimated_hours,
          projectId: project.id,
          dependsOn: task.dependencies
            .map((dep) => taskMap.get(dep))
            .filter(Boolean),
        });
        taskMap.set(task.title, created.id);
      }
      setCreated(true);
    } catch (err) {
      console.error("Failed to create project:", err);
    } finally {
      setCreating(false);
    }
  };

  const togglePhase = (name: string) => {
    setExpandedPhases((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setText(reader.result as string);
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-red-600 text-white">
          <Rocket className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('ai.autopilot_title')}</h1>
          <p className="text-sm text-muted-foreground">
            {t('ai.autopilot_subtitle')}
          </p>
        </div>
      </div>

      {!result ? (
        /* Input Form */
        <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1.5 block">
                    {t('ai.project_name_optional')}
                  </label>
                  <input
                    value={projectTitle}
                    onChange={(e) => setProjectTitle(e.target.value)}
                    placeholder={t('ai.project_name_auto')}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">
                    {t('ai.tz_required')}
                  </label>
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder={t('ai.tz_placeholder')}
                    className="flex min-h-[200px] sm:min-h-[300px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
                  />
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <Button
                    onClick={handleGenerate}
                    disabled={loading || !text.trim()}
                    size="lg"
                    className="gap-2"
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Zap className="h-4 w-4" />
                    )}
                    {loading ? t('ai.analyzing') : t('ai.generate_plan')}
                  </Button>
                  <label className="inline-flex items-center justify-center gap-2 rounded-md border px-4 py-2.5 text-sm font-medium hover:bg-accent cursor-pointer transition-colors">
                    <Upload className="h-4 w-4" />
                    {t('ai.upload_file')}
                    <input
                      type="file"
                      className="hidden"
                      accept=".txt,.md,.doc,.docx"
                      onChange={handleFileUpload}
                    />
                  </label>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">{t('ai.how_it_works')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <div className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">1</span>
                  <p>{t('ai.step1')}</p>
                </div>
                <div className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">2</span>
                  <p>{t('ai.step2')}</p>
                </div>
                <div className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">3</span>
                  <p>{t('ai.step3')}</p>
                </div>
                <div className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold">4</span>
                  <p>{t('ai.step4')}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        /* Results */
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="p-4 sm:pt-6">
                <p className="text-xs sm:text-sm text-muted-foreground">{t('ai.tasks_count')}</p>
                <p className="text-2xl sm:text-3xl font-bold">{result.tasks.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 sm:pt-6">
                <p className="text-xs sm:text-sm text-muted-foreground">{t('ai.phases_count')}</p>
                <p className="text-2xl sm:text-3xl font-bold">{result.phases.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 sm:pt-6">
                <p className="text-xs sm:text-sm text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" /> {t('ai.hours')}
                </p>
                <p className="text-2xl sm:text-3xl font-bold">{result.total_estimated_hours}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 sm:pt-6">
                <p className="text-xs sm:text-sm text-muted-foreground">{t('ai.weeks')}</p>
                <p className="text-2xl sm:text-3xl font-bold">{result.estimated_weeks}</p>
              </CardContent>
            </Card>
          </div>

          {/* Project title and description */}
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="min-w-0">
                  <CardTitle className="truncate">{result.project_title}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                    {result.project_description}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button variant="outline" onClick={() => setResult(null)}>
                    {t('common.back')}
                  </Button>
                  <Button
                    onClick={handleCreateProject}
                    disabled={creating || created}
                    className="gap-2"
                  >
                    {created ? (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        {t('ai.project_created')}
                      </>
                    ) : creating ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {t('ai.creating')}
                      </>
                    ) : (
                      <>
                        <FolderKanban className="h-4 w-4" />
                        {t('ai.create_project')}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* Phases and Tasks */}
          <div className="space-y-3">
            {result.phases
              .sort((a, b) => a.order - b.order)
              .map((phase) => {
                const phaseTasks = result.tasks.filter((t) => t.phase === phase.name);
                const phaseHours = phaseTasks.reduce((sum, t) => sum + t.estimated_hours, 0);
                const isExpanded = expandedPhases.has(phase.name);

                return (
                  <Card key={phase.name}>
                    <div
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4 p-3 sm:p-4 cursor-pointer hover:bg-accent/50 transition-colors"
                      onClick={() => togglePhase(phase.name)}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="font-medium truncate">{phase.name}</p>
                          <p className="text-xs text-muted-foreground line-clamp-1">{phase.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 sm:gap-3 pl-7 sm:pl-0 shrink-0">
                        <Badge variant="outline">{phaseTasks.length} {t('ai.tasks_label')}</Badge>
                        <Badge variant="outline" className="gap-1">
                          <Clock className="h-3 w-3" />
                          {phaseHours}{t('ai.hours_suffix')}
                        </Badge>
                      </div>
                    </div>
                    {isExpanded && (
                      <CardContent className="pt-0 pb-4">
                        <div className="space-y-2">
                          {phaseTasks.map((task, i) => (
                            <div
                              key={i}
                              className="flex items-start gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-lg border bg-background"
                            >
                              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded bg-muted text-xs font-medium mt-0.5">
                                {i + 1}
                              </span>
                              <div className="flex-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-2 mb-1">
                                  <p className="text-sm font-medium">{task.title}</p>
                                  <Badge
                                    className={`text-[10px] ${priorityColors[task.priority] || ""}`}
                                  >
                                    {task.priority}
                                  </Badge>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  {task.description}
                                </p>
                                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {task.estimated_hours}{t('ai.hours_suffix')}
                                  </span>
                                  {task.dependencies.length > 0 && (
                                    <span>
                                      {t('ai.depends_on')}: {task.dependencies.join(", ")}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    )}
                  </Card>
                );
              })}
          </div>

          {/* Risks and Tech Stack */}
          <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  {t('ai.risks')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {result.risks.map((risk, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                      {risk}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-violet-500" />
                  {t('ai.tech_suggestions')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {result.tech_stack_suggestions.map((tech, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <span className="h-1.5 w-1.5 rounded-full bg-violet-500 mt-1.5 shrink-0" />
                      {tech}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Loading overlay */}
      {loading && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="text-center space-y-4 max-w-sm">
            <div className="relative">
              <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin mx-auto" />
              <Rocket className="h-5 w-5 sm:h-6 sm:w-6 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            </div>
            <div>
              <p className="font-semibold text-base sm:text-lg">{t('ai.loading_analyzing')}</p>
              <p className="text-xs sm:text-sm text-muted-foreground">
                {t('ai.loading_desc')}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
