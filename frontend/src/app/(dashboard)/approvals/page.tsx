"use client";

import { useEffect, useState, useMemo } from "react";
import {
  CheckSquare,
  Plus,
  Clock,
  CheckCircle2,
  XCircle,
  MessageSquare,
  Loader2,
  Filter,
  User,
  CalendarDays,
  FileText,
} from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { useUsers } from "@/hooks/use-users";
import { useLocale } from "@/contexts/locale-context";

// --- Types ---

interface Approval {
  id: string;
  title: string;
  description: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  projectId: string;
  projectTitle: string;
  requestedBy: string;
  reviewedBy?: string;
  reviewComment?: string;
  type: string;
  createdAt: string;
  reviewedAt?: string;
}

interface Project {
  id: string;
  title: string;
}

// --- Helpers ---

const statusConfigStyles: Record<string, { className: string; icon: typeof Clock }> = {
  PENDING: {
    className: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20",
    icon: Clock,
  },
  APPROVED: {
    className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20",
    icon: CheckCircle2,
  },
  REJECTED: {
    className: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/20",
    icon: XCircle,
  },
};

const statusLabelKeys: Record<string, string> = {
  PENDING: 'approvals.pending',
  APPROVED: 'approvals.approved',
  REJECTED: 'approvals.rejected',
};

function _formatDate(dateStr: string, locale: string = "ru"): string {
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

function _formatRelativeDate(dateStr: string, t: (key: string) => string, locale: string = "ru"): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffHours < 1) return t('approvals.just_now');
    if (diffHours < 24) return `${diffHours}${t('approvals.hours_ago')}`;
    if (diffDays === 1) return t('common.yesterday');
    if (diffDays < 7) return `${diffDays} ${t('common.days_ago')}`;
    return date.toLocaleDateString(locale === "en" ? "en-US" : "ru-RU", { day: "numeric", month: "short" });
  } catch {
    return dateStr;
  }
}

// --- Component ---

