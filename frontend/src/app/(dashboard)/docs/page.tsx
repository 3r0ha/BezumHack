"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  Plus,
  Search,
  Globe,
  Users,
  Lock,
  Clock,
  CheckCircle,
  AlertCircle,
  Archive,
  ChevronRight,
  FolderOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
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

interface Document {
  id: string;
  title: string;
  status: "DRAFT" | "PENDING_REVIEW" | "APPROVED" | "ARCHIVED";
  visibility: "PUBLIC" | "TEAM" | "MANAGERS_ONLY";
  projectId: string;
  epochId: string | null;
  createdBy: string;
  updatedAt: string;
  epoch: { id: string; title: string } | null;
  versions: { version: number; createdAt: string }[];
  taskRefs: { task: { id: string; title: string; status: string } }[];
}

interface Project {
  id: string;
  title: string;
}

const statusConfig = {
  DRAFT: { label: "Черновик", icon: FileText, color: "text-muted-foreground", badge: "secondary" as const },
  PENDING_REVIEW: { label: "На проверке", icon: AlertCircle, color: "text-amber-500", badge: "outline" as const },
  APPROVED: { label: "Утверждён", icon: CheckCircle, color: "text-emerald-500", badge: "default" as const },
  ARCHIVED: { label: "Архив", icon: Archive, color: "text-muted-foreground", badge: "secondary" as const },
};

const visibilityConfig = {
  PUBLIC: { label: "Все участники", icon: Globe, color: "text-blue-500" },
  TEAM: { label: "Команда", icon: Users, color: "text-violet-500" },
  MANAGERS_ONLY: { label: "Только менеджеры", icon: Lock, color: "text-rose-500" },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ru", { day: "numeric", month: "short", year: "numeric" });
}

