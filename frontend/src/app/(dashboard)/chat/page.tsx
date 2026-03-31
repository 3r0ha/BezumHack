"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import {
  Search,
  SendHorizontal,
  Languages,
  Copy,
  Reply,
  Paperclip,
  Brain,
  Plus,
  ArrowLeft,
  Info,
  Check,
  MessageSquare,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { io, Socket } from "socket.io-client";

// ─── Types ──────────────────────────────────────────────────────────────────

interface Participant {
  id: string;
  name: string;
  role: "CLIENT" | "DEVELOPER" | "MANAGER";
  online?: boolean;
}

interface Message {
  id: string;
  sender_id: string;
  sender_name: string;
  content: string;
  timestamp: string;
  date: string;
  translation?: string;
  isTranslating?: boolean;
}

interface Conversation {
  id: string;
  title: string;
  project_name: string;
  project_id: string;
  last_message: string;
  last_message_time: string;
  last_message_date: string;
  unread: number;
  participants: Participant[];
  avatar_color: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const SOCKET_URL = process.env.NEXT_PUBLIC_WS_URL || "http://localhost:8000";
const CURRENT_USER_ID = "me";

const AVATAR_COLORS = [
  "bg-blue-500",
  "bg-emerald-500",
  "bg-violet-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-indigo-500",
  "bg-pink-500",
];

// ─── Utilities ──────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatRelativeDate(dateStr: string): string {
  const today = new Date();
  const date = new Date(dateStr);
  const todayStr = today.toISOString().split("T")[0];
  const yesterdayDate = new Date(today);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayStr = yesterdayDate.toISOString().split("T")[0];

  if (dateStr === todayStr) return "Сегодня";
  if (dateStr === yesterdayStr) return "Вчера";
  return new Date(dateStr).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year:
      new Date(dateStr).getFullYear() !== today.getFullYear()
        ? "numeric"
        : undefined,
  });
}

function groupMessagesByDate(
  messages: Message[]
): { date: string; label: string; messages: Message[] }[] {
  const groups: Record<string, Message[]> = {};
  for (const msg of messages) {
    if (!groups[msg.date]) groups[msg.date] = [];
    groups[msg.date].push(msg);
  }
  return Object.entries(groups).map(([date, msgs]) => ({
    date,
    label: formatRelativeDate(date),
    messages: msgs,
  }));
}

// ─── Mock Data ──────────────────────────────────────────────────────────────

const TODAY = new Date().toISOString().split("T")[0];
const YESTERDAY = (() => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split("T")[0];
})();

const MOCK_CONVERSATIONS: Conversation[] = [
  {
    id: "c1",
    title: "Обсуждение функционала",
    project_name: "Мобильное приложение",
    project_id: "p1",
    last_message: "Конечно, обновлю к завтрашнему дню",
    last_message_time: "14:23",
    last_message_date: TODAY,
    unread: 3,
    participants: [
      { id: "u1", name: "Иван Петров", role: "CLIENT", online: true },
      { id: "u2", name: "Анна Сидорова", role: "DEVELOPER", online: true },
      { id: CURRENT_USER_ID, name: "Вы", role: "DEVELOPER", online: true },
    ],
    avatar_color: AVATAR_COLORS[0],
  },
  {
    id: "c2",
    title: "Ревью дизайна",
    project_name: "Веб-портал",
    project_id: "p2",
    last_message: "Жду ваши правки по цветовой палитре",
    last_message_time: "11:45",
    last_message_date: TODAY,
    unread: 1,
    participants: [
      { id: "u3", name: "Мария Козлова", role: "CLIENT", online: false },
      { id: "u4", name: "Дмитрий Волков", role: "MANAGER", online: true },
      { id: CURRENT_USER_ID, name: "Вы", role: "DEVELOPER", online: true },
    ],
    avatar_color: AVATAR_COLORS[2],
  },
  {
    id: "c3",
    title: "Техническое задание",
    project_name: "API Интеграция",
    project_id: "p3",
    last_message: "Документация по эндпоинтам готова",
    last_message_time: "09:12",
    last_message_date: YESTERDAY,
    unread: 0,
    participants: [
      { id: "u5", name: "Алексей Новиков", role: "DEVELOPER", online: false },
      { id: CURRENT_USER_ID, name: "Вы", role: "DEVELOPER", online: true },
    ],
    avatar_color: AVATAR_COLORS[4],
  },
];

