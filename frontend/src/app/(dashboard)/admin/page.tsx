"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Shield,
  UserPlus,
  Trash2,
  Copy,
  Check,
  Loader2,
  Users,
  Code2,
  Briefcase,
  Crown,
  FolderKanban,
} from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { useLocale } from "@/contexts/locale-context";

// --- Types ---

interface UserItem {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
}

interface Project {
  id: string;
  title: string;
  clientId?: string | null;
  managerId?: string | null;
  status: string;
}

// --- Helpers ---

function getUserInitials(name?: string): string {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name[0].toUpperCase();
}

function roleBadgeVariant(role: string): "default" | "secondary" | "destructive" | "outline" {
  switch (role) {
    case "MANAGER": return "default";
    case "DEVELOPER": return "secondary";
    case "CLIENT": return "outline";
    default: return "secondary";
  }
}

// --- Component ---

export default function AdminPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLocale();

  const [users, setUsers] = useState<UserItem[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [projectsLoading, setProjectsLoading] = useState(true);

  // Invite dialog
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({ name: "", email: "", role: "DEVELOPER", password: "" });
  const [inviteLoading, setInviteLoading] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState<UserItem | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Redirect non-managers
  useEffect(() => {
    if (user && user.role !== "MANAGER") {
      router.replace("/dashboard");
    }
  }, [user, router]);

  // Load users
  const loadUsers = async () => {
    try {
      const data = await api.get<{ users: UserItem[] }>("/api/auth/users");
      setUsers(data.users || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  // Load projects
  const loadProjects = async () => {
    try {
      const data = await api.get<{ projects: Project[] }>("/api/projects/projects");
      setProjects(data.projects || []);
    } catch {
      // ignore
    } finally {
      setProjectsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
    loadProjects();
  }, []);

  // Stats
  const stats = useMemo(() => {
    const total = users.length;
    const developers = users.filter((u) => u.role === "DEVELOPER").length;
    const clients = users.filter((u) => u.role === "CLIENT").length;
    const managers = users.filter((u) => u.role === "MANAGER").length;
    return { total, developers, clients, managers };
  }, [users]);

  // Role label
  const roleLabel = (role: string) => {
    const map: Record<string, string> = {
      CLIENT: t("auth.role.client"),
      DEVELOPER: t("auth.role.developer"),
      MANAGER: t("auth.role.manager"),
    };
    return map[role] || role;
  };

  // --- Invite ---
  const handleInvite = async () => {
    setInviteLoading(true);
    try {
      const body: Record<string, string> = {
        name: inviteForm.name,
        email: inviteForm.email,
        role: inviteForm.role,
      };
      if (inviteForm.password) body.password = inviteForm.password;
      const data = await api.post<{ user: UserItem; tempPassword: string }>("/api/auth/invite", body);
      setTempPassword(data.tempPassword);
      setUsers((prev) => [{ ...data.user, createdAt: new Date().toISOString() }, ...prev]);
    } catch {
      // ignore
    } finally {
      setInviteLoading(false);
    }
  };

  const resetInviteDialog = () => {
    setInviteOpen(false);
    setInviteForm({ name: "", email: "", role: "DEVELOPER", password: "" });
    setTempPassword(null);
    setCopied(false);
  };

  // --- Role change ---
  const handleRoleChange = async (userId: string, newRole: string) => {
    try {
      const data = await api.patch<{ user: UserItem }>(`/api/auth/users/${userId}/role`, { role: newRole });
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: data.user.role } : u)));
    } catch {
      // ignore
    }
  };

  // --- Delete ---
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await api.delete(`/api/auth/users/${deleteTarget.id}`);
      setUsers((prev) => prev.filter((u) => u.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch {
      // ignore
    } finally {
      setDeleteLoading(false);
    }
  };

  // --- Project assignment ---
  const handleProjectAssign = async (projectId: string, field: "clientId" | "managerId", userId: string) => {
    try {
      await api.patch(`/api/projects/projects/${projectId}`, { [field]: userId });
      setProjects((prev) =>
        prev.map((p) => (p.id === projectId ? { ...p, [field]: userId } : p))
      );
    } catch {
      // ignore
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getUserName = (id?: string | null) => {
    if (!id) return "-";
    const u = users.find((u) => u.id === id);
    return u ? u.name : id.slice(0, 8) + "...";
  };

  if (user?.role !== "MANAGER") return null;

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t("admin.title")}</h1>
          </div>
        </div>
        <Button onClick={() => setInviteOpen(true)} className="gap-2">
          <UserPlus className="h-4 w-4" />
          {t("admin.invite")}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Users className="h-4 w-4 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">{t("admin.total_users")}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <Code2 className="h-4 w-4 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.developers}</p>
                <p className="text-xs text-muted-foreground">{t("admin.developers")}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-violet-500/10 flex items-center justify-center">
                <Briefcase className="h-4 w-4 text-violet-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.clients}</p>
                <p className="text-xs text-muted-foreground">{t("admin.clients")}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Crown className="h-4 w-4 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.managers}</p>
                <p className="text-xs text-muted-foreground">{t("admin.managers")}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {t("admin.users")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : users.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">{t("admin.no_users")}</p>
          ) : (
            <div className="space-y-1">
              {/* Header row */}
              <div className="grid grid-cols-[1fr_1fr_120px_140px_80px] gap-4 px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <span>{t("auth.name")}</span>
                <span>{t("auth.email")}</span>
                <span>{t("auth.role")}</span>
                <span>{t("common.created")}</span>
                <span></span>
              </div>
              <Separator />
              {users.map((u) => (
                <div
                  key={u.id}
                  className="grid grid-cols-[1fr_1fr_120px_140px_80px] gap-4 items-center px-3 py-2.5 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                        {getUserInitials(u.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium truncate">{u.name}</span>
                    {u.id === user?.id && (
                      <Badge variant="outline" className="text-[10px] shrink-0">you</Badge>
                    )}
                  </div>
                  <span className="text-sm text-muted-foreground truncate">{u.email}</span>
                  <div>
                    {u.id === user?.id ? (
                      <Badge variant={roleBadgeVariant(u.role)}>{roleLabel(u.role)}</Badge>
                    ) : (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="focus:outline-none">
                            <Badge variant={roleBadgeVariant(u.role)} className="cursor-pointer hover:opacity-80">
                              {roleLabel(u.role)}
                            </Badge>
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                          {["CLIENT", "DEVELOPER", "MANAGER"].map((r) => (
                            <DropdownMenuItem
                              key={r}
                              onClick={() => handleRoleChange(u.id, r)}
                              className={u.role === r ? "font-semibold" : ""}
                            >
                              {roleLabel(r)}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(u.createdAt).toLocaleDateString("ru", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                  <div className="flex justify-end">
                    {u.id !== user?.id && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => setDeleteTarget(u)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Project Assignments */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderKanban className="h-5 w-5" />
            {t("admin.projects_section")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {projectsLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : projects.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">{t("common.no_data")}</p>
          ) : (
            <div className="space-y-1">
              <div className="grid grid-cols-[1fr_1fr_1fr_100px] gap-4 px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <span>{t("common.title")}</span>
                <span>{t("admin.assign_client")}</span>
                <span>{t("admin.assign_manager")}</span>
                <span>{t("common.status")}</span>
              </div>
              <Separator />
              {projects.map((p) => (
                <div
                  key={p.id}
                  className="grid grid-cols-[1fr_1fr_1fr_100px] gap-4 items-center px-3 py-2.5 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <span className="text-sm font-medium truncate">{p.title}</span>
                  <Select
                    value={p.clientId || ""}
                    onValueChange={(v) => handleProjectAssign(p.id, "clientId", v)}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="-">
                        {getUserName(p.clientId)}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {users
                        .filter((u) => u.role === "CLIENT" || u.role === "MANAGER")
                        .map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={p.managerId || ""}
                    onValueChange={(v) => handleProjectAssign(p.id, "managerId", v)}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="-">
                        {getUserName(p.managerId)}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {users
                        .filter((u) => u.role === "MANAGER")
                        .map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <Badge variant="outline" className="text-xs justify-center">
                    {p.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invite Dialog */}
      <Dialog open={inviteOpen} onOpenChange={(open) => { if (!open) resetInviteDialog(); else setInviteOpen(true); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("admin.invite_user")}</DialogTitle>
            <DialogDescription>{t("admin.invite_desc")}</DialogDescription>
          </DialogHeader>

          {tempPassword ? (
            <div className="space-y-4">
              <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-4 space-y-2">
                <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                  {t("admin.user_created")}
                </p>
                <p className="text-xs text-muted-foreground">{t("admin.temp_password_desc")}</p>
              </div>
              <div className="space-y-2">
                <Label>{t("admin.temp_password")}</Label>
                <div className="flex gap-2">
                  <Input value={tempPassword} readOnly className="font-mono" />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(tempPassword)}
                  >
                    {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={resetInviteDialog}>{t("common.close")}</Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t("auth.name")}</Label>
                <Input
                  value={inviteForm.name}
                  onChange={(e) => setInviteForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="John Doe"
                />
              </div>
              <div className="space-y-2">
                <Label>{t("auth.email")}</Label>
                <Input
                  type="email"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="john@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label>{t("auth.role")}</Label>
                <Select
                  value={inviteForm.role}
                  onValueChange={(v) => setInviteForm((f) => ({ ...f, role: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CLIENT">{t("auth.role.client")}</SelectItem>
                    <SelectItem value="DEVELOPER">{t("auth.role.developer")}</SelectItem>
                    <SelectItem value="MANAGER">{t("auth.role.manager")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("admin.optional_password")}</Label>
                <Input
                  type="password"
                  value={inviteForm.password}
                  onChange={(e) => setInviteForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder={t("admin.auto_generate")}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={resetInviteDialog}>
                  {t("common.cancel")}
                </Button>
                <Button
                  onClick={handleInvite}
                  disabled={!inviteForm.name || !inviteForm.email || inviteLoading}
                >
                  {inviteLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {t("admin.invite")}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("admin.delete_user")}</DialogTitle>
            <DialogDescription>{t("admin.delete_confirm")}</DialogDescription>
          </DialogHeader>
          {deleteTarget && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <Avatar className="h-9 w-9">
                <AvatarFallback className="bg-destructive/10 text-destructive text-xs font-semibold">
                  {getUserInitials(deleteTarget.name)}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium">{deleteTarget.name}</p>
                <p className="text-xs text-muted-foreground">{deleteTarget.email}</p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteLoading}
            >
              {deleteLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t("common.delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
