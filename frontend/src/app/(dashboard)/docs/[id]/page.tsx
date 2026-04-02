"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Save,
  Clock,
  Globe,
  Users,
  Lock,
  CheckCircle,
  AlertCircle,
  FileText,
  History,
  Link2,
  Video,
  ChevronDown,
  ChevronUp,
  Plus,
  X,
  GitBranch,
  Zap,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
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
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";

interface DocumentVersion {
  id: string;
  version: number;
  title: string;
  content: any;
  changelog: string | null;
  createdBy: string;
  meetingId: string | null;
  createdAt: string;
}

interface TaskRef {
  id: string;
  taskId: string;
  quote: string | null;
  task: { id: string; title: string; status: string; priority: string };
}

interface MeetingLink {
  meeting: { id: string; title: string; status: string; scheduledAt: string | null; summary: string | null };
}

interface Document {
  id: string;
  title: string;
  content: any;
  status: "DRAFT" | "PENDING_REVIEW" | "APPROVED" | "ARCHIVED";
  visibility: "PUBLIC" | "TEAM" | "MANAGERS_ONLY";
  projectId: string;
  epochId: string | null;
  epoch: { id: string; title: string } | null;
  createdBy: string;
  updatedAt: string;
  versions: DocumentVersion[];
  taskRefs: TaskRef[];
  meetings: MeetingLink[];
}

const statusColors: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  PENDING_REVIEW: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  APPROVED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  ARCHIVED: "bg-muted text-muted-foreground",
};

const taskStatusColors: Record<string, string> = {
  BACKLOG: "bg-muted text-muted-foreground",
  TODO: "bg-blue-100 text-blue-700",
  IN_PROGRESS: "bg-violet-100 text-violet-700",
  REVIEW: "bg-amber-100 text-amber-700",
  DONE: "bg-emerald-100 text-emerald-700",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ru", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function contentToText(content: any): string {
  if (!content) return "";
  if (typeof content === "string") return content;
  if (content.type === "doc" || content.type === "paragraph") {
    return (content.content || []).map(contentToText).join("\n");
  }
  if (content.type === "text") return content.text || "";
  return (content.content || []).map(contentToText).join("\n");
}

function textToContent(text: string): any {
  return {
    type: "doc",
    content: text.split("\n").map(line => ({
      type: "paragraph",
      content: line ? [{ type: "text", text: line }] : [],
    })),
  };
}

