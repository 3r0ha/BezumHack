"use client";

import { useEffect, useState } from "react";
import {
  TrendingUp,
  Brain,
  Target,
  Zap,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Info,
  Loader2,
  FileText,
  Calendar,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { useLocale } from "@/contexts/locale-context";

interface Insight {
  type: "warning" | "success" | "info" | "critical";
  title: string;
  description: string;
}

interface Analytics {
  health_score: number;
  health_label: string;
  insights: Insight[];
  estimation_accuracy: {
    overall_percent: number;
    overestimated_count: number;
    underestimated_count: number;
    accurate_count: number;
  };
  velocity: {
    tasks_per_week: number;
    hours_per_week: number;
    trend: string;
  };
  deadline_prediction: {
    on_track: boolean;
    predicted_completion: string;
    confidence: string;
    reasoning: string;
  };
}

interface WeeklyReport {
  summary: string;
  completed_tasks: string[];
  in_progress: string[];
  planned_next_week: string[];
  risks: { title: string; mitigation: string }[];
  metrics: {
    tasks_completed: number;
    tasks_total: number;
    progress_percent: number;
    hours_this_week: number;
    budget_status: string;
  };
  client_action_required: string[];
}

const insightIcons: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  critical: { icon: AlertTriangle, color: "text-red-500", bg: "bg-red-500/10" },
  warning: { icon: AlertTriangle, color: "text-amber-500", bg: "bg-amber-500/10" },
  success: { icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-500/10" },
  info: { icon: Info, color: "text-blue-500", bg: "bg-blue-500/10" },
};

function getTrendLabel(trend: string, t: (key: string) => string): string {
  const key = `analytics.trend.${trend}`;
  const result = t(key);
  return result !== key ? result : trend;
}

function getHealthColor(score: number): string {
  if (score >= 80) return "text-emerald-500";
  if (score >= 60) return "text-amber-500";
  return "text-red-500";
}

function getHealthBg(score: number): string {
  if (score >= 80) return "from-emerald-500/20 to-emerald-500/5";
  if (score >= 60) return "from-amber-500/20 to-amber-500/5";
  return "from-red-500/20 to-red-500/5";
}

export default function AnalyticsPage() {
  const { t } = useLocale();
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState("1");
  const [projects, setProjects] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await api.get<any[]>("/api/projects/projects");
        if (data && data.length > 0) {
          setProjects(data.map((p: any) => ({ id: p.id, title: p.title })));
          if (!selectedProjectId) setSelectedProjectId(data[0].id);
        }
      } catch {
        setProjects([]);
      }
    };
    load();
  }, []);

  useEffect(() => {
    if (!selectedProjectId) return;
    const loadAnalytics = async () => {
      setLoading(true);
      try {
        // Load the selected project with its tasks
        const project = await api.get<any>(`/api/projects/projects/${selectedProjectId}`);
        const projectTitle = project?.title || "Project";
        const rawTasks = project?.tasks || [];

        // Map tasks to the format expected by the AI endpoint
        const mappedTasks = rawTasks.map((t: any) => ({
          title: t.title || "",
          estimated_hours: t.estimated_hours || t.estimatedHours || 0,
          actual_hours: t.actual_hours || t.actualHours || 0,
          status: t.status || "TODO",
          assignee_id: t.assignee_id || t.assigneeId || null,
          created_at: t.created_at || t.createdAt || new Date().toISOString(),
        }));

        const result = await api.post<Analytics>("/api/ai/analytics/", {
          project_title: projectTitle,
          tasks: mappedTasks,
        });
        setAnalytics(result);
      } catch {
        setAnalytics(null);
      }
      setLoading(false);
    };
    loadAnalytics();
  }, [selectedProjectId]);

  const handleGenerateReport = async () => {
    setReportLoading(true);
    try {
      // Load the selected project with its tasks
      const project = await api.get<any>(`/api/projects/projects/${selectedProjectId}`);
      const projectTitle = project?.title || "Project";
      const rawTasks = project?.tasks || [];

      // Map tasks to the format expected by the AI endpoint
      const mappedTasks = rawTasks.map((t: any) => ({
        title: t.title || "",
        estimated_hours: t.estimated_hours || t.estimatedHours || 0,
        actual_hours: t.actual_hours || t.actualHours || 0,
        status: t.status || "TODO",
        assignee_id: t.assignee_id || t.assigneeId || null,
        created_at: t.created_at || t.createdAt || new Date().toISOString(),
      }));

      const result = await api.post<WeeklyReport>("/api/ai/weekly-report/", {
        project_title: projectTitle,
        tasks: mappedTasks,
        period_start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        period_end: new Date().toISOString().split("T")[0],
      });
      setReport(result);
    } catch {
      setReport(null);
    }
    setReportLoading(false);
    setReportOpen(true);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[200px]" />
        <div className="grid gap-4 sm:grid-cols-2">
          <Skeleton className="h-[150px]" />
          <Skeleton className="h-[150px]" />
        </div>
      </div>
    );
  }

  const data = analytics;

  if (!data) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t('analytics.title')}</h1>
            <p className="text-sm text-muted-foreground">{t('analytics.subtitle')}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
            <SelectTrigger className="w-full sm:w-[220px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {projects.map((p) => (<SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
        <div className="text-center py-16 text-muted-foreground">
          <Brain className="h-12 w-12 mx-auto opacity-40 mb-3" />
          <p>{t('analytics.no_data')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
            <TrendingUp className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t('analytics.title')}</h1>
            <p className="text-sm text-muted-foreground">
              {t('analytics.subtitle')}
            </p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
            <SelectTrigger className="w-full sm:w-[220px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleGenerateReport} disabled={reportLoading} className="gap-2">
            {reportLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            {t('analytics.generate_report')}
          </Button>
        </div>
      </div>

      {/* Health Score + Stats */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card className={`col-span-2 lg:col-span-1 bg-gradient-to-br ${getHealthBg(data.health_score)}`}>
          <CardContent className="pt-6 flex flex-col items-center text-center">
            <p className="text-sm text-muted-foreground mb-2">{t('analytics.health_score')}</p>
            <p className={`text-6xl font-bold ${getHealthColor(data.health_score)}`}>
              {data.health_score}
            </p>
            <p className="text-sm font-medium mt-1">{data.health_label}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground flex items-center gap-1.5">
              <Target className="h-3.5 w-3.5" />
              {t('analytics.accuracy')}
            </p>
            <p className="text-3xl font-bold mt-1">{data.estimation_accuracy.overall_percent}%</p>
            <div className="flex gap-2 mt-2 text-xs text-muted-foreground">
              <span>{data.estimation_accuracy.accurate_count} {t('analytics.accurate')}</span>
              <span>&middot;</span>
              <span>{data.estimation_accuracy.underestimated_count} {t('analytics.underestimated')}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5" />
              {t('analytics.velocity')}
            </p>
            <p className="text-3xl font-bold mt-1">{data.velocity.tasks_per_week}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {t('analytics.tasks_per_week')} &middot; {data.velocity.hours_per_week}{t('ai.hours_suffix')} &middot;{" "}
              {getTrendLabel(data.velocity.trend, t)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              {t('analytics.deadline_prediction')}
            </p>
            <p className={`text-lg font-bold mt-1 ${data.deadline_prediction.on_track ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
              {data.deadline_prediction.on_track ? t('analytics.on_track') : t('analytics.behind')}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              ~{new Date(data.deadline_prediction.predicted_completion).toLocaleDateString(locale === "en" ? "en-US" : "ru-RU", { day: "numeric", month: "short" })}
              {" "}&middot; {t('analytics.confidence')}: {data.deadline_prediction.confidence}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Insights */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Brain className="h-4 w-4 text-violet-500" />
            {t('analytics.insights')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.insights.map((insight, i) => {
            const config = insightIcons[insight.type] || insightIcons.info;
            const Icon = config.icon;
            return (
              <div key={i} className={`flex items-start gap-3 p-4 rounded-lg ${config.bg}`}>
                <Icon className={`h-5 w-5 ${config.color} shrink-0 mt-0.5`} />
                <div>
                  <p className="text-sm font-medium">{insight.title}</p>
                  <p className="text-sm text-muted-foreground mt-0.5">{insight.description}</p>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Deadline Prediction Detail */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" />
            {t('analytics.deadline_prediction')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{data.deadline_prediction.reasoning}</p>
        </CardContent>
      </Card>

      {/* Weekly Report Dialog */}
      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('analytics.weekly_report')}</DialogTitle>
          </DialogHeader>
          {report && (
            <div className="space-y-6 text-sm">
              <div>
                <h3 className="font-semibold mb-2">{t('analytics.summary')}</h3>
                <p className="text-muted-foreground">{report.summary}</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-2xl font-bold">{report.metrics.tasks_completed}</p>
                  <p className="text-xs text-muted-foreground">{t('analytics.completed')}</p>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-2xl font-bold">{report.metrics.progress_percent}%</p>
                  <p className="text-xs text-muted-foreground">{t('common.progress')}</p>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-2xl font-bold">{report.metrics.hours_this_week}{t('ai.hours_suffix')}</p>
                  <p className="text-xs text-muted-foreground">{t('analytics.hours_this_week')}</p>
                </div>
              </div>

              <Separator />

              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  {t('analytics.completed')}
                </h3>
                <ul className="space-y-1">
                  {report.completed_tasks.map((task, i) => (
                    <li key={i} className="text-muted-foreground flex items-start gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                      {task}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-1.5">
                  <Clock className="h-4 w-4 text-amber-500" />
                  {t('dashboard.in_progress')}
                </h3>
                <ul className="space-y-1">
                  {report.in_progress.map((task, i) => (
                    <li key={i} className="text-muted-foreground flex items-start gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                      {task}
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-2">{t('analytics.planned')}</h3>
                <ul className="space-y-1">
                  {report.planned_next_week.map((task, i) => (
                    <li key={i} className="text-muted-foreground flex items-start gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                      {task}
                    </li>
                  ))}
                </ul>
              </div>

              {report.risks.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2 flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    {t('analytics.risks')}
                  </h3>
                  {report.risks.map((risk, i) => (
                    <div key={i} className="rounded-lg bg-amber-500/10 p-3 mb-2">
                      <p className="font-medium">{risk.title}</p>
                      <p className="text-muted-foreground text-xs mt-1">{t('analytics.mitigation')}: {risk.mitigation}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="text-xs text-muted-foreground text-center pt-2">
                {t('analytics.budget_status')}: {report.metrics.budget_status}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