export default function DocsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [docs, setDocs] = useState<Document[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [selectedProject, setSelectedProject] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    title: "",
    projectId: "",
    visibility: "PUBLIC",
    epochId: "",
  });
  const [epochs, setEpochs] = useState<{ id: string; title: string }[]>([]);

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    if (projects.length > 0) {
      loadDocs();
    }
  }, [projects, selectedProject]);

  useEffect(() => {
    if (form.projectId) {
      api
        .get<any[]>(`/api/projects/epochs/project/${form.projectId}`)
        .then(setEpochs)
        .catch(() => setEpochs([]));
    }
  }, [form.projectId]);

  async function loadProjects() {
    try {
      const data = await api.get<Project[]>("/api/projects/projects");
      setProjects(data || []);
    } catch {
      setProjects([]);
    }
  }

  async function loadDocs() {
    setLoading(true);
    try {
      const allDocs: Document[] = [];
      const projectsToLoad = selectedProject === "all" ? projects : projects.filter(p => p.id === selectedProject);
      for (const proj of projectsToLoad) {
        try {
          const data = await api.get<Document[]>(`/api/projects/documents/project/${proj.id}`);
          allDocs.push(...(data || []));
        } catch {}
      }
      setDocs(allDocs);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    if (!form.title || !form.projectId) return;
    setCreating(true);
    try {
      const doc = await api.post<Document>("/api/projects/documents", {
        title: form.title,
        projectId: form.projectId,
        visibility: form.visibility,
        epochId: form.epochId || null,
        content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "" }] }] },
      });
      setCreateOpen(false);
      setForm({ title: "", projectId: "", visibility: "PUBLIC", epochId: "" });
      router.push(`/docs/${doc.id}`);
    } catch (err) {
      console.error(err);
    } finally {
      setCreating(false);
    }
  }

  const filtered = docs.filter(d => {
    if (search && !d.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterStatus !== "all" && d.status !== filterStatus) return false;
    return true;
  });

  const grouped = filtered.reduce<Record<string, Document[]>>((acc, doc) => {
    const key = doc.epoch ? `epoch:${doc.epoch.id}:${doc.epoch.title}` : "no-epoch";
    if (!acc[key]) acc[key] = [];
    acc[key].push(doc);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Docs-core</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Документация с версионированием, ролевым доступом и интеграцией с задачами
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Создать документ
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Поиск документов..."
            className="pl-9"
          />
        </div>
        <Select value={selectedProject} onValueChange={setSelectedProject}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Все проекты" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все проекты</SelectItem>
            {projects.map(p => (
              <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Статус" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все статусы</SelectItem>
            {Object.entries(statusConfig).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Document list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <FileText className="h-12 w-12 text-muted-foreground/40 mb-4" />
          <p className="text-muted-foreground font-medium">Документов пока нет</p>
          <p className="text-sm text-muted-foreground mt-1">
            Создайте первый документ для проекта
          </p>
          <Button className="mt-4" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Создать документ
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([groupKey, groupDocs]) => {
            const isEpoch = groupKey.startsWith("epoch:");
            const epochTitle = isEpoch ? groupKey.split(":")[2] : null;

            return (
              <div key={groupKey}>
                <div className="flex items-center gap-2 mb-3">
                  <FolderOpen className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-muted-foreground">
                    {epochTitle ? `Эпоха: ${epochTitle}` : "Без эпохи"}
                  </span>
                  <span className="text-xs text-muted-foreground">({groupDocs.length})</span>
                </div>
                <div className="space-y-2">
                  {groupDocs.map(doc => {
                    const sc = statusConfig[doc.status];
                    const vc = visibilityConfig[doc.visibility];
                    const StatusIcon = sc.icon;
                    const VisibilityIcon = vc.icon;
                    const currentVersion = doc.versions[0]?.version || 1;

                    return (
                      <Card
                        key={doc.id}
                        className="cursor-pointer hover:shadow-md transition-shadow"
                        onClick={() => router.push(`/docs/${doc.id}`)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-medium truncate">{doc.title}</h3>
                                <Badge variant={sc.badge} className="shrink-0 text-xs">
                                  <StatusIcon className={`h-3 w-3 mr-1 ${sc.color}`} />
                                  {sc.label}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <VisibilityIcon className={`h-3 w-3 ${vc.color}`} />
                                  {vc.label}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  v{currentVersion} · {formatDate(doc.updatedAt)}
                                </span>
                                {doc.taskRefs.length > 0 && (
                                  <span className="flex items-center gap-1">
                                    <FileText className="h-3 w-3" />
                                    {doc.taskRefs.length} задач
                                  </span>
                                )}
                              </div>
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create document dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Новый документ</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Название *</Label>
              <Input
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Название документа"
              />
            </div>
            <div className="space-y-2">
              <Label>Проект *</Label>
              <Select value={form.projectId} onValueChange={v => setForm(f => ({ ...f, projectId: v, epochId: "" }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Выберите проект" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {epochs.length > 0 && (
              <div className="space-y-2">
                <Label>Эпоха (опционально)</Label>
                <Select value={form.epochId} onValueChange={v => setForm(f => ({ ...f, epochId: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Без привязки к эпохе" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Без привязки</SelectItem>
                    {epochs.map(e => (
                      <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Видимость</Label>
              <Select value={form.visibility} onValueChange={v => setForm(f => ({ ...f, visibility: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PUBLIC">
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-blue-500" />
                      Все участники проекта
                    </div>
                  </SelectItem>
                  <SelectItem value="TEAM">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-violet-500" />
                      Команда (без заказчика)
                    </div>
                  </SelectItem>
                  <SelectItem value="MANAGERS_ONLY">
                    <div className="flex items-center gap-2">
                      <Lock className="h-4 w-4 text-rose-500" />
                      Только менеджеры
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                PUBLIC — общие бизнес-требования · TEAM — технические документы · MANAGERS_ONLY — внутренние
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Отмена</Button>
            <Button
              onClick={handleCreate}
              disabled={!form.title || !form.projectId || creating}
            >
              {creating ? "Создание..." : "Создать"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