export default function DocPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [doc, setDoc] = useState<Document | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editChangelog, setEditChangelog] = useState("");
  const [hasChanges, setHasChanges] = useState(false);

  const [showVersions, setShowVersions] = useState(true);
  const [showTaskLinks, setShowTaskLinks] = useState(true);
  const [showMeetings, setShowMeetings] = useState(true);

  const [linkTaskOpen, setLinkTaskOpen] = useState(false);
  const [availableTasks, setAvailableTasks] = useState<any[]>([]);
  const [linkForm, setLinkForm] = useState({ taskId: "", quote: "" });
  const [linking, setLinking] = useState(false);

  const [changelogOpen, setChangelogOpen] = useState(false);
  const [pendingSave, setPendingSave] = useState(false);

  const contentRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    loadDoc();
  }, [id]);

  async function loadDoc() {
    setLoading(true);
    try {
      const data = await api.get<Document>(`/api/projects/documents/${id}`);
      setDoc(data);
      setEditTitle(data.title);
      setEditContent(contentToText(data.content));
    } catch {
      router.push("/docs");
    } finally {
      setLoading(false);
    }
  }

  async function loadTasks() {
    if (!doc) return;
    try {
      const tasks = await api.get<any[]>(`/api/projects/tasks/project/${doc.projectId}`);
      setAvailableTasks(tasks || []);
    } catch {}
  }

  function handleContentChange(val: string) {
    setEditContent(val);
    setHasChanges(true);
  }

  function handleTitleChange(val: string) {
    setEditTitle(val);
    setHasChanges(true);
  }

  async function handleSave(changelog?: string) {
    if (!doc || !hasChanges) return;
    setSaving(true);
    try {
      const updated = await api.patch<Document>(`/api/projects/documents/${doc.id}`, {
        title: editTitle,
        content: textToContent(editContent),
        changelog: changelog || null,
      });
      setDoc(updated);
      setHasChanges(false);
      setEditChangelog("");
      setChangelogOpen(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(status: string) {
    if (!doc) return;
    try {
      if (status === "APPROVED") {
        await api.post(`/api/projects/documents/${doc.id}/approve`);
      } else {
        await api.patch(`/api/projects/documents/${doc.id}`, { status });
      }
      await loadDoc();
    } catch {}
  }

  async function handleLinkTask() {
    if (!doc || !linkForm.taskId) return;
    setLinking(true);
    try {
      await api.post(`/api/projects/documents/${doc.id}/task-refs`, {
        taskId: linkForm.taskId,
        quote: linkForm.quote || null,
      });
      await loadDoc();
      setLinkTaskOpen(false);
      setLinkForm({ taskId: "", quote: "" });
    } catch {}
    finally { setLinking(false); }
  }

  async function handleUnlinkTask(taskId: string) {
    if (!doc) return;
    try {
      await api.delete(`/api/projects/documents/${doc.id}/task-refs/${taskId}`);
      await loadDoc();
    } catch {}
  }

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  if (!doc) return null;

  const canEdit = user?.role === "MANAGER" || user?.role === "DEVELOPER";
  const canApprove = user?.role === "MANAGER";
  const currentVersion = doc.versions[0]?.version || 1;

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      {/* Top bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="sm" onClick={() => router.push("/docs")}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Документы
        </Button>
        <div className="flex-1" />
        {hasChanges && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setChangelogOpen(true)}
          >
            <Save className="h-4 w-4 mr-1" />
            Сохранить изменения
          </Button>
        )}
        {doc.status === "DRAFT" && canEdit && (
          <Button size="sm" variant="outline" onClick={() => handleStatusChange("PENDING_REVIEW")}>
            <AlertCircle className="h-4 w-4 mr-1" />
            На проверку
          </Button>
        )}
        {doc.status === "PENDING_REVIEW" && canApprove && (
          <Button size="sm" onClick={() => handleStatusChange("APPROVED")}>
            <CheckCircle className="h-4 w-4 mr-1" />
            Утвердить
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4">
        {/* Main editor */}
        <div className="space-y-4">
          {/* Document meta */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={statusColors[doc.status]}>
              {doc.status === "DRAFT" ? "Черновик" :
               doc.status === "PENDING_REVIEW" ? "На проверке" :
               doc.status === "APPROVED" ? "Утверждён" : "Архив"}
            </Badge>
            <Badge variant="outline" className="gap-1">
              {doc.visibility === "PUBLIC" ? <Globe className="h-3 w-3 text-blue-500" /> :
               doc.visibility === "TEAM" ? <Users className="h-3 w-3 text-violet-500" /> :
               <Lock className="h-3 w-3 text-rose-500" />}
              {doc.visibility === "PUBLIC" ? "Все участники" :
               doc.visibility === "TEAM" ? "Команда" : "Только менеджеры"}
            </Badge>
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              v{currentVersion} · {formatDate(doc.updatedAt)}
            </span>
            {doc.epoch && (
              <Badge variant="outline" className="text-xs">
                Эпоха: {doc.epoch.title}
              </Badge>
            )}
          </div>

          {/* Title */}
          {canEdit ? (
            <Input
              value={editTitle}
              onChange={e => handleTitleChange(e.target.value)}
              className="text-2xl font-bold border-none shadow-none px-0 h-auto text-2xl focus-visible:ring-0"
              placeholder="Название документа"
            />
          ) : (
            <h1 className="text-2xl font-bold">{doc.title}</h1>
          )}

          {/* Content area */}
          <div className="min-h-[500px] border rounded-lg">
            {canEdit ? (
              <Textarea
                ref={contentRef}
                value={editContent}
                onChange={e => handleContentChange(e.target.value)}
                className="min-h-[500px] border-none resize-none shadow-none focus-visible:ring-0 font-mono text-sm p-4"
                placeholder="Начните вводить текст документа...

Используйте Markdown для форматирования:
# Заголовок 1
## Заголовок 2
**Жирный текст**
- Список элементов

[Ссылка на задачу] — упомяните задачу по ID"
              />
            ) : (
              <div className="p-4 whitespace-pre-wrap font-mono text-sm">
                {editContent || <span className="text-muted-foreground">Документ пуст</span>}
              </div>
            )}
          </div>

          {/* Inline task status widgets */}
          {doc.taskRefs.length > 0 && (
            <div className="border rounded-lg p-4 space-y-2 bg-muted/30">
              <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                <Zap className="h-3 w-3" />
                Связанные задачи — статус в реальном времени
              </p>
              {doc.taskRefs.map(ref => (
                <div key={ref.id} className="flex items-start gap-3 p-2 bg-background rounded border">
                  <Badge className={`${taskStatusColors[ref.task.status]} text-xs shrink-0`}>
                    {ref.task.status === "BACKLOG" ? "Беклог" :
                     ref.task.status === "TODO" ? "К выполнению" :
                     ref.task.status === "IN_PROGRESS" ? "В работе" :
                     ref.task.status === "REVIEW" ? "Проверка" : "Готово"}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{ref.task.title}</p>
                    {ref.quote && (
                      <blockquote className="text-xs text-muted-foreground border-l-2 pl-2 mt-1 italic">
                        «{ref.quote}»
                      </blockquote>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <div className="space-y-4">
          {/* Version history */}
          <div className="border rounded-lg overflow-hidden">
            <button
              className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
              onClick={() => setShowVersions(!showVersions)}
            >
              <span className="text-sm font-medium flex items-center gap-2">
                <History className="h-4 w-4" />
                История версий ({doc.versions.length})
              </span>
              {showVersions ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {showVersions && (
              <div className="border-t divide-y max-h-72 overflow-y-auto">
                {doc.versions.map(v => (
                  <div key={v.id} className="p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className={`text-sm font-medium ${v.version === currentVersion ? "text-primary" : ""}`}>
                        v{v.version} {v.version === currentVersion && <span className="text-xs font-normal text-muted-foreground ml-1">текущая</span>}
                      </span>
                      <div className="flex items-center gap-1">
                        {v.meetingId && (
                          <Badge variant="outline" className="text-xs">
                            <Video className="h-3 w-3 mr-1" />
                            Встреча
                          </Badge>
                        )}
                        {canEdit && v.version !== currentVersion && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-1.5 text-xs text-muted-foreground hover:text-foreground"
                            onClick={() => {
                              setEditTitle(v.title);
                              setEditContent(contentToText(v.content));
                              setEditChangelog(`Восстановлена версия v${v.version}`);
                              setHasChanges(true);
                            }}
                            title="Восстановить эту версию"
                          >
                            <RotateCcw className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                    {v.changelog && (
                      <p className="text-xs text-muted-foreground">{v.changelog}</p>
                    )}
                    <p className="text-xs text-muted-foreground">{formatDate(v.createdAt)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Linked tasks */}
          <div className="border rounded-lg overflow-hidden">
            <div className="flex items-center justify-between p-3">
              <button
                className="flex items-center gap-2 text-sm font-medium hover:text-primary transition-colors"
                onClick={() => setShowTaskLinks(!showTaskLinks)}
              >
                <Link2 className="h-4 w-4" />
                Задачи ({doc.taskRefs.length})
                {showTaskLinks ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              {canEdit && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0"
                  onClick={() => { setLinkTaskOpen(true); loadTasks(); }}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              )}
            </div>
            {showTaskLinks && doc.taskRefs.length > 0 && (
              <div className="border-t divide-y">
                {doc.taskRefs.map(ref => (
                  <div key={ref.id} className="p-3 flex items-start gap-2">
                    <Badge className={`${taskStatusColors[ref.task.status]} text-xs shrink-0`}>
                      {ref.task.status}
                    </Badge>
                    <p className="text-xs flex-1 truncate">{ref.task.title}</p>
                    {canEdit && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-5 w-5 p-0 shrink-0"
                        onClick={() => handleUnlinkTask(ref.taskId)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Linked meetings */}
          <div className="border rounded-lg overflow-hidden">
            <button
              className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
              onClick={() => setShowMeetings(!showMeetings)}
            >
              <span className="text-sm font-medium flex items-center gap-2">
                <Video className="h-4 w-4" />
                Встречи ({doc.meetings.length})
              </span>
              {showMeetings ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {showMeetings && doc.meetings.length > 0 && (
              <div className="border-t divide-y">
                {doc.meetings.map(ml => (
                  <div key={ml.meeting.id} className="p-3 space-y-1">
                    <p className="text-sm font-medium">{ml.meeting.title}</p>
                    {ml.meeting.scheduledAt && (
                      <p className="text-xs text-muted-foreground">{formatDate(ml.meeting.scheduledAt)}</p>
                    )}
                    {ml.meeting.summary && (
                      <div className="bg-muted/50 rounded p-2 mt-1">
                        <p className="text-xs font-medium mb-1">AI-итоги:</p>
                        <p className="text-xs text-muted-foreground line-clamp-3">{ml.meeting.summary}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Changelog dialog */}
      <Dialog open={changelogOpen} onOpenChange={setChangelogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Сохранение изменений</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Опишите, что изменилось в этой версии (опционально). Это поможет отследить историю правок.
            </p>
            <Textarea
              value={editChangelog}
              onChange={e => setEditChangelog(e.target.value)}
              placeholder="Например: Добавлены требования к API, исправлены технические описания..."
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChangelogOpen(false)}>Отмена</Button>
            <Button onClick={() => handleSave(editChangelog)} disabled={saving}>
              {saving ? "Сохранение..." : "Сохранить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Link task dialog */}
      <Dialog open={linkTaskOpen} onOpenChange={setLinkTaskOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Привязать задачу к документу</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Задача</Label>
              <Select value={linkForm.taskId} onValueChange={v => setLinkForm(f => ({ ...f, taskId: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите задачу" />
                </SelectTrigger>
                <SelectContent>
                  {availableTasks.map(t => (
                    <SelectItem key={t.id} value={t.id}>
                      <span className="flex items-center gap-2">
                        <Badge className={`${taskStatusColors[t.status]} text-xs`}>{t.status}</Badge>
                        {t.title}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Цитата из документа (опционально)</Label>
              <Textarea
                value={linkForm.quote}
                onChange={e => setLinkForm(f => ({ ...f, quote: e.target.value }))}
                placeholder="Выделите конкретный текст из документа, относящийся к задаче..."
                rows={2}
              />
              <p className="text-xs text-muted-foreground">
                Цитата будет отображаться в карточке задачи как прямая ссылка на этот документ
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkTaskOpen(false)}>Отмена</Button>
            <Button onClick={handleLinkTask} disabled={!linkForm.taskId || linking}>
              {linking ? "Привязка..." : "Привязать"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