const MOCK_MESSAGES: Record<string, Message[]> = {
  c1: [
    {
      id: "m1",
      sender_id: "u1",
      sender_name: "Иван Петров",
      content:
        "Добрый день! Хотел обсудить функционал мобильного приложения. Есть несколько важных моментов.",
      timestamp: "09:15",
      date: YESTERDAY,
    },
    {
      id: "m2",
      sender_id: CURRENT_USER_ID,
      sender_name: "Вы",
      content:
        "Здравствуйте, Иван! Конечно, готов обсудить. Что именно вас интересует?",
      timestamp: "09:22",
      date: YESTERDAY,
    },
    {
      id: "m3",
      sender_id: "u1",
      sender_name: "Иван Петров",
      content:
        "Нам нужна авторизация через социальные сети, push-уведомления и офлайн-режим. Это реально в текущие сроки?",
      timestamp: "09:30",
      date: YESTERDAY,
    },
    {
      id: "m4",
      sender_id: "u2",
      sender_name: "Анна Сидорова",
      content:
        "Авторизация и пуши -- без проблем. Офлайн-режим потребует дополнительную неделю, нужно реализовать локальное кеширование данных.",
      timestamp: "09:45",
      date: YESTERDAY,
    },
    {
      id: "m5",
      sender_id: "u1",
      sender_name: "Иван Петров",
      content: "Понял. Давайте тогда офлайн-режим во вторую итерацию вынесем.",
      timestamp: "10:00",
      date: YESTERDAY,
    },
    {
      id: "m6",
      sender_id: CURRENT_USER_ID,
      sender_name: "Вы",
      content:
        "Хорошее решение. Я подготовлю обновленный план на первый спринт без офлайна.",
      timestamp: "10:12",
      date: YESTERDAY,
    },
    {
      id: "m7",
      sender_id: "u1",
      sender_name: "Иван Петров",
      content:
        "Добрый день! Готов макет главной страницы, можете посмотреть? Отправил ссылку на Figma.",
      timestamp: "13:40",
      date: TODAY,
    },
    {
      id: "m8",
      sender_id: CURRENT_USER_ID,
      sender_name: "Вы",
      content:
        "Отлично, мне нравится направление! Можно сделать кнопку входа чуть крупнее? И навигацию снизу как в стандартных приложениях.",
      timestamp: "13:55",
      date: TODAY,
    },
    {
      id: "m9",
      sender_id: "u2",
      sender_name: "Анна Сидорова",
      content:
        "Согласна по навигации. Ещё предлагаю добавить анимацию перехода между экранами -- это сильно улучшит UX.",
      timestamp: "14:10",
      date: TODAY,
    },
    {
      id: "m10",
      sender_id: "u1",
      sender_name: "Иван Петров",
      content: "Конечно, обновлю к завтрашнему дню. Спасибо за обратную связь!",
      timestamp: "14:23",
      date: TODAY,
    },
  ],
  c2: [
    {
      id: "m20",
      sender_id: "u3",
      sender_name: "Мария Козлова",
      content:
        "Привет всем! Посмотрела текущую версию дизайна портала. В целом хорошо, но есть замечания.",
      timestamp: "10:00",
      date: TODAY,
    },
    {
      id: "m21",
      sender_id: CURRENT_USER_ID,
      sender_name: "Вы",
      content:
        "Добрый день, Мария! Будем рады услышать ваши замечания. Что нужно скорректировать?",
      timestamp: "10:15",
      date: TODAY,
    },
    {
      id: "m22",
      sender_id: "u3",
      sender_name: "Мария Козлова",
      content:
        "Шрифты на главной -- отлично. Но цветовая палитра слишком холодная для нашего бренда. Нужно добавить теплые акценты. И ещё: таблица на странице отчётов слишком плотная, нужно больше воздуха.",
      timestamp: "10:30",
      date: TODAY,
    },
    {
      id: "m23",
      sender_id: "u4",
      sender_name: "Дмитрий Волков",
      content:
        "Мария, спасибо за детальный фидбек. Мы обновим палитру и пришлём варианты к пятнице. По таблице -- увеличим межстрочный интервал и добавим зебра-стайл.",
      timestamp: "11:20",
      date: TODAY,
    },
    {
      id: "m24",
      sender_id: "u3",
      sender_name: "Мария Козлова",
      content:
        "Отлично, жду ваши правки по цветовой палитре. Буду на связи, если возникнут вопросы.",
      timestamp: "11:45",
      date: TODAY,
    },
  ],
  c3: [
    {
      id: "m30",
      sender_id: "u5",
      sender_name: "Алексей Новиков",
      content:
        "Привет! Начал работу над API-модулем. Планирую использовать REST для основных операций и WebSocket для real-time обновлений. Подходит?",
      timestamp: "08:30",
      date: YESTERDAY,
    },
    {
      id: "m31",
      sender_id: CURRENT_USER_ID,
      sender_name: "Вы",
      content:
        "Привет, Алексей. Да, подход правильный. Только для WebSocket давай используем Socket.IO -- там из коробки reconnect и fallback на polling.",
      timestamp: "08:50",
      date: YESTERDAY,
    },
    {
      id: "m32",
      sender_id: "u5",
      sender_name: "Алексей Новиков",
      content:
        "Согласен. Документация по эндпоинтам готова, залил в Swagger. Там 15 эндпоинтов: авторизация, CRUD проектов, задачи и комментарии.",
      timestamp: "09:12",
      date: YESTERDAY,
    },
  ],
};

