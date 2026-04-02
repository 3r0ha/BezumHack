"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Webhook,
  Plus,
  Trash2,
  TestTube,
  Copy,
  Check,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ExternalLink,
  Power,
  PowerOff,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { api } from "@/lib/api";
import { useLocale } from "@/contexts/locale-context";

// --- Types ---

interface WebhookData {
  id: string;
  userId: string;
  projectId: string | null;
  url: string;
  secret: string;
  events: string[];
  active: boolean;
  lastError: string | null;
  lastTriggeredAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Project {
  id: string;
  title: string;
}

// --- Constants ---

const EVENT_LABEL_KEYS: Record<string, string> = {
  "task.created": "webhooks.event.task_created",
  "task.status_changed": "webhooks.event.task_status_changed",
  "task.completed": "webhooks.event.task_completed",
  "comment.created": "webhooks.event.comment_created",
  "approval.requested": "webhooks.event.approval_requested",
  "approval.reviewed": "webhooks.event.approval_reviewed",
  "invoice.created": "webhooks.event.invoice_created",
  "project.updated": "webhooks.event.project_updated",
};

const ALL_EVENTS = Object.keys(EVENT_LABEL_KEYS);

// --- Helpers ---

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString(locale === "en" ? "en-US" : "ru-RU", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

function formatRelativeDate(dateStr: string, t: (key: string) => string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMinutes < 1) return t('webhooks.just_now');
    if (diffMinutes < 60) return `${diffMinutes} ${t('webhooks.min_ago')}`;
    if (diffHours < 24) return `${diffHours}${t('webhooks.hours_ago')}`;
    if (diffDays === 1) return t('webhooks.yesterday');
    if (diffDays < 7) return `${diffDays} ${t('webhooks.days_ago')}`;
    return date.toLocaleDateString(locale === "en" ? "en-US" : "ru-RU", { day: "numeric", month: "short" });
  } catch {
    return dateStr;
  }
}

// --- Component ---

