"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Video,
  Plus,
  Calendar,
  Clock,
  Users,
  CheckCircle,
  AlertCircle,
  ThumbsUp,
  FileText,
  Zap,
  ChevronRight,
  Timer,
  Mic,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";

interface MeetingSlot {
  id: string;
  startTime: string;
  endTime: string;
  votes: string[];
}

interface Meeting {
  id: string;
  title: string;
  projectId: string;
  epochId: string | null;
  taskId: string | null;
  organizerId: string;
  status: "SCHEDULING" | "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  scheduledAt: string | null;
  duration: number | null;
  recordingUrl: string | null;
  transcription: string | null;
  summary: string | null;
  participants: string[];
  slots: MeetingSlot[];
  epoch: { id: string; title: string } | null;
  task: { id: string; title: string; status: string } | null;
  documents: { document: { id: string; title: string } }[];
}

interface Project {
  id: string;
  title: string;
}

const statusConfig: Record<string, { label: string; color: string }> = {
  SCHEDULING: { label: "Согласование", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  SCHEDULED: { label: "Запланирована", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  IN_PROGRESS: { label: "Идёт сейчас", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
  COMPLETED: { label: "Завершена", color: "bg-muted text-muted-foreground" },
  CANCELLED: { label: "Отменена", color: "bg-muted text-muted-foreground" },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ru", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function formatSlotTime(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  return `${s.toLocaleDateString("ru", { day: "numeric", month: "short" })} ${s.toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" })} – ${e.toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" })}`;
}

export default function MeetingsPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [detailOpen, setDetailOpen] = useState<Meeting | null>(null);
  const [transcriptInput, setTranscriptInput] = useState("");
  const [summarizing, setSummarizing] = useState(false);

  const [form, setForm] = useState({
    title: "",
    projectId: "",
    taskId: "",
    scheduledAt: "",
    duration: "60",
    useSlots: false,
    slots: [{ startTime: "", endTime: "" }],
    participants: [] as string[],
  });
  const [projectUsers, setProjectUsers] = useState<any[]>([]);

  useEffect(() => { loadProjects(); }, []);
  useEffect(() => {
    if (projects.length > 0) loadMeetings();
  }, [projects, selectedProject]);

  useEffect(() => {
    if (form.projectId) {
      api.get<any[]>(`/api/auth/users`).then(u => setProjectUsers(u || [])).catch(() => {});
    }
  }, [form.projectId]);

  async function loadProjects() {
    try {
      const data = await api.get<Project[]>("/api/projects/projects");
      setProjects(data || []);
    } catch { setProjects([]); }
  }

  async function loadMeetings() {
    setLoading(true);
    try {
      const projectsToLoad = selectedProject === "all"
        ? projects
        : projects.filter(p => p.id === selectedProject);
      const all: Meeting[] = [];
      for (const proj of projectsToLoad) {
        try {
          const data = await api.get<Meeting[]>(`/api/projects/meetings/project/${proj.id}`);
          all.push(...(data || []));
        } catch {}
      }
      setMeetings(all.sort((a, b) => {
        if (a.status === "SCHEDULING" && b.status !== "SCHEDULING") return -1;
        if (b.status === "SCHEDULING" && a.status !== "SCHEDULING") return 1;
        return (b.scheduledAt || b.createdAt || "") > (a.scheduledAt || a.createdAt || "") ? 1 : -1;
      }));
    } finally { setLoading(false); }
  }

  async function handleCreate() {
    if (!form.title || !form.projectId) return;
    setCreating(true);
    try {
      await api.post("/api/projects/meetings", {
        title: form.title,
        projectId: form.projectId,
        taskId: form.taskId || null,
        participants: form.participants.includes(user?.id || "") ? form.participants : [...form.participants, user?.id],
        scheduledAt: form.useSlots ? undefined : (form.scheduledAt || undefined),
        duration: parseInt(form.duration) || 60,
        slots: form.useSlots ? form.slots.filter(s => s.startTime && s.endTime) : [],
      });
      setCreateOpen(false);
      setForm({ title: "", projectId: "", taskId: "", scheduledAt: "", duration: "60", useSlots: false, slots: [{ startTime: "", endTime: "" }], participants: [] });
      await loadMeetings();
    } catch (err) { console.error(err); }
    finally { setCreating(false); }
  }

  async function handleVote(meetingId: string, slotId: string) {
    try {
      await api.post(`/api/projects/meetings/${meetingId}/vote`, { slotId });
      await loadMeetings();
      if (detailOpen?.id === meetingId) {
        const updated = await api.get<Meeting>(`/api/projects/meetings/${meetingId}`);
        setDetailOpen(updated);
      }
    } catch {}
  }

  async function handleSummarize(meeting: Meeting) {
    setSummarizing(true);
    try {
      // First patch transcription if provided
      if (transcriptInput) {
        await api.patch(`/api/projects/meetings/${meeting.id}`, { transcription: transcriptInput });
      }
      const res = await api.post<any>(`/api/projects/meetings/${meeting.id}/summarize`);
      await loadMeetings();
      if (res.meeting) setDetailOpen(res.meeting);
    } catch {} finally { setSummarizing(false); }
  }

  const schedulingMeetings = meetings.filter(m => m.status === "SCHEDULING");
  const upcomingMeetings = meetings.filter(m => m.status === "SCHEDULED");
  const pastMeetings = meetings.filter(m => m.status === "COMPLETED" || m.status === "CANCELLED");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Встречи</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Планирование, согласование слотов и автосуммаризация встреч
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={selectedProject} onValueChange={setSelectedProject}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Все проекты" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все проекты</SelectItem>
              {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Новая встреча
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      ) : meetings.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-center">
          <Video className="h-12 w-12 text-muted-foreground/40 mb-4" />
          <p className="font-medium text-muted-foreground">Встреч пока нет</p>
          <Button className="mt-4" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Создать встречу
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Requiring attention */}
          {schedulingMeetings.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-amber-600 mb-3 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Требуют согласования ({schedulingMeetings.length})
              </h2>
              <div className="space-y-2">
                {schedulingMeetings.map(m => <MeetingCard key={m.id} meeting={m} userId={user?.id || ""} onVote={handleVote} onClick={() => setDetailOpen(m)} />)}
              </div>
            </section>
          )}

          {/* Upcoming */}
          {upcomingMeetings.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Предстоящие ({upcomingMeetings.length})
              </h2>
              <div className="space-y-2">
                {upcomingMeetings.map(m => <MeetingCard key={m.id} meeting={m} userId={user?.id || ""} onVote={handleVote} onClick={() => setDetailOpen(m)} />)}
              </div>
            </section>
          )}

          {/* Past */}
          {pastMeetings.length > 0 && (
            <section>
              <h2 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                <CheckCircle className="h-4 w-4" />
                Прошедшие ({pastMeetings.length})
              </h2>
              <div className="space-y-2">
                {pastMeetings.map(m => <MeetingCard key={m.id} meeting={m} userId={user?.id || ""} onVote={handleVote} onClick={() => setDetailOpen(m)} />)}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Create meeting dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Создать встречу</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
            <div className="space-y-2">
              <Label>Название *</Label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Обсуждение задачи..." />
            </div>
            <div className="space-y-2">
              <Label>Проект *</Label>
              <Select value={form.projectId} onValueChange={v => setForm(f => ({ ...f, projectId: v }))}>
                <SelectTrigger><SelectValue placeholder="Выберите проект" /></SelectTrigger>
                <SelectContent>{projects.map(p => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <input type="checkbox" checked={form.useSlots} onChange={e => setForm(f => ({ ...f, useSlots: e.target.checked }))} />
                Двустороннее согласование слотов
              </Label>
              <p className="text-xs text-muted-foreground">
                Участники проголосуют за удобное время — система автоматически выберет ближайшее пересечение
              </p>
            </div>
            {form.useSlots ? (
              <div className="space-y-2">
                <Label>Предложите слоты времени</Label>
                {form.slots.map((slot, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <Input type="datetime-local" value={slot.startTime}
                      onChange={e => setForm(f => ({ ...f, slots: f.slots.map((s, j) => j === i ? { ...s, startTime: e.target.value } : s) }))} />
                    <span className="text-muted-foreground text-sm">–</span>
                    <Input type="datetime-local" value={slot.endTime}
                      onChange={e => setForm(f => ({ ...f, slots: f.slots.map((s, j) => j === i ? { ...s, endTime: e.target.value } : s) }))} />
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => setForm(f => ({ ...f, slots: [...f.slots, { startTime: "", endTime: "" }] }))}>
                  <Plus className="h-3 w-3 mr-1" /> Добавить слот
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Дата и время</Label>
                  <Input type="datetime-local" value={form.scheduledAt} onChange={e => setForm(f => ({ ...f, scheduledAt: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Длительность (мин)</Label>
                  <Input type="number" value={form.duration} onChange={e => setForm(f => ({ ...f, duration: e.target.value }))} min={15} step={15} />
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Отмена</Button>
            <Button onClick={handleCreate} disabled={!form.title || !form.projectId || creating}>
              {creating ? "Создание..." : "Создать"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Meeting detail dialog */}
      {detailOpen && (
        <Dialog open={!!detailOpen} onOpenChange={() => setDetailOpen(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Video className="h-5 w-5" />
                {detailOpen.title}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className={statusConfig[detailOpen.status].color}>
                  {statusConfig[detailOpen.status].label}
                </Badge>
                {detailOpen.scheduledAt && (
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {formatDate(detailOpen.scheduledAt)}
                  </span>
                )}
                {detailOpen.duration && (
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <Timer className="h-4 w-4" />
                    {detailOpen.duration} мин
                  </span>
                )}
              </div>

              {/* Slot voting */}
              {detailOpen.status === "SCHEDULING" && detailOpen.slots.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">Проголосуйте за удобное время</h3>
                  <p className="text-xs text-muted-foreground">
                    Система автоматически выберет слот, когда все участники проголосуют
                  </p>
                  <div className="space-y-2">
                    {detailOpen.slots.map(slot => {
                      const hasVoted = slot.votes.includes(user?.id || "");
                      const totalParticipants = detailOpen.participants.length;
                      const voteCount = slot.votes.length;
                      return (
                        <div key={slot.id} className={`border rounded-lg p-3 flex items-center gap-3 ${hasVoted ? "border-primary bg-primary/5" : ""}`}>
                          <div className="flex-1">
                            <p className="text-sm font-medium">{formatSlotTime(slot.startTime, slot.endTime)}</p>
                            <p className="text-xs text-muted-foreground">{voteCount} / {totalParticipants} проголосовали</p>
                          </div>
                          <Button
                            size="sm"
                            variant={hasVoted ? "default" : "outline"}
                            onClick={() => handleVote(detailOpen.id, slot.id)}
                          >
                            <ThumbsUp className="h-4 w-4 mr-1" />
                            {hasVoted ? "Выбрано" : "Выбрать"}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Linked task */}
              {detailOpen.task && (
                <div>
                  <h3 className="text-sm font-semibold mb-2">Связанная задача</h3>
                  <div className="border rounded-lg p-3 flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">{detailOpen.task.status}</Badge>
                    <span className="text-sm">{detailOpen.task.title}</span>
                  </div>
                </div>
              )}

              {/* Linked documents */}
              {detailOpen.documents.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold mb-2">Документы</h3>
                  <div className="space-y-1">
                    {detailOpen.documents.map(d => (
                      <div key={d.document.id} className="flex items-center gap-2 text-sm p-2 border rounded">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        {d.document.title}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* AI Summary */}
              {detailOpen.summary && (
                <div>
                  <h3 className="text-sm font-semibold mb-2 flex items-center gap-1">
                    <Zap className="h-4 w-4 text-amber-500" />
                    AI-суммаризация
                  </h3>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-sm whitespace-pre-wrap">{detailOpen.summary}</p>
                  </div>
                </div>
              )}

              {/* Transcription + summarize */}
              {!detailOpen.summary && (detailOpen.status === "COMPLETED" || detailOpen.transcription) && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold flex items-center gap-1">
                    <Mic className="h-4 w-4" />
                    Транскрипция встречи
                  </h3>
                  <Textarea
                    value={transcriptInput || detailOpen.transcription || ""}
                    onChange={e => setTranscriptInput(e.target.value)}
                    placeholder="Вставьте транскрипцию встречи для AI-суммаризации..."
                    rows={5}
                  />
                  <Button
                    onClick={() => handleSummarize(detailOpen)}
                    disabled={summarizing || (!transcriptInput && !detailOpen.transcription)}
                    className="w-full"
                  >
                    <Zap className="h-4 w-4 mr-2" />
                    {summarizing ? "Суммаризация..." : "Сформировать AI-итоги"}
                  </Button>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function MeetingCard({
  meeting,
  userId,
  onVote,
  onClick,
}: {
  meeting: Meeting;
  userId: string;
  onVote: (meetingId: string, slotId: string) => void;
  onClick: () => void;
}) {
  const sc = statusConfig[meeting.status];
  const hasUserVoted = meeting.slots.some(s => s.votes.includes(userId));

  return (
    <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={onClick}>
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Video className="h-4 w-4 text-muted-foreground shrink-0" />
              <h3 className="font-medium truncate">{meeting.title}</h3>
              <Badge className={`${sc.color} text-xs shrink-0`}>{sc.label}</Badge>
              {meeting.status === "SCHEDULING" && !hasUserVoted && (
                <Badge variant="destructive" className="text-xs shrink-0">Нужен голос</Badge>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              {meeting.scheduledAt && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {formatDate(meeting.scheduledAt)}
                </span>
              )}
              {meeting.status === "SCHEDULING" && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {meeting.slots.length} слотов на выбор
                </span>
              )}
              {meeting.task && (
                <span className="flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  {meeting.task.title}
                </span>
              )}
              {meeting.summary && (
                <span className="flex items-center gap-1 text-emerald-600">
                  <Zap className="h-3 w-3" />
                  AI-итоги готовы
                </span>
              )}
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
        </div>
      </CardContent>
    </Card>
  );
}