const MOCK_PROJECTS = [
  { id: "p1", name: "Мобильное приложение" },
  { id: "p2", name: "Веб-портал" },
  { id: "p3", name: "API Интеграция" },
  { id: "p4", name: "CRM Система" },
];

// ─── Sub-Components ─────────────────────────────────────────────────────────

function TypingIndicator({ name }: { name: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span>{name} печатает</span>
        <span className="flex gap-0.5">
          <span className="inline-block h-1 w-1 rounded-full bg-muted-foreground animate-bounce [animation-delay:0ms]" />
          <span className="inline-block h-1 w-1 rounded-full bg-muted-foreground animate-bounce [animation-delay:150ms]" />
          <span className="inline-block h-1 w-1 rounded-full bg-muted-foreground animate-bounce [animation-delay:300ms]" />
        </span>
      </div>
    </div>
  );
}

function DateSeparator({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-4 py-4">
      <div className="flex-1 h-px bg-border" />
      <span className="text-xs font-medium text-muted-foreground px-2 select-none">
        {label}
      </span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

function MessageBubble({
  message,
  isOwn,
  onTranslate,
  onCopy,
}: {
  message: Message;
  isOwn: boolean;
  onTranslate: (id: string) => void;
  onCopy: (content: string) => void;
}) {
  const [showActions, setShowActions] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    onCopy(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={`flex gap-3 group px-4 ${isOwn ? "flex-row-reverse" : "flex-row"}`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Avatar */}
      {!isOwn && (
        <Avatar className="h-8 w-8 mt-0.5 shrink-0">
          <AvatarFallback className="text-xs bg-primary/10 text-primary font-medium">
            {getInitials(message.sender_name)}
          </AvatarFallback>
        </Avatar>
      )}

      <div className={`max-w-[70%] min-w-[120px] ${isOwn ? "items-end" : "items-start"}`}>
        {/* Sender name */}
        {!isOwn && (
          <p className="text-xs font-medium text-muted-foreground mb-1 ml-1">
            {message.sender_name}
          </p>
        )}

        {/* Bubble */}
        <div
          className={`relative rounded-2xl px-4 py-2.5 text-sm leading-relaxed transition-colors ${
            isOwn
              ? "bg-primary text-primary-foreground rounded-br-md"
              : "bg-muted rounded-bl-md"
          }`}
        >
          <p className="whitespace-pre-wrap break-words">{message.content}</p>

          {/* Translation */}
          {message.isTranslating && (
            <div className="mt-2 pt-2 border-t border-current/10">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full border-2 border-current/30 border-t-current/80 animate-spin" />
                <span className="text-xs opacity-70">Переводим...</span>
              </div>
            </div>
          )}
          {message.translation && !message.isTranslating && (
            <div className={`mt-2 pt-2 border-t ${isOwn ? "border-primary-foreground/15" : "border-border"}`}>
              <p className="text-xs font-medium opacity-60 mb-0.5">AI перевод</p>
              <p className="italic text-sm opacity-80">{message.translation}</p>
            </div>
          )}

          {/* Timestamp inside bubble */}
          <div className={`flex items-center gap-1 mt-1 ${isOwn ? "justify-end" : "justify-start"}`}>
            <span className={`text-[10px] ${isOwn ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
              {message.timestamp}
            </span>
          </div>
        </div>

        {/* Hover actions */}
        <div
          className={`flex items-center gap-0.5 mt-1 transition-all duration-200 ${
            showActions ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-1 pointer-events-none"
          } ${isOwn ? "justify-end mr-1" : "justify-start ml-1"}`}
        >
          <button
            onClick={() => onTranslate(message.id)}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Перевести"
          >
            <Languages className="h-3 w-3" />
          </button>
          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Копировать"
          >
            {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
          </button>
          <button
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Ответить"
          >
            <Reply className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

function ConversationItem({
  conversation,
  isActive,
  onClick,
}: {
  conversation: Conversation;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 transition-all duration-150 flex items-center gap-3 ${
        isActive
          ? "bg-primary/[0.08] border-l-2 border-l-primary"
          : "hover:bg-muted/50 border-l-2 border-l-transparent"
      }`}
    >
      {/* Avatar */}
      <Avatar className="h-11 w-11 shrink-0">
        <AvatarFallback
          className={`${conversation.avatar_color} text-white text-sm font-semibold`}
        >
          {getInitials(conversation.project_name)}
        </AvatarFallback>
      </Avatar>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <span className="font-semibold text-sm truncate">
            {conversation.project_name}
          </span>
          <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">
            {conversation.last_message_time}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground truncate leading-relaxed">
            {conversation.last_message}
          </p>
          {conversation.unread > 0 && (
            <Badge className="h-5 min-w-[20px] px-1.5 text-[10px] font-bold shrink-0 rounded-full">
              {conversation.unread}
            </Badge>
          )}
        </div>
      </div>
    </button>
  );
}

function ParticipantAvatarStack({ participants }: { participants: Participant[] }) {
  const others = participants.filter((p) => p.id !== CURRENT_USER_ID).slice(0, 4);
  return (
    <div className="flex -space-x-2">
      {others.map((p) => (
        <div key={p.id} className="relative">
          <Avatar className="h-7 w-7 border-2 border-background">
            <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-medium">
              {getInitials(p.name)}
            </AvatarFallback>
          </Avatar>
          {p.online && (
            <span className="absolute -bottom-0 -right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-background" />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function ChatPage() {
  // State
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const [isMobileViewingMessages, setIsMobileViewingMessages] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [showNewChatDialog, setShowNewChatDialog] = useState(false);
  const [newChatProject, setNewChatProject] = useState("");
  const [newChatTitle, setNewChatTitle] = useState("");
  const [showInfoPanel, setShowInfoPanel] = useState(false);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Derived
  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeConversationId) || null,
    [conversations, activeConversationId]
  );

  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim()) return conversations;
    const q = searchQuery.toLowerCase();
    return conversations.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.project_name.toLowerCase().includes(q) ||
        c.last_message.toLowerCase().includes(q)
    );
  }, [conversations, searchQuery]);

  const messageGroups = useMemo(() => groupMessagesByDate(messages), [messages]);

  // ─── Effects ────────────────────────────────────────────────────────────

  // Load mock data on mount
  useEffect(() => {
    setConversations(MOCK_CONVERSATIONS);
    // Don't auto-select on mobile
    if (window.innerWidth >= 768) {
      setActiveConversationId("c1");
    }
  }, []);

  // Socket connection
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    const newSocket = io(SOCKET_URL, {
      auth: { token },
      transports: ["websocket"],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    newSocket.on("connect", () => {
      console.log("[Chat] Socket connected");
    });

    newSocket.on("new_message", (message: Message) => {
      setMessages((prev) => [...prev, message]);
      // Play notification sound placeholder
      if (document.hidden) {
        try {
          new Audio("/notification.mp3").play().catch(() => {});
        } catch {}
      }
    });

    newSocket.on("user_typing", (data: { user_name: string }) => {
      setTypingUser(data.user_name);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => setTypingUser(null), 3000);
    });

    setSocket(newSocket);
    return () => {
      newSocket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load messages when switching conversations
  useEffect(() => {
    if (!activeConversationId) return;

    const mockMsgs = MOCK_MESSAGES[activeConversationId];
    if (mockMsgs) {
      setMessages(mockMsgs);
    } else {
      setMessages([]);
    }

    setTypingUser(null);

    // Socket room management
    if (socket) {
      socket.emit("leave_room", { conversation_id: activeConversationId });
      socket.emit("join_room", { conversation_id: activeConversationId });
    }

    // Mark as read
    setConversations((prev) =>
      prev.map((c) => (c.id === activeConversationId ? { ...c, unread: 0 } : c))
    );
  }, [activeConversationId, socket]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typingUser]);

  // Auto-resize textarea
  const handleTextareaInput = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const maxHeight = 4 * 24; // 4 lines
    el.style.height = Math.min(el.scrollHeight, maxHeight) + "px";
  }, []);

  // ─── Handlers ───────────────────────────────────────────────────────────

  const handleSend = useCallback(() => {
    if (!inputValue.trim() || !activeConversationId || isSending) return;

    const newMessage: Message = {
      id: `m-${Date.now()}`,
      sender_id: CURRENT_USER_ID,
      sender_name: "Вы",
      content: inputValue.trim(),
      timestamp: new Date().toLocaleTimeString("ru-RU", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      date: new Date().toISOString().split("T")[0],
    };

    setIsSending(true);

    // Optimistic update
    setMessages((prev) => [...prev, newMessage]);
    setInputValue("");

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    // Update conversation last message
    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeConversationId
          ? {
              ...c,
              last_message: newMessage.content,
              last_message_time: newMessage.timestamp,
              last_message_date: newMessage.date,
            }
          : c
      )
    );

    // Emit via socket
    if (socket) {
      socket.emit("send_message", {
        conversation_id: activeConversationId,
        content: newMessage.content,
      });
    }

    setTimeout(() => setIsSending(false), 300);
  }, [inputValue, activeConversationId, isSending, socket]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleSend();
      }
      // Regular Enter without shift sends message
      if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handleTranslate = useCallback((messageId: string) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId ? { ...m, isTranslating: true, translation: undefined } : m
      )
    );

    // Simulate AI translation
    setTimeout(() => {
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== messageId) return m;
          // Simple mock translations
          const translations: Record<string, string> = {
            "Добрый день! Хотел обсудить функционал мобильного приложения. Есть несколько важных моментов.":
              "Good afternoon! I wanted to discuss the mobile app functionality. There are several important points.",
            "Здравствуйте, Иван! Конечно, готов обсудить. Что именно вас интересует?":
              "Hello, Ivan! Of course, ready to discuss. What exactly interests you?",
            "Конечно, обновлю к завтрашнему дню. Спасибо за обратную связь!":
              "Of course, I will update it by tomorrow. Thanks for the feedback!",
          };
          return {
            ...m,
            isTranslating: false,
            translation:
              translations[m.content] ||
              "English translation would appear here via AI service.",
          };
        })
      );
    }, 1500);
  }, []);

  const handleCopy = useCallback((content: string) => {
    navigator.clipboard.writeText(content).catch(() => {});
  }, []);

  const handleSummarize = useCallback(() => {
    if (isSummarizing || messages.length === 0) return;
    setIsSummarizing(true);

    setTimeout(() => {
      const summaryMsg: Message = {
        id: `summary-${Date.now()}`,
        sender_id: "system",
        sender_name: "AI Ассистент",
        content: `Краткое содержание беседы:\n\nУчастники обсудили текущий прогресс по проекту. Основные решения:\n1. Согласованы ключевые функции для первой итерации\n2. Определены сроки для следующего этапа\n3. Распределены задачи между участниками\n\nТребуется действие: подготовить обновленный план к следующей встрече.`,
        timestamp: new Date().toLocaleTimeString("ru-RU", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        date: new Date().toISOString().split("T")[0],
      };
      setMessages((prev) => [...prev, summaryMsg]);
      setIsSummarizing(false);
    }, 2000);
  }, [isSummarizing, messages.length]);

  const handleCreateChat = useCallback(() => {
    if (!newChatProject) return;
    const project = MOCK_PROJECTS.find((p) => p.id === newChatProject);
    if (!project) return;

    const newConversation: Conversation = {
      id: `c-${Date.now()}`,
      title: newChatTitle || "Новый диалог",
      project_name: project.name,
      project_id: project.id,
      last_message: "Нет сообщений",
      last_message_time: new Date().toLocaleTimeString("ru-RU", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      last_message_date: new Date().toISOString().split("T")[0],
      unread: 0,
      participants: [
        { id: CURRENT_USER_ID, name: "Вы", role: "DEVELOPER", online: true },
      ],
      avatar_color: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
    };

    setConversations((prev) => [newConversation, ...prev]);
    setActiveConversationId(newConversation.id);
    setShowNewChatDialog(false);
    setNewChatProject("");
    setNewChatTitle("");
    setIsMobileViewingMessages(true);
  }, [newChatProject, newChatTitle]);

  const selectConversation = useCallback((id: string) => {
    setActiveConversationId(id);
    setIsMobileViewingMessages(true);
    setShowInfoPanel(false);
  }, []);

  const handleBackToList = useCallback(() => {
    setIsMobileViewingMessages(false);
    setShowInfoPanel(false);
  }, []);

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="flex h-[calc(100vh-7rem)] rounded-xl border bg-card overflow-hidden shadow-sm">
      {/* ─── Left Panel: Conversations ─── */}
      <div
        className={`w-full md:w-80 border-r flex flex-col shrink-0 transition-all duration-300 ${
          isMobileViewingMessages ? "hidden md:flex" : "flex"
        }`}
      >
        {/* Header */}
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold tracking-tight">Сообщения</h2>
            <Dialog open={showNewChatDialog} onOpenChange={setShowNewChatDialog}>
              <DialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Новый чат</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Проект</label>
                    <select
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      value={newChatProject}
                      onChange={(e) => setNewChatProject(e.target.value)}
                    >
                      <option value="">Выберите проект...</option>
                      {MOCK_PROJECTS.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      Название чата{" "}
                      <span className="text-muted-foreground font-normal">(необязательно)</span>
                    </label>
                    <Input
                      placeholder="Например: Обсуждение дизайна"
                      value={newChatTitle}
                      onChange={(e) => setNewChatTitle(e.target.value)}
                    />
                  </div>
                  <Button
                    className="w-full"
                    onClick={handleCreateChat}
                    disabled={!newChatProject}
                  >
                    Создать чат
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Поиск по чатам..."
              className="pl-9 h-9 bg-muted/50 border-0 focus-visible:ring-1"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <Separator />

        {/* Conversation List */}
        <ScrollArea className="flex-1">
          {filteredConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center px-6">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
                <MessageSquare className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">
                {searchQuery ? "Ничего не найдено" : "Нет активных диалогов"}
              </p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                {searchQuery
                  ? "Попробуйте другой запрос"
                  : "Начните новый чат, нажав +"}
              </p>
            </div>
          ) : (
            <div className="py-1">
              {filteredConversations.map((conv) => (
                <ConversationItem
                  key={conv.id}
                  conversation={conv}
                  isActive={conv.id === activeConversationId}
                  onClick={() => selectConversation(conv.id)}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* ─── Right Panel: Messages ─── */}
      <div
        className={`flex-1 flex flex-col min-w-0 ${
          !isMobileViewingMessages ? "hidden md:flex" : "flex"
        }`}
      >
        {activeConversation ? (
          <>
            {/* ─── Chat Header ─── */}
            <div className="h-16 px-4 flex items-center justify-between border-b shrink-0 bg-card">
              <div className="flex items-center gap-3 min-w-0">
                {/* Mobile back button */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 md:hidden shrink-0"
                  onClick={handleBackToList}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>

                <Avatar className="h-9 w-9 shrink-0">
                  <AvatarFallback
                    className={`${activeConversation.avatar_color} text-white text-xs font-semibold`}
                  >
                    {getInitials(activeConversation.project_name)}
                  </AvatarFallback>
                </Avatar>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-sm truncate">
                      {activeConversation.project_name}
                    </h3>
                    <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0 hidden sm:block" />
                    <span className="text-xs text-muted-foreground truncate hidden sm:block">
                      {activeConversation.title}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {activeConversation.participants.length} участник
                    {activeConversation.participants.length > 1 &&
                      (activeConversation.participants.length < 5 ? "а" : "ов")}
                    {" · "}
                    {activeConversation.participants.filter(
                      (p) => p.online && p.id !== CURRENT_USER_ID
                    ).length > 0 && (
                      <span className="text-emerald-500">
                        {
                          activeConversation.participants.filter(
                            (p) => p.online && p.id !== CURRENT_USER_ID
                          ).length
                        }{" "}
                        в сети
                      </span>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <ParticipantAvatarStack
                  participants={activeConversation.participants}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full"
                  onClick={() => setShowInfoPanel(!showInfoPanel)}
                >
                  <Info className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* ─── Chat Body ─── */}
            <div className="flex-1 flex overflow-hidden">
              {/* Messages Area */}
              <ScrollArea className="flex-1">
                <div className="py-4 space-y-1 min-h-full flex flex-col justify-end">
                  {messageGroups.map((group) => (
                    <div key={group.date}>
                      <DateSeparator label={group.label} />
                      <div className="space-y-3">
                        {group.messages.map((msg) => (
                          <MessageBubble
                            key={msg.id}
                            message={msg}
                            isOwn={msg.sender_id === CURRENT_USER_ID}
                            onTranslate={handleTranslate}
                            onCopy={handleCopy}
                          />
                        ))}
                      </div>
                    </div>
                  ))}

                  {/* Typing indicator */}
                  {typingUser && <TypingIndicator name={typingUser} />}

                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              {/* Info Side Panel */}
              {showInfoPanel && (
                <div className="w-72 border-l bg-card shrink-0 overflow-auto hidden lg:block">
                  <div className="p-4 space-y-6">
                    <div className="text-center">
                      <Avatar className="h-16 w-16 mx-auto mb-3">
                        <AvatarFallback
                          className={`${activeConversation.avatar_color} text-white text-xl font-bold`}
                        >
                          {getInitials(activeConversation.project_name)}
                        </AvatarFallback>
                      </Avatar>
                      <h4 className="font-bold">{activeConversation.project_name}</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        {activeConversation.title}
                      </p>
                    </div>

                    <Separator />

                    <div>
                      <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                        Участники ({activeConversation.participants.length})
                      </h5>
                      <div className="space-y-3">
                        {activeConversation.participants.map((p) => (
                          <div
                            key={p.id}
                            className="flex items-center gap-3"
                          >
                            <div className="relative">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback className="text-xs bg-primary/10 text-primary font-medium">
                                  {getInitials(p.name)}
                                </AvatarFallback>
                              </Avatar>
                              {p.online && (
                                <span className="absolute -bottom-0 -right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-card" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium truncate">
                                {p.id === CURRENT_USER_ID ? "Вы" : p.name}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {p.role === "CLIENT"
                                  ? "Заказчик"
                                  : p.role === "MANAGER"
                                    ? "Менеджер"
                                    : "Разработчик"}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <Separator />

                    <div>
                      <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                        Проект
                      </h5>
                      <button className="w-full text-left text-sm text-primary hover:underline">
                        {activeConversation.project_name}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ─── Input Area ─── */}
            <div className="border-t bg-card px-4 py-3 shrink-0">
              <div className="flex items-end gap-2">
                {/* Attach */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-full shrink-0 text-muted-foreground hover:text-foreground"
                  title="Прикрепить файл"
                >
                  <Paperclip className="h-4 w-4" />
                </Button>

                {/* Textarea */}
                <div className="flex-1 relative">
                  <textarea
                    ref={textareaRef}
                    value={inputValue}
                    onChange={(e) => {
                      setInputValue(e.target.value);
                      handleTextareaInput();
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder="Введите сообщение..."
                    rows={1}
                    disabled={isSending}
                    className="w-full resize-none rounded-xl border border-input bg-muted/30 px-4 py-2.5 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50 leading-relaxed"
                    style={{ minHeight: "40px", maxHeight: "96px" }}
                  />
                </div>

                {/* AI Summarize */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 rounded-full shrink-0 text-muted-foreground hover:text-foreground"
                  onClick={handleSummarize}
                  disabled={isSummarizing || messages.length === 0}
                  title="AI Резюме беседы"
                >
                  {isSummarizing ? (
                    <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground animate-spin" />
                  ) : (
                    <Brain className="h-4 w-4" />
                  )}
                </Button>

                {/* Send */}
                <Button
                  size="icon"
                  className="h-9 w-9 rounded-full shrink-0 transition-all duration-200"
                  onClick={handleSend}
                  disabled={!inputValue.trim() || isSending}
                >
                  <SendHorizontal className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground/50 mt-1.5 text-right select-none">
                Enter -- отправить, Shift+Enter -- новая строка
              </p>
            </div>
          </>
        ) : (
          /* ─── Empty State ─── */
          <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
            <div className="h-20 w-20 rounded-full bg-muted/50 flex items-center justify-center mb-6">
              <MessageSquare className="h-10 w-10 text-muted-foreground/50" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Выберите чат</h3>
            <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
              Выберите существующий диалог из списка слева или создайте новый чат
              для общения с командой проекта.
            </p>
            <Button
              variant="outline"
              className="mt-6"
              onClick={() => setShowNewChatDialog(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Начать новый чат
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