export default function ApprovalsPage() {
  const { getUserName } = useUsers();
  const { t, locale } = useLocale();
  const formatDate = (dateStr: string) => _formatDate(dateStr, locale);
  const formatRelativeDate = (dateStr: string) => _formatRelativeDate(dateStr, t, locale);
  const [loading, setLoading] = useState(true);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectFilter, setProjectFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [selectedApproval, setSelectedApproval] = useState<Approval | null>(null);
  const [creating, setCreating] = useState(false);
  const [reviewing, setReviewing] = useState(false);

  // Create form state
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newProjectId, setNewProjectId] = useState("");
  const [newType, setNewType] = useState("");

  // Review form state
  const [reviewComment, setReviewComment] = useState("");

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const projectsData = await api.get<any[]>("/api/projects/projects");
        const projectsList = (projectsData || []).map((p: any) => ({ id: p.id, title: p.title }));
        setProjects(projectsList);

        // Load approvals for all projects
        const allApprovals: Approval[] = [];
        for (const proj of projectsList) {
          try {
            const data = await api.get<Approval[]>(`/api/projects/approvals/project/${proj.id}`);
            if (data) allApprovals.push(...data);
          } catch {}
        }
        setApprovals(allApprovals);
      } catch {
        setProjects([]);
        setApprovals([]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const filteredApprovals = useMemo(() => {
    let result = [...approvals];

    if (projectFilter !== "all") {
      result = result.filter((a) => a.projectId === projectFilter);
    }
    if (statusFilter !== "all") {
      result = result.filter((a) => a.status === statusFilter);
    }

    return result.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [approvals, projectFilter, statusFilter]);

  const pendingApprovals = useMemo(
    () => approvals.filter((a) => a.status === "PENDING"),
    [approvals]
  );

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    const project = projects.find((p) => p.id === newProjectId);

    try {
      const result = await api.post<Approval>("/api/projects/approvals", {
        title: newTitle,
        description: newDescription,
        projectId: newProjectId,
        type: newType,
      });
      setApprovals((prev) => [result, ...prev]);
    } catch {
      const newApproval: Approval = {
        id: `a-${Date.now()}`,
        title: newTitle,
        description: newDescription,
        status: "PENDING",
        projectId: newProjectId,
        projectTitle: project?.title || t('chat.project'),
        requestedBy: "current-user",
        type: newType || t('approvals.type.general'),
        createdAt: new Date().toISOString(),
      };
      setApprovals((prev) => [newApproval, ...prev]);
    } finally {
      setCreating(false);
      setCreateDialogOpen(false);
      setNewTitle("");
      setNewDescription("");
      setNewProjectId("");
      setNewType("");
    }
  };

  const handleReview = async (decision: "APPROVED" | "REJECTED") => {
    if (!selectedApproval) return;
    setReviewing(true);

    try {
      await api.patch(`/api/projects/approvals/${selectedApproval.id}/review`, {
        status: decision,
        reviewComment,
      });
    } catch {
      // ignore
    }

    setApprovals((prev) =>
      prev.map((a) =>
        a.id === selectedApproval.id
          ? {
              ...a,
              status: decision,
              reviewedBy: "current-user",
              reviewComment: reviewComment || undefined,
              reviewedAt: new Date().toISOString(),
            }
          : a
      )
    );

    setReviewing(false);
    setReviewDialogOpen(false);
    setSelectedApproval(null);
    setReviewComment("");
  };

  const openReviewDialog = (approval: Approval) => {
    setSelectedApproval(approval);
    setReviewComment("");
    setReviewDialogOpen(true);
  };

  const pendingCount = approvals.filter((a) => a.status === "PENDING").length;
  const approvedCount = approvals.filter((a) => a.status === "APPROVED").length;
  const rejectedCount = approvals.filter((a) => a.status === "REJECTED").length;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div>
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-32 mt-1" />
          </div>
        </div>
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 text-white">
            <CheckSquare className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t('approvals.title')}</h1>
            <p className="text-sm text-muted-foreground">
              {pendingCount} {t('approvals.pending_count')} &middot; {approvedCount} {t('approvals.approved_count')} &middot; {rejectedCount} {t('approvals.rejected_count')}
            </p>
          </div>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 shadow-sm">
              <Plus className="h-4 w-4" />
              {t('approvals.new')}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('common.create')}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4 mt-2">
              <div className="space-y-2">
                <Label htmlFor="approval-title">{t('common.title')} *</Label>
                <Input
                  id="approval-title"
                  placeholder={t('approvals.request_title_placeholder')}
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>{t('chat.project')} *</Label>
                <Select value={newProjectId} onValueChange={setNewProjectId}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('approvals.select_project')} />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t('approvals.type')}</Label>
                <Select value={newType} onValueChange={setNewType}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('approvals.type_placeholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Дизайн">{t('approvals.type.design')}</SelectItem>
                    <SelectItem value="Техническое">{t('approvals.type.technical')}</SelectItem>
                    <SelectItem value="Бюджет">{t('approvals.type.budget')}</SelectItem>
                    <SelectItem value="Контент">{t('approvals.type.content')}</SelectItem>
                    <SelectItem value="Сроки">{t('approvals.type.deadlines')}</SelectItem>
                    <SelectItem value="Общее">{t('approvals.type.general')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="approval-desc">{t('common.description')}</Label>
                <Textarea
                  id="approval-desc"
                  placeholder={t('approvals.description_placeholder')}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  rows={4}
                />
              </div>
              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCreateDialogOpen(false)}
                >
                  {t('common.cancel')}
                </Button>
                <Button type="submit" disabled={!newTitle.trim() || !newProjectId || creating}>
                  {creating ? t('ai.creating') : t('common.create')}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Tabs and Filters */}
      <Tabs defaultValue="pending">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <TabsList>
            <TabsTrigger value="pending">
              {t('approvals.pending')} ({pendingCount})
            </TabsTrigger>
            <TabsTrigger value="all">
              {t('approvals.all')} ({approvals.length})
            </TabsTrigger>
          </TabsList>

          <div className="flex gap-3 w-full sm:w-auto sm:ml-auto">
            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder={t('chat.project')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('approvals.all_projects')}</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Pending Tab */}
        <TabsContent value="pending">
          {pendingApprovals.length === 0 ? (
            <div className="text-center py-16">
              <div className="rounded-full bg-muted p-6 mx-auto w-fit mb-4">
                <CheckSquare className="h-10 w-10 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-1">{t('approvals.no_approvals')}</h3>
              <p className="text-sm text-muted-foreground">
                {t('approvals.no_approvals')}
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mt-4">
              {pendingApprovals
                .filter((a) => projectFilter === "all" || a.projectId === projectFilter)
                .map((approval) => {
                  const style = statusConfigStyles[approval.status];
                  const StatusIcon = style.icon;

                  return (
                    <Card
                      key={approval.id}
                      className="flex flex-col hover:shadow-md transition-shadow"
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between gap-2">
                          <CardTitle className="text-sm font-semibold leading-snug line-clamp-2">
                            {approval.title}
                          </CardTitle>
                          <Badge
                            variant="outline"
                            className={`shrink-0 text-[10px] font-medium whitespace-nowrap ${style.className}`}
                          >
                            <StatusIcon className="h-3 w-3 mr-1" />
                            {t(statusLabelKeys[approval.status])}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="flex-1 pb-3 space-y-3">
                        <p className="text-xs text-muted-foreground line-clamp-3">
                          {approval.description}
                        </p>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {getUserName(approval.requestedBy)}
                          </span>
                          <span className="flex items-center gap-1">
                            <FileText className="h-3 w-3" />
                            {approval.type}
                          </span>
                        </div>
                        <Badge variant="outline" className="text-[10px]">
                          {approval.projectTitle}
                        </Badge>
                      </CardContent>
                      <CardFooter className="pt-3 border-t flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          {formatRelativeDate(approval.createdAt)}
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1 text-xs"
                          onClick={() => openReviewDialog(approval)}
                        >
                          <MessageSquare className="h-3 w-3" />
                          {t('approvals.review')}
                        </Button>
                      </CardFooter>
                    </Card>
                  );
                })}
            </div>
          )}
        </TabsContent>

        {/* All Tab */}
        <TabsContent value="all">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mt-4">
            {filteredApprovals.map((approval) => {
              const config = statusConfigStyles[approval.status];
              const StatusIcon = config.icon;

              return (
                <Card
                  key={approval.id}
                  className="flex flex-col hover:shadow-md transition-shadow"
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-sm font-semibold leading-snug line-clamp-2">
                        {approval.title}
                      </CardTitle>
                      <Badge
                        variant="outline"
                        className={`shrink-0 text-[10px] font-medium whitespace-nowrap ${config.className}`}
                      >
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {t(statusLabelKeys[approval.status])}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 pb-3 space-y-3">
                    <p className="text-xs text-muted-foreground line-clamp-3">
                      {approval.description}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {getUserName(approval.requestedBy)}
                      </span>
                      <span className="flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        {approval.type}
                      </span>
                    </div>
                    <Badge variant="outline" className="text-[10px]">
                      {approval.projectTitle}
                    </Badge>
                    {approval.reviewComment && (
                      <div className="rounded-md bg-muted/50 p-2 mt-2">
                        <p className="text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">{getUserName(approval.reviewedBy)}:</span>{" "}
                          {approval.reviewComment}
                        </p>
                      </div>
                    )}
                  </CardContent>
                  <CardFooter className="pt-3 border-t flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      {formatRelativeDate(approval.createdAt)}
                    </span>
                    {approval.status === "PENDING" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1 text-xs"
                        onClick={() => openReviewDialog(approval)}
                      >
                        <MessageSquare className="h-3 w-3" />
                        {t('approvals.review')}
                      </Button>
                    ) : approval.reviewedAt ? (
                      <span className="text-xs text-muted-foreground">
                        {formatDate(approval.reviewedAt)}
                      </span>
                    ) : null}
                  </CardFooter>
                </Card>
              );
            })}

            {filteredApprovals.length === 0 && (
              <div className="col-span-full text-center py-16">
                <div className="rounded-full bg-muted p-6 mx-auto w-fit mb-4">
                  <Filter className="h-10 w-10 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-1">{t('search.no_results')}</h3>
                <p className="text-sm text-muted-foreground">
                  {t('approvals.try_change_filters')}
                </p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Review Dialog */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('approvals.review')}</DialogTitle>
          </DialogHeader>
          {selectedApproval && (
            <div className="space-y-4 mt-2">
              <div>
                <h3 className="font-semibold text-base">{selectedApproval.title}</h3>
                <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                  <User className="h-3.5 w-3.5" />
                  {getUserName(selectedApproval.requestedBy)}
                  <span>&middot;</span>
                  <CalendarDays className="h-3.5 w-3.5" />
                  {formatDate(selectedApproval.createdAt)}
                </div>
              </div>

              <Separator />

              <div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {selectedApproval.description}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[10px]">
                  {selectedApproval.projectTitle}
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  {selectedApproval.type}
                </Badge>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="review-comment">{t('approvals.comment')}</Label>
                <Textarea
                  id="review-comment"
                  placeholder={t('approvals.review_comment_placeholder')}
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  rows={3}
                />
              </div>

              <DialogFooter className="pt-2 gap-2 flex-col sm:flex-row">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setReviewDialogOpen(false)}
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  className="gap-1"
                  disabled={reviewing}
                  onClick={() => handleReview("REJECTED")}
                >
                  {reviewing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <XCircle className="h-4 w-4" />
                  )}
                  {t('approvals.reject')}
                </Button>
                <Button
                  type="button"
                  className="gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                  disabled={reviewing}
                  onClick={() => handleReview("APPROVED")}
                >
                  {reviewing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  {t('approvals.approve')}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
