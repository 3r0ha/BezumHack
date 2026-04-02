"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LayoutGrid, Plus, Clock, User, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { useLocale } from "@/contexts/locale-context";
import { useUsers } from "@/hooks/use-users";

interface Board {
  id: string;
  title: string;
  elementCount: number;
  createdBy: string;
  updatedAt: string;
  createdAt: string;
}

export default function BoardsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLocale();
  const { getUserName } = useUsers();
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    loadBoards();
  }, []);

  async function loadBoards() {
    try {
      const data = await api.get<any[]>("/api/projects/boards");
      setBoards((data || []).map((b: any) => ({ id: b.id, title: b.title, elementCount: b._count?.elements || 0, createdBy: b.createdBy, updatedAt: b.updatedAt })));
    } catch {
      setBoards([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      const board = await api.post<any>("/api/projects/boards", {
        title: newTitle.trim(),
      });
      if (board?.id) {
        setBoards((prev) => [{ id: board.id, title: board.title, elementCount: 0, createdBy: board.createdBy, updatedAt: board.updatedAt }, ...prev]);
        setDialogOpen(false);
        setNewTitle("");
        router.push(`/boards/${board.id}`);
      }
    } catch {
      // If API fails, create a local board and navigate
      const localBoard: Board = {
        id: crypto.randomUUID(),
        title: newTitle.trim(),
        elementCount: 0,
        createdBy: user?.id || "",
        updatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };
      setBoards((prev) => [localBoard, ...prev]);
      setDialogOpen(false);
      setNewTitle("");
      router.push(`/boards/${localBoard.id}`);
    } finally {
      setCreating(false);
    }
  }

  function formatDate(dateStr: string): string {
    try {
      const d = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      if (diffDays === 0) return t("common.today");
      if (diffDays === 1) return t("common.yesterday");
      return `${diffDays} ${t("common.days_ago")}`;
    } catch {
      return "";
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <LayoutGrid className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {t("boards.title")}
            </h1>
          </div>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              {t("boards.new")}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("boards.new")}</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <Input
                placeholder={t("boards.board_title")}
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreate();
                }}
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setDialogOpen(false);
                  setNewTitle("");
                }}
              >
                {t("common.cancel")}
              </Button>
              <Button
                onClick={handleCreate}
                disabled={!newTitle.trim() || creating}
              >
                {creating ? t("common.loading") : t("common.create")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-5">
                <div className="h-5 bg-muted rounded w-3/4 mb-4" />
                <div className="h-4 bg-muted rounded w-1/2 mb-2" />
                <div className="h-4 bg-muted rounded w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : boards.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
            <LayoutGrid className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-1">
            {t("boards.no_boards")}
          </h3>
          <p className="text-sm text-muted-foreground mb-6 max-w-sm">
            {t("boards.no_boards")}
          </p>
          <Button
            className="gap-2"
            onClick={() => setDialogOpen(true)}
          >
            <Plus className="h-4 w-4" />
            {t("boards.new")}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {boards.map((board) => (
            <Card
              key={board.id}
              className="cursor-pointer hover:border-primary/30 hover:shadow-md transition-all duration-200 group"
              onClick={() => router.push(`/boards/${board.id}`)}
            >
              <CardContent className="p-5">
                {/* Preview area */}
                <div className="h-28 rounded-lg bg-muted/50 mb-4 flex items-center justify-center group-hover:bg-primary/5 transition-colors">
                  <LayoutGrid className="h-10 w-10 text-muted-foreground/40" />
                </div>

                {/* Title */}
                <h3 className="font-semibold text-sm mb-3 truncate">
                  {board.title}
                </h3>

                {/* Meta */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Layers className="h-3.5 w-3.5" />
                    <span>
                      {board.elementCount || 0} {t("boards.elements")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5" />
                    <span>{formatDate(board.updatedAt || board.createdAt)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <User className="h-3.5 w-3.5" />
                    <span>{getUserName(board.createdBy)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