export default function WebhooksPage() {
  const { t } = useLocale();
  const [loading, setLoading] = useState(true);
  const [webhooks, setWebhooks] = useState<WebhookData[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [copiedSecret, setCopiedSecret] = useState<string | null>(null);

  // Create form state
  const [newUrl, setNewUrl] = useState("");
  const [newProjectId, setNewProjectId] = useState("all");
  const [newEvents, setNewEvents] = useState<string[]>([]);

  // Newly created webhook secret (shown once)
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);
  const [createdSecretDialogOpen, setCreatedSecretDialogOpen] = useState(false);

  // Test result
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; message: string } | null>(null);

  const fetchWebhooks = useCallback(async () => {
    try {
      const data = await api.get<WebhookData[]>("/api/projects/webhooks");
      setWebhooks(data || []);
    } catch {
      setWebhooks([]);
    }
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [_, projectsData] = await Promise.all([
          fetchWebhooks(),
          api.get<Project[]>("/api/projects/projects"),
        ]);
        setProjects((projectsData || []).map((p: any) => ({ id: p.id, title: p.title })));
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [fetchWebhooks]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUrl.trim() || newEvents.length === 0) return;
    setCreating(true);

    try {
      const body: any = {
        url: newUrl.trim(),
        events: newEvents,
      };
      if (newProjectId && newProjectId !== "all") {
        body.projectId = newProjectId;
      }

      const result = await api.post<WebhookData>("/api/projects/webhooks", body);
      setWebhooks((prev) => [result, ...prev]);
      setCreatedSecret(result.secret);
      setCreateDialogOpen(false);
      setCreatedSecretDialogOpen(true);

      // Reset form
      setNewUrl("");
      setNewProjectId("all");
      setNewEvents([]);
    } catch (err: any) {
      alert(err?.message || t('webhooks.create_error'));
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('webhooks.delete_confirm'))) return;
    setDeletingId(id);
    try {
      await api.delete(`/api/projects/webhooks/${id}`);
      setWebhooks((prev) => prev.filter((w) => w.id !== id));
    } catch (err: any) {
      alert(err?.message || t('webhooks.delete_error'));
    } finally {
      setDeletingId(null);
    }
  };

  const handleTest = async (id: string) => {
    setTestingId(id);
    setTestResult(null);
    try {
      const result = await api.post<{ success: boolean; statusCode?: number; error?: string }>(
        `/api/projects/webhooks/test/${id}`
      );
      setTestResult({
        id,
        success: result.success,
        message: result.success
          ? `HTTP ${result.statusCode}`
          : result.error || t('common.error'),
      });
      // Refresh to get updated lastTriggeredAt
      await fetchWebhooks();
    } catch (err: any) {
      setTestResult({
        id,
        success: false,
        message: err?.message || t('webhooks.send_error'),
      });
    } finally {
      setTestingId(null);
    }
  };

  const handleToggleActive = async (id: string, active: boolean) => {
    try {
      const updated = await api.patch<WebhookData>(`/api/projects/webhooks/${id}`, { active });
      setWebhooks((prev) => prev.map((w) => (w.id === id ? { ...w, ...updated } : w)));
    } catch {
      // ignore
    }
  };

  const toggleEvent = (event: string) => {
    setNewEvents((prev) =>
      prev.includes(event)
        ? prev.filter((e) => e !== event)
        : [...prev, event]
    );
  };

  const selectAllEvents = () => {
    setNewEvents(newEvents.length === ALL_EVENTS.length ? [] : [...ALL_EVENTS]);
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedSecret(id);
      setTimeout(() => setCopiedSecret(null), 2000);
    });
  };

  const getProjectName = (projectId: string | null) => {
    if (!projectId) return t('webhooks.all_projects');
    const project = projects.find((p) => p.id === projectId);
    return project?.title || projectId;
  };

  if (loading) {
    return (
      <div className="space-y-6 max-w-4xl">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div>
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-64 mt-1" />
          </div>
        </div>
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-purple-700 text-white">
            <Webhook className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t('webhooks.title')}</h1>
            <p className="text-sm text-muted-foreground">
              {t('webhooks.subtitle')}
            </p>
          </div>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 shadow-sm">
              <Plus className="h-4 w-4" />
              {t('webhooks.create')}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-[95vw] sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{t('webhooks.new_webhook')}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 mt-2">
              <div className="space-y-2">
                <Label htmlFor="webhook-url">{t('webhooks.url_label')}</Label>
                <Input
                  id="webhook-url"
                  type="url"
                  placeholder="https://example.com/webhook"
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  {t('webhooks.url_hint')}
                </p>
              </div>

              <div className="space-y-2">
                <Label>{t('webhooks.project_label')}</Label>
                <Select value={newProjectId} onValueChange={setNewProjectId}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('webhooks.all_projects')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('webhooks.all_projects')}</SelectItem>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {t('webhooks.project_hint')}
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>{t('webhooks.events_label')}</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-xs h-auto py-1"
                    onClick={selectAllEvents}
                  >
                    {newEvents.length === ALL_EVENTS.length ? t('webhooks.deselect_all') : t('webhooks.select_all')}
                  </Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 border rounded-lg p-3">
                  {ALL_EVENTS.map((event) => (
                    <label
                      key={event}
                      className="flex items-center gap-2 cursor-pointer hover:bg-muted/50 rounded px-2 py-1.5 -mx-1"
                    >
                      <input
                        type="checkbox"
                        checked={newEvents.includes(event)}
                        onChange={() => toggleEvent(event)}
                        className="rounded border-input h-4 w-4 accent-primary"
                      />
                      <span className="text-sm">{t(EVENT_LABEL_KEYS[event])}</span>
                      <span className="text-xs text-muted-foreground ml-auto font-mono">
                        {event}
                      </span>
                    </label>
                  ))}
                </div>
                {newEvents.length === 0 && (
                  <p className="text-xs text-red-500">{t('webhooks.min_one_event')}</p>
                )}
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCreateDialogOpen(false)}
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  type="submit"
                  disabled={!newUrl.trim() || newEvents.length === 0 || creating}
                >
                  {creating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      {t('webhooks.creating')}
                    </>
                  ) : (
                    t('common.create')
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Secret reveal dialog */}
      <Dialog open={createdSecretDialogOpen} onOpenChange={setCreatedSecretDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('webhooks.secret_title')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
              <p className="text-sm text-amber-700 dark:text-amber-300">
                {t('webhooks.secret_warning')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-muted rounded-md px-3 py-2 text-sm font-mono break-all">
                {createdSecret}
              </code>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={() => copyToClipboard(createdSecret || "", "created")}
              >
                {copiedSecret === "created" ? (
                  <Check className="h-4 w-4 text-emerald-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {t('webhooks.secret_hint')}
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => setCreatedSecretDialogOpen(false)}>{t('webhooks.understood')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Webhook list */}
      {webhooks.length === 0 ? (
        <div className="text-center py-16">
          <div className="rounded-full bg-muted p-6 mx-auto w-fit mb-4">
            <Webhook className="h-10 w-10 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-1">{t('webhooks.no_webhooks')}</h3>
          <p className="text-sm text-muted-foreground mb-4">
            {t('webhooks.no_webhooks_desc')}
          </p>
          <Button className="gap-2" onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            {t('webhooks.create')}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {webhooks.map((webhook) => (
            <Card key={webhook.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex items-center gap-2 shrink-0">
                      <Switch
                        checked={webhook.active}
                        onCheckedChange={(checked) => handleToggleActive(webhook.id, checked)}
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-sm font-mono truncate">
                          {webhook.url}
                        </CardTitle>
                        <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {getProjectName(webhook.projectId)}
                        {" \u00B7 "}
                        {t('api.created_label')} {formatDate(webhook.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {webhook.active ? (
                      <Badge
                        variant="outline"
                        className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 text-[10px]"
                      >
                        <Power className="h-3 w-3 mr-1" />
                        {t('webhooks.active')}
                      </Badge>
                    ) : (
                      <Badge
                        variant="outline"
                        className="bg-slate-500/10 text-slate-500 border-slate-500/20 text-[10px]"
                      >
                        <PowerOff className="h-3 w-3 mr-1" />
                        {t('webhooks.disabled')}
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Events */}
                <div className="flex flex-wrap gap-1.5">
                  {webhook.events.map((event) => (
                    <Badge key={event} variant="secondary" className="text-[10px] font-normal">
                      {EVENT_LABEL_KEYS[event] ? t(EVENT_LABEL_KEYS[event]) : event}
                    </Badge>
                  ))}
                </div>

                {/* Secret */}
                <div className="flex items-center gap-2 text-xs text-muted-foreground min-w-0">
                  <span className="shrink-0">{t('webhooks.secret_label')}:</span>
                  <code className="bg-muted rounded px-1.5 py-0.5 font-mono truncate">{webhook.secret}</code>
                </div>

                {/* Status row */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs text-muted-foreground">
                    {webhook.lastTriggeredAt && (
                      <span>
                        {t('webhooks.last_triggered')}: {formatRelativeDate(webhook.lastTriggeredAt, t)}
                      </span>
                    )}
                    {webhook.lastError && (
                      <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
                        <AlertTriangle className="h-3 w-3" />
                        {webhook.lastError}
                      </span>
                    )}
                    {webhook.lastTriggeredAt && !webhook.lastError && (
                      <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="h-3 w-3" />
                        OK
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* Test result inline */}
                    {testResult && testResult.id === webhook.id && (
                      <span
                        className={`text-xs mr-2 ${
                          testResult.success
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-red-600 dark:text-red-400"
                        }`}
                      >
                        {testResult.success ? "OK" : t('common.error')}: {testResult.message}
                      </span>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1 text-xs h-7"
                      disabled={testingId === webhook.id}
                      onClick={() => handleTest(webhook.id)}
                    >
                      {testingId === webhook.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <TestTube className="h-3 w-3" />
                      )}
                      {t('webhooks.test')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1 text-xs h-7 text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
                      disabled={deletingId === webhook.id}
                      onClick={() => handleDelete(webhook.id)}
                    >
                      {deletingId === webhook.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Trash2 className="h-3 w-3" />
                      )}
                      {t('webhooks.delete')}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Separator />

      {/* Info section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{t('webhooks.how_it_works')}</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground space-y-2">
          <p>
            {t('webhooks.how_desc_1')}
          </p>
          <p>
            {t('webhooks.how_desc_2_prefix')}{" "}
            <code className="bg-muted rounded px-1 py-0.5 font-mono">X-Envelope-Signature</code>.
            {" "}{t('webhooks.how_desc_2_suffix')}{" "}
            <code className="bg-muted rounded px-1 py-0.5 font-mono">X-Envelope-Event</code>.
          </p>
          <p>
            {t('webhooks.how_desc_3')}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
