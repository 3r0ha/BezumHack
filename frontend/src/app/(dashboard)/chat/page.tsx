"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  SendHorizontal,
  Plus,
  ArrowLeft,
  MessageSquare,
  Users,
  Loader2,
  Languages,
  Info,
  UserPlus,
  LogOut,
  Mail,
  Paperclip,
  Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/auth-context";
import { useLocale } from "@/contexts/locale-context";
import { useSocket } from "@/hooks/use-socket";
import { useUsers, type UserInfo } from "@/hooks/use-users";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Conversation {
  id: string;
  projectId: string;
  title: string | null;
  participants: { id: string; userId: string }[];
  messages?: { id: string; content: string; senderId: string; createdAt: string }[];
  updatedAt: string;
  createdAt?: string;
  unreadCount?: number;
}

interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  createdAt: string;
}

interface ProjectOption {
  id: string;
  title: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function getUserInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name[0]?.toUpperCase() || "?";
}

function formatTime(dateStr: string, locale: string = "ru"): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleTimeString(locale === "en" ? "en-US" : "ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function formatDate(
  dateStr: string,
  t: (key: string) => string,
  locale: string
): string {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfYesterday = new Date(startOfToday.getTime() - 86400000);
    if (d >= startOfToday) return t("common.today");
    if (d >= startOfYesterday) return t("common.yesterday");
    return d.toLocaleDateString(locale === "en" ? "en-US" : "ru-RU", {
      day: "numeric",
      month: "short",
    });
  } catch {
    return "";
  }
}

