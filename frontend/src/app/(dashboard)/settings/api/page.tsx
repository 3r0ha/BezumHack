"use client";

import { useEffect, useState } from "react";
import {
  Key,
  Plus,
  Trash2,
  Copy,
  Check,
  Eye,
  EyeOff,
  Clock,
  Shield,
  Loader2,
  Book,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
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
import { api } from "@/lib/api";
import { useLocale } from "@/contexts/locale-context";

interface ApiKeyItem {
  id: string;
  name: string;
  prefix: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

interface NewKeyResponse {
  id: string;
  name: string;
  key: string;
  prefix: string;
  expiresAt: string | null;
  createdAt: string;
}

function formatDate(dateStr: string | null, neverLabel: string = "Never"): string {
  if (!dateStr) return neverLabel;
  return new Date(dateStr).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const { t } = useLocale();
  return (
    <Button
      variant="outline"
      size="sm"
      className="gap-1.5"
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? t('common.copied') : t('common.copy')}
    </Button>
  );
}

interface Endpoint {
  method: string;
  path: string;
  desc: string;
  auth: string;
  request?: string;
  response?: string;
  params?: string;
}

const API_DOCS: { sectionKey: string; endpoints: Endpoint[] }[] = [
  {
    sectionKey: "api.section.my_projects",
    endpoints: [
      { method: "GET", path: "/api/projects/projects", desc: "Посмотреть все ваши проекты, их статусы и прогресс выполнения", auth: "API Key",
        params: "?search=текст&status=ACTIVE (все опционально)",
        response: '[\n  {\n    "id": "uuid",\n    "title": "My Project",\n    "description": "...",\n    "status": "DRAFT | ACTIVE | ON_HOLD | COMPLETED | CANCELLED",\n    "clientId": "uuid",\n    "managerId": "uuid" | null,\n    "deadline": "2026-06-01T..." | null,\n    "tasks": [{ "status": "BACKLOG" }, ...]\n  }\n]' },
      { method: "POST", path: "/api/projects/projects", desc: "Создать новый проект, указав клиента и менеджера", auth: "API Key",
        request: '{\n  "title": "Название проекта",  // обязательно\n  "description": "Описание",\n  "clientId": "uuid",  // обязательно\n  "managerId": "uuid",\n  "deadline": "2026-06-01"\n}',
        response: '{\n  "id": "uuid",\n  "title": "...",\n  "status": "DRAFT",\n  ...\n}' },
      { method: "GET", path: "/api/projects/projects/:id", desc: "Открыть проект и увидеть все задачи, зависимости и текущий статус", auth: "API Key",
        response: '{\n  "id": "uuid",\n  "title": "...",\n  "tasks": [\n    {\n      "id": "uuid",\n      "title": "Задача",\n      "status": "IN_PROGRESS",\n      "priority": "HIGH",\n      "blockedBy": [{ "blockingTaskId": "uuid", "blockingTask": {...} }],\n      "blocks": [...]\n    }\n  ]\n}' },
      { method: "PATCH", path: "/api/projects/projects/:id", desc: "Изменить параметры проекта — название, статус, дедлайн или менеджера", auth: "API Key",
        request: '{\n  "title": "Новое название",\n  "status": "ACTIVE",\n  "managerId": "uuid",\n  "deadline": "2026-07-01" | null\n}  // все поля опциональны' },
    ],
  },
  {
    sectionKey: "api.section.tasks",
    endpoints: [
      { method: "POST", path: "/api/projects/tasks", desc: "Добавить задачу в проект — задать приоритет, исполнителя и зависимости", auth: "API Key",
        request: '{\n  "title": "API Development",  // обязательно\n  "description": "Подробное описание",\n  "projectId": "uuid",  // обязательно\n  "priority": "LOW | MEDIUM | HIGH | CRITICAL",\n  "assigneeId": "uuid",\n  "estimatedHours": 16,\n  "dueDate": "2026-04-15",\n  "dependsOn": ["task-uuid-1", "task-uuid-2"]\n}',
        response: '{\n  "id": "uuid",\n  "title": "...",\n  "status": "BACKLOG",\n  "blockedBy": [...],\n  "blocks": [...]\n}' },
      { method: "PATCH", path: "/api/projects/tasks/:id", desc: "Обновить задачу — перевести статус, сменить приоритет или исполнителя", auth: "API Key",
        request: '{\n  "status": "BACKLOG | TODO | IN_PROGRESS | REVIEW | DONE",\n  "priority": "HIGH",\n  "assigneeId": "uuid" | null,\n  "estimatedHours": 24\n}  // все поля опциональны',
        response: 'Объект задачи с обновлёнными полями.\nОшибка 400 если есть незавершённые блокирующие зависимости.' },
      { method: "DELETE", path: "/api/projects/tasks/:id", desc: "Удалить задачу из проекта навсегда", auth: "API Key", response: '204 No Content' },
      { method: "POST", path: "/api/projects/tasks/:id/dependencies", desc: "Связать задачи — указать, какая задача блокирует текущую", auth: "API Key",
        request: '{\n  "blockingTaskId": "uuid"  // задача, которая блокирует текущую\n}',
        response: 'Ошибка 400 при попытке создать циклическую зависимость.' },
    ],
  },
  {
    sectionKey: "api.section.comments",
    endpoints: [
      { method: "GET", path: "/api/projects/comments/task/:taskId", desc: "Прочитать все комментарии команды по задаче", auth: "API Key",
        response: '[\n  {\n    "id": "uuid",\n    "content": "Текст комментария",\n    "userId": "uuid",\n    "taskId": "uuid",\n    "createdAt": "2026-03-25T..."\n  }\n]' },
      { method: "POST", path: "/api/projects/comments", desc: "Написать комментарий к задаче от вашего имени", auth: "API Key",
        request: '{\n  "content": "Текст комментария",  // обязательно\n  "taskId": "uuid"  // обязательно\n}',
        response: 'Объект комментария. userId берётся из токена автоматически.' },
    ],
  },
  {
    sectionKey: "api.section.approvals",
    endpoints: [
      { method: "GET", path: "/api/projects/approvals/project/:id", desc: "Посмотреть все запросы на согласование в проекте и их статусы", auth: "API Key",
        response: '[\n  {\n    "id": "uuid",\n    "title": "Согласование дизайна",\n    "status": "PENDING | APPROVED | REJECTED",\n    "requestedBy": "uuid",\n    "reviewedBy": "uuid" | null,\n    "reviewComment": "..." | null\n  }\n]' },
      { method: "POST", path: "/api/projects/approvals", desc: "Отправить запрос на согласование клиенту или менеджеру", auth: "API Key",
        request: '{\n  "projectId": "uuid",  // обязательно\n  "title": "Название",  // обязательно\n  "description": "Подробности"\n}' },
      { method: "PATCH", path: "/api/projects/approvals/:id/review", desc: "Утвердить или отклонить запрос — принять решение по согласованию", auth: "API Key",
        request: '{\n  "status": "APPROVED | REJECTED",  // обязательно\n  "reviewComment": "Комментарий к решению"\n}' },
    ],
  },
  {
    sectionKey: "api.section.invoices",
    endpoints: [
      { method: "GET", path: "/api/projects/invoices/project/:id", desc: "Получить все счета по проекту — суммы, статусы оплаты, детализация", auth: "API Key",
        response: '[\n  {\n    "id": "uuid",\n    "number": "INV-202603-0001",\n    "totalAmount": 480000,\n    "status": "DRAFT | ISSUED | PAID | OVERDUE | CANCELLED",\n    "items": [{ "description": "...", "hours": 40, "rate": 4000, "amount": 160000 }]\n  }\n]' },
      { method: "POST", path: "/api/projects/invoices", desc: "Выставить счёт вручную с детализацией по позициям и ставкам", auth: "API Key",
        request: '{\n  "projectId": "uuid",\n  "items": [\n    {\n      "description": "API Development",\n      "hours": 40,\n      "rate": 4000,\n      "taskId": "uuid"  // опционально\n    }\n  ]\n}' },
      { method: "POST", path: "/api/projects/invoices/generate/:projectId", desc: "Автоматически сформировать счёт на основе трудозатрат по задачам проекта", auth: "API Key",
        response: 'Автоматически создаёт счёт из всех задач с tracked time.' },
    ],
  },
  {
    sectionKey: "api.section.chat",
    endpoints: [
      { method: "GET", path: "/api/chat/conversations", desc: "Открыть список ваших бесед по проектам", auth: "API Key",
        params: "?projectId=uuid (опционально)",
        response: '[\n  {\n    "id": "uuid",\n    "projectId": "uuid",\n    "title": "Обсуждение дизайна",\n    "participants": [{ "userId": "uuid" }],\n    "messages": [{ "content": "последнее сообщение" }]\n  }\n]' },
      { method: "POST", path: "/api/chat/conversations", desc: "Начать новую беседу и пригласить участников проекта", auth: "API Key",
        request: '{\n  "projectId": "uuid",  // обязательно\n  "title": "Тема беседы",\n  "participantIds": ["uuid", "uuid"]  // мин. 1 участник\n}' },
      { method: "POST", path: "/api/chat/conversations/:id/messages", desc: "Отправить сообщение в беседу", auth: "API Key",
        request: '{\n  "senderId": "uuid",  // обязательно\n  "content": "Текст сообщения"  // обязательно\n}' },
    ],
  },
  {
    sectionKey: "api.section.webhooks",
    endpoints: [
      { method: "GET", path: "/api/projects/webhooks", desc: "Посмотреть все настроенные вебхуки и их статусы", auth: "API Key",
        response: '[{ "id": "uuid", "url": "https://...", "events": ["task.created"], "active": true, "secret": "whsec_ab..." }]' },
      { method: "POST", path: "/api/projects/webhooks", desc: "Подключить вебхук — получать уведомления о событиях на ваш сервер", auth: "API Key",
        request: '{\n  "url": "https://your-server.com/webhook",  // обязательно\n  "events": [  // обязательно, мин. 1\n    "task.created",\n    "task.status_changed",\n    "task.completed",\n    "comment.created",\n    "approval.requested",\n    "approval.reviewed",\n    "invoice.created",\n    "project.updated"\n  ],\n  "projectId": "uuid"  // опционально, фильтр по проекту\n}',
        response: 'Объект вебхука с полным secret (показывается только при создании!).\nЗапросы подписываются HMAC-SHA256: заголовок X-Envelope-Signature.' },
      { method: "POST", path: "/api/projects/webhooks/test/:id", desc: "Проверить вебхук — отправить тестовый запрос на ваш сервер", auth: "API Key",
        response: '{ "success": true, "statusCode": 200 }' },
      { method: "DELETE", path: "/api/projects/webhooks/:id", desc: "Отключить и удалить вебхук", auth: "API Key", response: '204 No Content' },
    ],
  },
  {
    sectionKey: "api.section.ai",
    endpoints: [
      { method: "POST", path: "/api/ai/summarize/", desc: "Сжать длинное ТЗ или документ в краткую выжимку с ключевыми пунктами", auth: "API Key",
        request: '{\n  "text": "Полный текст ТЗ...",\n  "max_length": 500  // опционально\n}',
        response: '{\n  "summary": "Краткая выжимка...",\n  "key_points": ["Пункт 1", "Пункт 2"]\n}' },
      { method: "POST", path: "/api/ai/translate/", desc: "Перевести текст на другой язык с автоопределением исходного", auth: "API Key",
        request: '{\n  "text": "Текст для перевода",\n  "source_lang": "auto",\n  "target_lang": "en"\n}',
        response: '{\n  "translated_text": "Translation...",\n  "detected_language": "Russian"\n}' },
      { method: "POST", path: "/api/ai/estimate/", desc: "Попросить ИИ оценить сложность задачи и предложить разбивку на подзадачи", auth: "API Key",
        request: '{\n  "title": "API Development",\n  "description": "REST API with JWT authentication",\n  "context": "Проект на Node.js"  // опционально\n}',
        response: '{\n  "complexity": "low | medium | high | critical",\n  "estimated_hours": 24,\n  "reasoning": "Обоснование...",\n  "suggested_subtasks": ["Подзадача 1", "..."]\n}' },
      { method: "POST", path: "/api/ai/autopilot", desc: "Загрузить ТЗ и получить готовый план проекта с фазами, задачами и зависимостями", auth: "API Key",
        request: '{\n  "text": "Полное техническое задание...",\n  "project_title": "Название"  // опционально\n}',
        response: '{\n  "project_title": "...",\n  "project_description": "...",\n  "phases": [{ "name": "Аналитика", "order": 1 }],\n  "tasks": [\n    {\n      "title": "Задача",\n      "priority": "HIGH",\n      "estimated_hours": 16,\n      "phase": "Аналитика",\n      "dependencies": ["Другая задача"]\n    }\n  ],\n  "total_estimated_hours": 240,\n  "estimated_weeks": 6,\n  "risks": ["Риск 1"],\n  "tech_stack_suggestions": ["React - причина"]\n}' },
      { method: "POST", path: "/api/ai/analytics", desc: "Узнать здоровье проекта, скорость команды и прогноз по дедлайну", auth: "API Key",
        request: '{\n  "project_title": "Проект",\n  "tasks": [{ "title": "...", "status": "DONE", "estimated_hours": 8, "actual_hours": 12 }],\n  "deadline": "2026-06-01"\n}',
        response: '{\n  "health_score": 75,\n  "insights": [{ "type": "warning", "title": "...", "description": "..." }],\n  "velocity": { "tasks_per_week": 4.5, "trend": "stable" },\n  "deadline_prediction": { "on_track": true, "predicted_completion": "2026-05-20" }\n}' },
      { method: "POST", path: "/api/ai/weekly-report", desc: "Сгенерировать еженедельный отчёт — что сделано, что в работе, какие риски", auth: "API Key",
        request: '{\n  "project_title": "...",\n  "tasks": [...],\n  "period_start": "2026-03-20",\n  "period_end": "2026-03-27"\n}',
        response: '{\n  "summary": "Резюме недели...",\n  "completed_tasks": ["Task 1"],\n  "in_progress": ["Задача 2"],\n  "risks": [{ "title": "Риск", "mitigation": "Решение" }],\n  "metrics": { "progress_percent": 67 }\n}' },
      { method: "POST", path: "/api/ai/risk-matrix", desc: "Построить матрицу рисков проекта и получить рекомендации по снижению", auth: "API Key",
        request: '{\n  "project_title": "...",\n  "tasks": [...]\n}',
        response: '{\n  "risks": [{ "title": "...", "probability": "high", "impact": "high", "category": "schedule", "mitigation": "..." }],\n  "overall_risk_level": "medium",\n  "summary": "Общая оценка..."\n}' },
    ],
  },
];

const methodColors: Record<string, string> = {
  GET: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  POST: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  PATCH: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  DELETE: "bg-red-500/15 text-red-700 dark:text-red-400",
};

function EndpointDetail({ ep }: { ep: Endpoint }) {
  const [open, setOpen] = useState(false);
  const { t } = useLocale();
  return (
    <div className="border rounded-lg overflow-hidden">
      <div
        className="flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-accent/50 transition-colors overflow-x-auto"
        onClick={() => setOpen(!open)}
      >
        {open ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
        <Badge className={`text-[10px] font-mono w-16 justify-center shrink-0 ${methodColors[ep.method] || ""}`}>
          {ep.method}
        </Badge>
        <code className="text-xs font-mono truncate min-w-0">{ep.path}</code>
        <span className="text-xs text-muted-foreground ml-auto shrink-0 hidden sm:block">{ep.auth}</span>
      </div>
      {open && (
        <div className="px-4 pb-3 pt-1 border-t bg-muted/30 space-y-3">
          <p className="text-sm">{t(ep.desc)}</p>
          <div className="flex items-center gap-2 text-xs">
            <Badge variant="outline" className="text-[10px]">{t('api.authorization')}: {ep.auth}</Badge>
            {ep.params && <span className="text-muted-foreground">{t('api.params')}: <code>{ep.params}</code></span>}
          </div>
          {ep.request && (
            <div>
              <p className="text-xs font-medium mb-1 text-muted-foreground">Request Body:</p>
              <pre className="text-xs bg-background border rounded p-2.5 overflow-x-auto whitespace-pre">{ep.request}</pre>
            </div>
          )}
          {ep.response && (
            <div>
              <p className="text-xs font-medium mb-1 text-muted-foreground">Response:</p>
              <pre className="text-xs bg-background border rounded p-2.5 overflow-x-auto whitespace-pre">{ep.response}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ApiDocumentation() {
  const { t } = useLocale();
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">{t('api.docs_title')}</h2>
      <p className="text-sm text-muted-foreground">
        {t('api.docs_subtitle')}
      </p>
      {API_DOCS.map((section) => (
        <Card key={section.sectionKey}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t(section.sectionKey)}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {section.endpoints.map((ep, i) => (
              <EndpointDetail key={i} ep={ep} />
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function ApiDocsPage() {
  const { t } = useLocale();
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyExpiry, setNewKeyExpiry] = useState("never");
  const [creating, setCreating] = useState(false);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await api.get<{ keys: ApiKeyItem[] }>("/api/auth/api-keys");
        if (data?.keys) setKeys(data.keys);
      } catch {}
      setLoading(false);
    };
    load();
  }, []);

  const handleCreateKey = async () => {
    if (!newKeyName.trim()) return;
    setCreating(true);
    try {
      const expiresIn = newKeyExpiry === "never" ? undefined : parseInt(newKeyExpiry);
      const data = await api.post<NewKeyResponse>("/api/auth/api-keys", {
        name: newKeyName,
        expiresIn,
      });
      setCreatedKey(data.key);
      setKeys((prev) => [
        {
          id: data.id,
          name: data.name,
          prefix: data.prefix,
          lastUsedAt: null,
          expiresAt: data.expiresAt,
          createdAt: data.createdAt,
        },
        ...prev,
      ]);
      setNewKeyName("");
    } catch {}
    setCreating(false);
  };

  const handleDeleteKey = async (id: string) => {
    if (!confirm(t('api_keys.delete_confirm'))) return;
    try {
      await api.delete(`/api/auth/api-keys/${id}`);
      setKeys((prev) => prev.filter((k) => k.id !== id));
    } catch {}
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 text-white">
          <Book className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('api.title')}</h1>
          <p className="text-sm text-muted-foreground">
            {t('api.subtitle')}
          </p>
        </div>
      </div>

      {/* Auth info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4" />
            {t('api.auth_title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-muted-foreground">{t('api.auth_methods')}</p>
          <div className="grid gap-3 grid-cols-1">
            <div className="rounded-lg border p-3 space-y-1.5">
              <p className="font-medium">API Key</p>
              <code className="block text-xs bg-muted px-2 py-1 rounded overflow-x-auto">
                X-API-Key: sk_live_abc123...
              </code>
              <p className="text-xs text-muted-foreground">{t('api.apikey_desc')}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* API Keys management */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Key className="h-4 w-4" />
              {t('api.keys_title')}
            </CardTitle>
            <Button size="sm" className="gap-1.5" onClick={() => { setCreateOpen(true); setCreatedKey(null); setShowKey(false); }}>
              <Plus className="h-3.5 w-3.5" />
              {t('api.create_key')}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
          ) : keys.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              {t('api.no_keys')}
            </p>
          ) : (
            <div className="space-y-2">
              {keys.map((key) => (
                <div key={key.id} className="flex items-start sm:items-center gap-3 p-3 rounded-lg border">
                  <Key className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5 sm:mt-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{key.name}</p>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-xs text-muted-foreground">
                      <code>{key.prefix}</code>
                      <span>{t('api.created_label')}: {formatDate(key.createdAt, t('api.never'))}</span>
                      {key.lastUsedAt && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDate(key.lastUsedAt, t('api.never'))}
                        </span>
                      )}
                      {key.expiresAt && (
                        <Badge variant="outline" className="text-[10px]">
                          {t('api.expires_label')}: {formatDate(key.expiresAt, t('api.never'))}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive shrink-0" onClick={() => handleDeleteKey(key.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* API Documentation */}
      <ApiDocumentation />

      {/* Example */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('api.example')}</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="text-xs bg-muted p-4 rounded-lg overflow-x-auto whitespace-pre">
{`# Create a project
curl -X POST https://antihype.lol/api/projects/projects \\
  -H "X-API-Key: sk_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{"title": "My Project", "clientId": "..."}'

# Add a task
curl -X POST https://antihype.lol/api/projects/tasks \\
  -H "X-API-Key: sk_live_..." \\
  -H "Content-Type: application/json" \\
  -d '{"title": "Design UI", "projectId": "...", "priority": "HIGH"}'

# Get project status
curl https://antihype.lol/api/projects/projects/PROJECT_ID \\
  -H "X-API-Key: sk_live_..."`}
          </pre>
        </CardContent>
      </Card>

      {/* Create Key Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{createdKey ? t('api.key_created') : t('api.create_api_key')}</DialogTitle>
          </DialogHeader>
          {createdKey ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
                <p className="text-sm font-medium text-amber-700 dark:text-amber-400 mb-2">
                  {t('api.copy_warning')}
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs bg-muted px-3 py-2 rounded font-mono break-all">
                    {showKey ? createdKey : createdKey.slice(0, 16) + "●".repeat(32)}
                  </code>
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setShowKey(!showKey)}>
                    {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <CopyButton text={createdKey} />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t('api.key_name')}</Label>
                <Input
                  placeholder={t('api.key_name_placeholder')}
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('api.expiry')}</Label>
                <Select value={newKeyExpiry} onValueChange={setNewKeyExpiry}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="never">{t('api.no_expiry')}</SelectItem>
                    <SelectItem value="30">{t('api.days_30')}</SelectItem>
                    <SelectItem value="90">{t('api.days_90')}</SelectItem>
                    <SelectItem value="365">{t('api.year_1')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateOpen(false)}>{t('common.cancel')}</Button>
                <Button onClick={handleCreateKey} disabled={!newKeyName.trim() || creating}>
                  {creating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  {t('common.create')}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