function formatFullDate(dateStr: string, locale: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString(locale === "en" ? "en-US" : "ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

function isDMConversation(conv: Conversation): boolean {
  return conv.participants.length === 2 && !conv.title;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function ChatPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { locale, t } = useLocale();
  const { users, loading: usersLoading, getUserName, getUserEmail } = useUsers();
  const { socket, isConnected, emit, on, off } = useSocket();

  // Core state
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageText, setMessageText] = useState("");
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileShowMessages, setMobileShowMessages] = useState(false);

  // Typing indicator
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();
  const typingEmitRef = useRef<NodeJS.Timeout>();

  // Translations
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // New DM dialog
  const [dmDialogOpen, setDmDialogOpen] = useState(false);
  const [dmSearchQuery, setDmSearchQuery] = useState("");

  // Create group dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [newProjectId, setNewProjectId] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newParticipants, setNewParticipants] = useState<string[]>([]);
  const [participantSearch, setParticipantSearch] = useState("");
  const [creating, setCreating] = useState(false);

  // Conversation info sheet
  const [infoOpen, setInfoOpen] = useState(false);

  // Add member dialog
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [addMemberSearch, setAddMemberSearch] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ─── Data Loading ──────────────────────────────────────────────────────────

  const loadConversations = useCallback(async () => {
    try {
      const data = await api.get<any[]>(
        `/api/chat/conversations${user?.id ? `?userId=${user.id}` : ""}`
      );
      if (data) setConversations(data);
    } catch {
      // keep empty state
    }
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Load projects for create group dialog
  useEffect(() => {
    const loadProjects = async () => {
      try {
        const p = await api.get<any[]>("/api/projects/projects").catch(() => []);
        if (Array.isArray(p)) setProjects(p.map((x: any) => ({ id: x.id, title: x.title })));
      } catch {}
    };
    loadProjects();
  }, []);

  // Load messages for selected conversation
  const loadMessages = useCallback(async (convId: string) => {
    setMessagesLoading(true);
    try {
      const data = await api.get<{ messages: Message[] }>(
        `/api/chat/conversations/${convId}/messages?take=100`
      );
      if (data?.messages) setMessages(data.messages);
    } catch {
      setMessages([]);
    }
    setMessagesLoading(false);
  }, []);

  useEffect(() => {
    if (selectedConv) {
      loadMessages(selectedConv.id);
    }
  }, [selectedConv?.id, loadMessages]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ─── WebSocket ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!selectedConv || !socket) return;
    emit("join_conversation", selectedConv.id);

    const handleNewMessage = (msg: Message) => {
      if (msg.conversationId === selectedConv.id) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      }
      // Update conversation list preview
      setConversations((prev) =>
        prev.map((c) =>
          c.id === msg.conversationId
            ? {
                ...c,
                messages: [{ id: msg.id, content: msg.content, senderId: msg.senderId, createdAt: msg.createdAt }],
                updatedAt: msg.createdAt,
              }
            : c
        )
      );
    };

    const handleTyping = (data: { userId: string; conversationId: string }) => {
      if (data.conversationId === selectedConv.id && data.userId !== user?.id) {
        setTypingUser(data.userId);
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => setTypingUser(null), 3000);
      }
    };

    const handleStopTyping = () => setTypingUser(null);

    on("new_message", handleNewMessage);
    on("user_typing", handleTyping);
    on("user_stop_typing", handleStopTyping);

    return () => {
      emit("leave_conversation", selectedConv.id);
      off("new_message", handleNewMessage);
      off("user_typing", handleTyping);
      off("user_stop_typing", handleStopTyping);
    };
  }, [selectedConv?.id, socket, emit, on, off, user?.id]);

  // ─── Name resolution ──────────────────────────────────────────────────────

  const resolveUserName = useCallback(
    (userId: string): string => {
      if (userId === user?.id) return user.name;
      return getUserName(userId);
    },
    [user, getUserName]
  );

  const getConversationTitle = useCallback(
    (conv: Conversation): string => {
      if (conv.title) return conv.title;
      // For DMs show the other person's name
      if (conv.participants.length === 2) {
        const otherParticipant = conv.participants.find((p) => p.userId !== user?.id);
        if (otherParticipant) return resolveUserName(otherParticipant.userId);
      }
      return t("chat.conversation");
    },
    [user?.id, resolveUserName, t]
  );

  const getConversationInitial = useCallback(
    (conv: Conversation): string => {
      const title = getConversationTitle(conv);
      return title[0]?.toUpperCase() || "?";
    },
    [getConversationTitle]
  );

  // ─── Typing emission ──────────────────────────────────────────────────────

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessageText(e.target.value);
    if (selectedConv && socket) {
      // Debounce typing emit
      if (!typingEmitRef.current) {
        emit("typing", { conversationId: selectedConv.id, userId: user?.id });
      }
      clearTimeout(typingEmitRef.current);
      typingEmitRef.current = setTimeout(() => {
        typingEmitRef.current = undefined;
      }, 1000);
    }
  };

  // ─── Translate ─────────────────────────────────────────────────────────────

  const handleTranslate = async (msg: Message) => {
    if (translations[msg.id]) return;
    try {
      const result = await api.post<any>(
        `/api/chat/conversations/${msg.conversationId}/messages/${msg.id}/translate`,
        { targetLanguage: locale === "ru" ? "en" : "ru" }
      );
      if (result?.translatedContent) {
        setTranslations((prev) => ({ ...prev, [msg.id]: result.translatedContent }));
      }
    } catch {}
  };

  // ─── Send message ─────────────────────────────────────────────────────────

  const handleSend = async () => {
    if (!messageText.trim() || !selectedConv || !user) return;
    const text = messageText.trim();
    setMessageText("");
    setSending(true);

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    // Optimistic update
    const tempMsg: Message = {
      id: `temp-${Date.now()}`,
      conversationId: selectedConv.id,
      senderId: user.id,
      content: text,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempMsg]);

    // Update conversation list
    setConversations((prev) => {
      const updated = prev.map((c) =>
        c.id === selectedConv.id
          ? { ...c, messages: [{ id: tempMsg.id, content: text, senderId: user.id, createdAt: tempMsg.createdAt }], updatedAt: tempMsg.createdAt }
          : c
      );
      return updated.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    });

    if (socket) {
      emit("send_message", {
        conversationId: selectedConv.id,
        senderId: user.id,
        content: text,
      });
    }

    try {
      const msg = await api.post<Message>(
        `/api/chat/conversations/${selectedConv.id}/messages`,
        { senderId: user.id, content: text }
      );
      setMessages((prev) => prev.map((m) => (m.id === tempMsg.id ? msg : m)));
    } catch {
      // keep temp message
    }
    setSending(false);
    textareaRef.current?.focus();
  };

  // ─── DM creation ──────────────────────────────────────────────────────────

  const handleStartDM = async (targetUser: UserInfo) => {
    if (!user) return;
    // Check if a DM already exists with this user
    const existing = conversations.find(
      (c) =>
        c.participants.length === 2 &&
        c.participants.some((p) => p.userId === targetUser.id) &&
        c.participants.some((p) => p.userId === user.id)
    );
    if (existing) {
      setSelectedConv(existing);
      setMobileShowMessages(true);
      setDmDialogOpen(false);
      setDmSearchQuery("");
      return;
    }

    // Create new DM conversation
    setCreating(true);
    try {
      const conv = await api.post<Conversation>("/api/chat/conversations", {
        projectId: projects[0]?.id || "",
        title: null,
        participantIds: [user.id, targetUser.id],
      });
      setConversations((prev) => [conv, ...prev]);
      setSelectedConv(conv);
      setMobileShowMessages(true);
    } catch (err) {
      console.error("Failed to create DM", err);
    }
    setCreating(false);
    setDmDialogOpen(false);
    setDmSearchQuery("");
  };

  // ─── Group creation ───────────────────────────────────────────────────────

  const handleCreateGroup = async () => {
    if (!newProjectId || newParticipants.length === 0) return;
    setCreating(true);
    try {
      const participantIds = [...newParticipants];
      if (user && !participantIds.includes(user.id)) {
        participantIds.push(user.id);
      }
      const conv = await api.post<Conversation>("/api/chat/conversations", {
        projectId: newProjectId,
        title: newTitle || null,
        participantIds,
      });
      setConversations((prev) => [conv, ...prev]);
      setSelectedConv(conv);
      setCreateOpen(false);
      setNewProjectId("");
      setNewTitle("");
      setNewParticipants([]);
      setParticipantSearch("");
      setMobileShowMessages(true);
    } catch (err) {
      console.error("Failed to create conversation", err);
    }
    setCreating(false);
  };

  const toggleParticipant = (userId: string) => {
    setNewParticipants((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  // ─── Add member ───────────────────────────────────────────────────────────

  const handleAddMember = async (targetUser: UserInfo) => {
    if (!selectedConv) return;
    // Already a participant?
    if (selectedConv.participants.some((p) => p.userId === targetUser.id)) return;
    try {
      // Recreate conversation with the new participant added
      const newParticipantIds = [
        ...selectedConv.participants.map((p) => p.userId),
        targetUser.id,
      ];
      await api.post<any>(`/api/chat/conversations/${selectedConv.id}/participants`, {
        userId: targetUser.id,
      }).catch(() => {
        // Fallback: some APIs might not have a participants endpoint
        // In that case we just update locally
      });
      // Update locally
      setSelectedConv((prev) =>
        prev
          ? {
              ...prev,
              participants: [
                ...prev.participants,
                { id: `temp-${Date.now()}`, userId: targetUser.id },
              ],
            }
          : prev
      );
      setConversations((prev) =>
        prev.map((c) =>
          c.id === selectedConv.id
            ? {
                ...c,
                participants: [
                  ...c.participants,
                  { id: `temp-${Date.now()}`, userId: targetUser.id },
                ],
              }
            : c
        )
      );
      setAddMemberOpen(false);
      setAddMemberSearch("");
    } catch {}
  };

  // ─── Leave conversation ───────────────────────────────────────────────────

  const handleLeave = async () => {
    if (!selectedConv || !user) return;
    try {
      await api.post<any>(
        `/api/chat/conversations/${selectedConv.id}/leave`,
        { userId: user.id }
      ).catch(() => {});
      setConversations((prev) => prev.filter((c) => c.id !== selectedConv.id));
      setSelectedConv(null);
      setInfoOpen(false);
      setMobileShowMessages(false);
    } catch {}
  };

  // ─── Filtering ─────────────────────────────────────────────────────────────

  const sortedConversations = [...conversations].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  const filteredConversations = sortedConversations.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const title = getConversationTitle(c).toLowerCase();
    return title.includes(q);
  });

  const filteredDmUsers = users.filter((u) => {
    if (u.id === user?.id) return false;
    if (!dmSearchQuery.trim()) return true;
    const q = dmSearchQuery.toLowerCase();
    return (
      u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    );
  });

  const filteredAddMembers = users.filter((u) => {
    if (!selectedConv) return false;
    if (selectedConv.participants.some((p) => p.userId === u.id)) return false;
    if (!addMemberSearch.trim()) return true;
    const q = addMemberSearch.toLowerCase();
    return (
      u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    );
  });

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "CLIENT":
        return t("auth.role.client");
      case "MANAGER":
        return t("auth.role.manager");
      default:
        return t("auth.role.developer");
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-[calc(100vh-8rem)] rounded-lg border bg-card overflow-hidden">
      {/* ── Left Panel: Conversation List ───────────────────────────────── */}
      <div
        className={`w-full md:w-[340px] md:flex flex-col border-r shrink-0 ${
          mobileShowMessages ? "hidden md:flex" : "flex"
        }`}
      >
        {/* Header */}
        <div className="p-4 border-b space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-lg">{t("chat.title")}</h2>
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => setDmDialogOpen(true)}
              >
                <Mail className="h-4 w-4" />
                <span className="hidden sm:inline">{t("chat.new_message")}</span>
              </Button>
              <Button
                size="sm"
                className="gap-1.5"
                onClick={() => setCreateOpen(true)}
              >
                <Plus className="h-4 w-4" />
                {t("chat.new")}
              </Button>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("chat.search")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
        </div>

        {/* Conversation list */}
        <ScrollArea className="flex-1">
          {loading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="p-8 text-center">
              <MessageSquare className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">
                {searchQuery ? t("search.no_results") : t("chat.no_conversations")}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3 gap-1.5"
                onClick={() => setDmDialogOpen(true)}
              >
                <Mail className="h-3.5 w-3.5" />
                {t("chat.new_message")}
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                {t("chat.or_create_group")}
              </p>
            </div>
          ) : (
            <div>
              {filteredConversations.map((conv) => {
                const lastMsg = conv.messages?.[0];
                const isSelected = selectedConv?.id === conv.id;
                const isDM = isDMConversation(conv);
                const title = getConversationTitle(conv);
                return (
                  <div
                    key={conv.id}
                    className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-accent/50 ${
                      isSelected ? "bg-accent" : ""
                    }`}
                    onClick={() => {
                      setSelectedConv(conv);
                      setMobileShowMessages(true);
                    }}
                  >
                    <Avatar className="h-10 w-10 shrink-0">
                      <AvatarFallback
                        className={`text-xs ${
                          isDM
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                            : "bg-primary/10 text-primary"
                        }`}
                      >
                        {isDM ? getUserInitials(title) : title[0]?.toUpperCase() || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <p className="text-sm font-medium truncate">{title}</p>
                          {!isDM && (
                            <Users className="h-3 w-3 text-muted-foreground shrink-0" />
                          )}
                        </div>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {formatDate(conv.updatedAt, t, locale)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs text-muted-foreground truncate">
                          {lastMsg
                            ? `${lastMsg.senderId === user?.id ? "" : resolveUserName(lastMsg.senderId).split(" ")[0] + ": "}${lastMsg.content}`
                            : t("chat.no_messages")}
                        </p>
                        {conv.unreadCount && conv.unreadCount > 0 ? (
                          <Badge
                            variant="default"
                            className="h-5 min-w-[20px] flex items-center justify-center rounded-full px-1.5 text-[10px] shrink-0"
                          >
                            {conv.unreadCount}
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* ── Right Panel: Message Area ───────────────────────────────────── */}
      <div
        className={`flex-1 flex flex-col ${
          !mobileShowMessages ? "hidden md:flex" : "flex"
        }`}
      >
        {selectedConv ? (
          <>
            {/* Chat header */}
            <div className="h-14 border-b flex items-center gap-3 px-4 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden h-8 w-8"
                onClick={() => setMobileShowMessages(false)}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold truncate">
                    {getConversationTitle(selectedConv)}
                  </p>
                  <div
                    className={`h-2 w-2 rounded-full shrink-0 ${
                      isConnected ? "bg-emerald-500" : "bg-muted-foreground/30"
                    }`}
                    title={
                      isConnected ? t("chat.connected") : t("chat.disconnected")
                    }
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {isDMConversation(selectedConv)
                    ? t("chat.direct_message")
                    : `${selectedConv.participants?.length || 0} ${t("chat.participants_count")}`}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                title={t("call.start")}
                onClick={async () => {
                  try {
                    const data = await api.post<{ id: string }>("/api/chat/calls", {
                      conversationId: selectedConv.id,
                    });
                    if (data?.id) {
                      router.push(`/call/${data.id}`);
                    }
                  } catch {
                    // fallback: use conversation id as call id
                    router.push(`/call/${selectedConv.id}`);
                  }
                }}
              >
                <Video className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setInfoOpen(true)}
              >
                <Info className="h-4 w-4" />
              </Button>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-2 sm:p-4">
              {messagesLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center py-12">
                  <MessageSquare className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                  <p className="text-sm text-muted-foreground">
                    {t("chat.first_message")}
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((msg) => {
                    const isMe = msg.senderId === user?.id;
                    const senderName = resolveUserName(msg.senderId);
                    return (
                      <div
                        key={msg.id}
                        className={`group flex gap-2.5 ${
                          isMe ? "flex-row-reverse" : ""
                        }`}
                      >
                        <Avatar className="h-8 w-8 shrink-0 mt-1">
                          <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                            {getUserInitials(senderName)}
                          </AvatarFallback>
                        </Avatar>
                        <div
                          className={`max-w-[70%] ${isMe ? "text-right" : ""}`}
                        >
                          <div
                            className={`flex items-center gap-2 mb-0.5 ${
                              isMe ? "justify-end" : ""
                            }`}
                          >
                            {!isMe && (
                              <span className="text-xs font-medium">
                                {senderName}
                              </span>
                            )}
                            <span className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                              {formatTime(msg.createdAt, locale)}
                            </span>
                          </div>
                          <div
                            className={`inline-block rounded-xl px-3.5 py-2 text-sm whitespace-pre-wrap break-words max-w-full ${
                              isMe
                                ? "bg-primary text-primary-foreground rounded-tr-sm"
                                : "bg-muted rounded-tl-sm"
                            }`}
                          >
                            {(() => {
                              const fileUrl = (msg as any).fileUrl;
                              const fileType = (msg as any).fileType;
                              const fileName = (msg as any).fileName;
                              const fileSize = (msg as any).fileSize;
                              const token = typeof window !== "undefined" ? localStorage.getItem("token") : "";
                              const authUrl = fileUrl ? `${fileUrl}?token=${token}` : "";

                              if (fileUrl && fileType?.startsWith("image/")) {
                                return (
                                  <img
                                    src={authUrl}
                                    alt={fileName || "image"}
                                    className="rounded-lg max-w-[280px] max-h-[200px] object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                    onClick={() => setPreviewImage(authUrl)}
                                  />
                                );
                              }
                              if (fileUrl) {
                                return (
                                  <a
                                    href={authUrl}
                                    download={fileName}
                                    className={`flex items-center gap-2 ${isMe ? "text-primary-foreground/90 hover:text-primary-foreground" : "text-foreground hover:text-primary"} transition-colors`}
                                  >
                                    <Paperclip className="h-4 w-4 shrink-0" />
                                    <div className="min-w-0">
                                      <p className="text-sm font-medium truncate">{fileName}</p>
                                      {fileSize && (
                                        <p className="text-[10px] opacity-70">
                                          {fileSize > 1048576
                                            ? `${(fileSize / 1048576).toFixed(1)} MB`
                                            : `${(fileSize / 1024).toFixed(0)} KB`}
                                        </p>
                                      )}
                                    </div>
                                  </a>
                                );
                              }
                              return null;
                            })()}
                            {msg.content && <span>{msg.content}</span>}
                          </div>
                          <div
                            className={`flex items-center gap-2 mt-0.5 ${
                              isMe ? "justify-end" : ""
                            }`}
                          >
                            <button
                              onClick={() => handleTranslate(msg)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-muted-foreground hover:text-primary flex items-center gap-1"
                            >
                              <Languages className="h-3 w-3" />
                              {t("common.translate")}
                            </button>
                          </div>
                          {translations[msg.id] && (
                            <p
                              className={`text-xs text-muted-foreground/70 italic mt-0.5 px-3.5 ${
                                isMe ? "text-right" : ""
                              }`}
                            >
                              {translations[msg.id]}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>

            {/* Typing indicator */}
            {typingUser && (
              <div className="px-4 py-1 text-xs text-muted-foreground animate-pulse">
                {resolveUserName(typingUser)} {t("chat.typing")}
              </div>
            )}

            {/* Input area */}
            <div className="border-t p-2 sm:p-3 flex gap-2 shrink-0 items-end">
              <label className="shrink-0 cursor-pointer">
                <input
                  type="file"
                  className="hidden"
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.zip,.txt,.csv"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file || !selectedConv || !user) return;
                    e.target.value = "";
                    const formData = new FormData();
                    formData.append("file", file);
                    formData.append("senderId", user.id);
                    try {
                      const token = localStorage.getItem("token");
                      const resp = await fetch(`/api/chat/upload/${selectedConv.id}`, {
                        method: "POST",
                        headers: token ? { Authorization: `Bearer ${token}` } : {},
                        body: formData,
                      });
                      if (resp.ok) {
                        const msg = await resp.json();
                        setMessages((prev) => {
                          if (prev.some((m) => m.id === msg.id)) return prev;
                          return [...prev, msg];
                        });
                      }
                    } catch {}
                  }}
                />
                <div className="h-10 w-10 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
                  <Paperclip className="h-4 w-4" />
                </div>
              </label>
              <Textarea
                ref={textareaRef}
                placeholder={t("chat.type_message")}
                value={messageText}
                onChange={handleTextareaChange}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                className="flex-1 min-h-[40px] max-h-[120px] resize-none"
                rows={1}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = "auto";
                  target.style.height = Math.min(target.scrollHeight, 120) + "px";
                }}
              />
              <Button
                size="icon"
                onClick={handleSend}
                disabled={!messageText.trim() || sending}
                title={t("chat.send")}
                className="shrink-0 h-10 w-10"
              >
                <SendHorizontal className="h-4 w-4" />
              </Button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-3">
              <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground">
                {t("chat.select_conversation")}
              </p>
              <div className="flex gap-2 justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setDmDialogOpen(true)}
                >
                  <Mail className="h-3.5 w-3.5" />
                  {t("chat.new_message")}
                </Button>
                <Button
                  size="sm"
                  className="gap-1.5"
                  onClick={() => setCreateOpen(true)}
                >
                  <Plus className="h-3.5 w-3.5" />
                  {t("chat.group_chat")}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── New DM Dialog ───────────────────────────────────────────────── */}
      <Dialog open={dmDialogOpen} onOpenChange={setDmDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("chat.new_message")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("chat.search_users")}
                value={dmSearchQuery}
                onChange={(e) => setDmSearchQuery(e.target.value)}
                className="pl-9"
                autoFocus
              />
            </div>
            <div className="border rounded-lg max-h-[300px] overflow-y-auto">
              {usersLoading ? (
                <div className="p-4 flex justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : filteredDmUsers.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  {t("chat.no_users")}
                </div>
              ) : (
                filteredDmUsers.map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-accent/50 transition-colors"
                    onClick={() => handleStartDM(u)}
                  >
                    <Avatar className="h-9 w-9 shrink-0">
                      <AvatarFallback className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                        {getUserInitials(u.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{u.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {u.email}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      {getRoleBadge(u.role)}
                    </Badge>
                  </div>
                ))
              )}
            </div>
            <p className="text-xs text-muted-foreground text-center">
              {t("chat.start_conversation")}
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Create Group Dialog ─────────────────────────────────────────── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("chat.group_chat")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <Label>{t("chat.project")} *</Label>
              <Select value={newProjectId} onValueChange={setNewProjectId}>
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      projects.length === 0
                        ? t("common.loading")
                        : t("chat.select_project")
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.title}
                    </SelectItem>
                  ))}
                  {projects.length === 0 && (
                    <div className="p-2 text-center text-xs text-muted-foreground">
                      {t("common.loading")}
                    </div>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("common.title")}</Label>
              <Input
                placeholder={t("chat.topic")}
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>
                {t("chat.participants")} *{" "}
                <span className="text-muted-foreground font-normal">
                  ({newParticipants.length} {t("chat.selected")})
                </span>
              </Label>
              <Input
                placeholder={t("chat.search_users")}
                value={participantSearch}
                onChange={(e) => setParticipantSearch(e.target.value)}
                className="mb-2"
              />
              <div className="border rounded-lg max-h-[150px] sm:max-h-[200px] overflow-y-auto">
                {users
                  .filter((u) => u.id !== user?.id)
                  .filter((u) => {
                    if (!participantSearch.trim()) return true;
                    const q = participantSearch.toLowerCase();
                    return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
                  })
                  .map((u) => {
                    const selected = newParticipants.includes(u.id);
                    return (
                      <div
                        key={u.id}
                        className={`flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-accent/50 transition-colors ${
                          selected ? "bg-primary/5" : ""
                        }`}
                        onClick={() => toggleParticipant(u.id)}
                      >
                        <div
                          className={`h-4 w-4 rounded border flex items-center justify-center shrink-0 ${
                            selected
                              ? "bg-primary border-primary"
                              : "border-input"
                          }`}
                        >
                          {selected && (
                            <svg
                              className="h-3 w-3 text-primary-foreground"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={3}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          )}
                        </div>
                        <Avatar className="h-7 w-7">
                          <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                            {getUserInitials(u.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {u.name}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {u.email}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          {getRoleBadge(u.role)}
                        </Badge>
                      </div>
                    );
                  })}
                {users.filter((u) => u.id !== user?.id).length === 0 && (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    {t("chat.no_users")}
                  </div>
                )}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              onClick={handleCreateGroup}
              disabled={
                !newProjectId || newParticipants.length === 0 || creating
              }
            >
              {creating ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              {t("common.create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Conversation Info Sheet ─────────────────────────────────────── */}
      <Sheet open={infoOpen} onOpenChange={setInfoOpen}>
        <SheetContent side="right" className="w-[320px] sm:w-[380px]">
          <SheetHeader>
            <SheetTitle>{t("chat.info")}</SheetTitle>
          </SheetHeader>
          {selectedConv && (
            <div className="mt-4 space-y-6">
              {/* Conversation title */}
              <div className="text-center">
                <Avatar className="h-16 w-16 mx-auto mb-2">
                  <AvatarFallback className="text-xl bg-primary/10 text-primary">
                    {getConversationInitial(selectedConv)}
                  </AvatarFallback>
                </Avatar>
                <h3 className="font-semibold text-lg">
                  {getConversationTitle(selectedConv)}
                </h3>
                {!isDMConversation(selectedConv) && (
                  <p className="text-sm text-muted-foreground">
                    {selectedConv.participants.length} {t("chat.participants_count")}
                  </p>
                )}
              </div>

              {/* Created date */}
              {selectedConv.createdAt && (
                <div className="text-sm text-muted-foreground text-center">
                  {t("chat.created_at")}: {formatFullDate(selectedConv.createdAt, locale)}
                </div>
              )}

              <Separator />

              {/* Members list */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium">
                    {t("chat.members")} ({selectedConv.participants.length})
                  </h4>
                  {!isDMConversation(selectedConv) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1 h-7 text-xs"
                      onClick={() => setAddMemberOpen(true)}
                    >
                      <UserPlus className="h-3.5 w-3.5" />
                      {t("chat.add_member")}
                    </Button>
                  )}
                </div>
                <div className="space-y-1">
                  {selectedConv.participants.map((p) => {
                    const name = resolveUserName(p.userId);
                    const email = getUserEmail(p.userId);
                    const userInfo = users.find((u) => u.id === p.userId);
                    const isCurrentUser = p.userId === user?.id;
                    return (
                      <div
                        key={p.id}
                        className="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-accent/50"
                      >
                        <Avatar className="h-8 w-8 shrink-0">
                          <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                            {getUserInitials(name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {name}
                            {isCurrentUser && (
                              <span className="text-muted-foreground font-normal">
                                {" "}
                                (you)
                              </span>
                            )}
                          </p>
                          {email && (
                            <p className="text-xs text-muted-foreground truncate">
                              {email}
                            </p>
                          )}
                        </div>
                        {userInfo && (
                          <Badge
                            variant="outline"
                            className="text-[10px] shrink-0"
                          >
                            {getRoleBadge(userInfo.role)}
                          </Badge>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <Separator />

              {/* Leave button */}
              <Button
                variant="destructive"
                className="w-full gap-2"
                onClick={handleLeave}
              >
                <LogOut className="h-4 w-4" />
                {t("chat.leave")}
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* ── Add Member Dialog ───────────────────────────────────────────── */}
      <Dialog open={addMemberOpen} onOpenChange={setAddMemberOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("chat.add_member")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t("chat.search_users")}
                value={addMemberSearch}
                onChange={(e) => setAddMemberSearch(e.target.value)}
                className="pl-9"
                autoFocus
              />
            </div>
            <div className="border rounded-lg max-h-[250px] overflow-y-auto">
              {filteredAddMembers.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  {t("chat.no_users")}
                </div>
              ) : (
                filteredAddMembers.map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-accent/50 transition-colors"
                    onClick={() => handleAddMember(u)}
                  >
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                        {getUserInitials(u.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{u.name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {u.email}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      {getRoleBadge(u.role)}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {/* Image Preview Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setPreviewImage(null)}
        >
          <img
            src={previewImage}
            alt="Preview"
            className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            className="absolute top-4 right-4 text-white/80 hover:text-white bg-black/40 rounded-full p-2 transition-colors"
            onClick={() => setPreviewImage(null)}
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
