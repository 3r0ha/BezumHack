"use client";

import { useState } from "react";
import {
  Brain,
  FileText,
  Languages,
  ListChecks,
  Upload,
  Loader2,
  Sparkles,
  Copy,
  Check,
} from "lucide-react";

// --- Types ---

interface SummarizeResult {
  summary: string;
  key_points: string[];
}

interface TranslateResult {
  translated_text: string;
  detected_language: string;
}

interface EstimateResult {
  complexity: string;
  estimated_hours: number;
  reasoning: string;
  suggested_subtasks: string[];
}

// --- Mock data ---

const MOCK_SUMMARY: SummarizeResult = {
  summary:
    "Разработка мобильного приложения для сервиса доставки еды. Приложение должно поддерживать iOS и Android, включать систему отслеживания заказов в реальном времени, интеграцию с платёжными системами и push-уведомления.",
  key_points: [
    "Кроссплатформенная разработка (React Native)",
    "Интеграция с Stripe и ЮKassa для платежей",
    "WebSocket для отслеживания курьера в реальном времени",
    "Push-уведомления через Firebase",
    "Срок: 3 месяца, бюджет: 2.5 млн руб",
    "MVP к 15 апреля — только заказ и оплата",
  ],
};

const MOCK_TRANSLATE: TranslateResult = {
  translated_text:
    "We need to develop a mobile application for a food delivery service with real-time order tracking.",
  detected_language: "Russian",
};

const MOCK_ESTIMATE: EstimateResult = {
  complexity: "high",
  estimated_hours: 320,
  reasoning:
    "Проект включает кроссплатформенную мобильную разработку, интеграцию с несколькими внешними сервисами (платежи, карты, уведомления), real-time функциональность через WebSocket, а также серверную часть с API.",
  suggested_subtasks: [
    "Настройка проекта React Native + навигация",
    "Экран авторизации и регистрации",
    "Каталог ресторанов и меню",
    "Корзина и оформление заказа",
    "Интеграция платёжных систем",
    "Real-time отслеживание курьера на карте",
    "Push-уведомления",
    "Админ-панель для ресторанов",
    "API: заказы, пользователи, рестораны",
    "Тестирование и деплой",
  ],
};

// --- Components ---

const complexityColors: Record<string, string> = {
  low: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  medium:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  critical: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

const complexityLabels: Record<string, string> = {
  low: "Низкая",
  medium: "Средняя",
  high: "Высокая",
  critical: "Критическая",
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {copied ? "Скопировано" : "Копировать"}
    </button>
  );
}

export default function AIAssistantPage() {
  const [activeTab, setActiveTab] = useState<
    "summarize" | "translate" | "estimate"
  >("summarize");

  // Summarize state
  const [summarizeText, setSummarizeText] = useState("");
  const [summarizeResult, setSummarizeResult] =
    useState<SummarizeResult | null>(null);
  const [summarizeLoading, setSummarizeLoading] = useState(false);

  // Translate state
  const [translateText, setTranslateText] = useState("");
  const [targetLang, setTargetLang] = useState("en");
  const [translateResult, setTranslateResult] =
    useState<TranslateResult | null>(null);
  const [translateLoading, setTranslateLoading] = useState(false);

  // Estimate state
  const [estimateTitle, setEstimateTitle] = useState("");
  const [estimateDesc, setEstimateDesc] = useState("");
  const [estimateResult, setEstimateResult] = useState<EstimateResult | null>(
    null,
  );
  const [estimateLoading, setEstimateLoading] = useState(false);

  const handleSummarize = async () => {
    if (!summarizeText.trim()) return;
    setSummarizeLoading(true);
    setSummarizeResult(null);
    try {
      const res = await fetch("/api/ai/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: summarizeText }),
      });
      if (res.ok) {
        setSummarizeResult(await res.json());
      } else {
        throw new Error();
      }
    } catch {
      // Fallback to mock
      await new Promise((r) => setTimeout(r, 1500));
      setSummarizeResult(MOCK_SUMMARY);
    } finally {
      setSummarizeLoading(false);
    }
  };

  const handleTranslate = async () => {
    if (!translateText.trim()) return;
    setTranslateLoading(true);
    setTranslateResult(null);
    try {
      const res = await fetch("/api/ai/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: translateText,
          target_lang: targetLang,
        }),
      });
      if (res.ok) {
        setTranslateResult(await res.json());
      } else {
        throw new Error();
      }
    } catch {
      await new Promise((r) => setTimeout(r, 1000));
      setTranslateResult(MOCK_TRANSLATE);
    } finally {
      setTranslateLoading(false);
    }
  };

  const handleEstimate = async () => {
    if (!estimateTitle.trim()) return;
    setEstimateLoading(true);
    setEstimateResult(null);
    try {
      const res = await fetch("/api/ai/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: estimateTitle,
          description: estimateDesc,
        }),
      });
      if (res.ok) {
        setEstimateResult(await res.json());
      } else {
        throw new Error();
      }
    } catch {
      await new Promise((r) => setTimeout(r, 2000));
      setEstimateResult(MOCK_ESTIMATE);
    } finally {
      setEstimateLoading(false);
    }
  };

  const tabs = [
    {
      id: "summarize" as const,
      label: "Суммаризация ТЗ",
      icon: FileText,
    },
    { id: "translate" as const, label: "Переводчик", icon: Languages },
    {
      id: "estimate" as const,
      label: "Оценка задачи",
      icon: ListChecks,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 text-white">
            <Brain className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">AI Ассистент</h1>
            <p className="text-sm text-muted-foreground">
              Инструменты на базе нейросети для ускорения работы
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-muted p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 rounded-md px-4 py-2.5 text-sm font-medium transition-all ${
              activeTab === tab.id
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Summarize Tab */}
      {activeTab === "summarize" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4">
            <div className="rounded-lg border bg-card p-6">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Текст ТЗ
              </h3>
              <textarea
                value={summarizeText}
                onChange={(e) => setSummarizeText(e.target.value)}
                placeholder="Вставьте текст технического задания..."
                className="flex min-h-[240px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
              />
              <div className="flex items-center gap-3 mt-4">
                <button
                  onClick={handleSummarize}
                  disabled={summarizeLoading || !summarizeText.trim()}
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:pointer-events-none transition-colors"
                >
                  {summarizeLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  Суммаризировать
                </button>
                <label className="inline-flex items-center gap-2 rounded-md border px-4 py-2.5 text-sm font-medium hover:bg-accent cursor-pointer transition-colors">
                  <Upload className="h-4 w-4" />
                  Загрузить файл
                  <input type="file" className="hidden" accept=".txt,.pdf,.doc,.docx" />
                </label>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {summarizeLoading && (
              <div className="rounded-lg border bg-card p-6 animate-pulse">
                <div className="h-4 bg-muted rounded w-1/3 mb-4" />
                <div className="space-y-2">
                  <div className="h-3 bg-muted rounded w-full" />
                  <div className="h-3 bg-muted rounded w-5/6" />
                  <div className="h-3 bg-muted rounded w-4/6" />
                </div>
                <div className="h-4 bg-muted rounded w-1/4 mt-6 mb-3" />
                <div className="space-y-2">
                  <div className="h-3 bg-muted rounded w-3/4" />
                  <div className="h-3 bg-muted rounded w-2/3" />
                  <div className="h-3 bg-muted rounded w-4/5" />
                </div>
              </div>
            )}

            {summarizeResult && (
              <div className="rounded-lg border bg-card p-6 animate-in fade-in slide-in-from-right-4 duration-300">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-violet-500" />
                    Краткая выжимка
                  </h3>
                  <CopyButton text={summarizeResult.summary} />
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                  {summarizeResult.summary}
                </p>
                <h4 className="font-medium text-sm mb-2">Ключевые пункты:</h4>
                <ul className="space-y-1.5">
                  {summarizeResult.key_points.map((point, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 text-sm text-muted-foreground"
                    >
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-700 text-xs font-medium dark:bg-violet-900/30 dark:text-violet-400">
                        {i + 1}
                      </span>
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {!summarizeResult && !summarizeLoading && (
              <div className="rounded-lg border border-dashed bg-card/50 p-12 text-center">
                <FileText className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground">
                  Вставьте ТЗ и нажмите &quot;Суммаризировать&quot;
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Translate Tab */}
      {activeTab === "translate" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-lg border bg-card p-6 space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Languages className="h-4 w-4" />
              Исходный текст
            </h3>
            <textarea
              value={translateText}
              onChange={(e) => setTranslateText(e.target.value)}
              placeholder="Введите текст для перевода..."
              className="flex min-h-[180px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
            />
            <div className="flex items-center gap-3">
              <select
                value={targetLang}
                onChange={(e) => setTargetLang(e.target.value)}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="en">English</option>
                <option value="ru">Русский</option>
                <option value="de">Deutsch</option>
                <option value="fr">Francais</option>
                <option value="es">Espanol</option>
                <option value="zh">中文</option>
                <option value="ja">日本語</option>
              </select>
              <button
                onClick={handleTranslate}
                disabled={translateLoading || !translateText.trim()}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:pointer-events-none transition-colors"
              >
                {translateLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Languages className="h-4 w-4" />
                )}
                Перевести
              </button>
            </div>
          </div>

          <div className="rounded-lg border bg-card p-6">
            {translateLoading && (
              <div className="animate-pulse space-y-3">
                <div className="h-4 bg-muted rounded w-1/4" />
                <div className="h-3 bg-muted rounded w-full" />
                <div className="h-3 bg-muted rounded w-4/5" />
              </div>
            )}
            {translateResult && (
              <div className="animate-in fade-in duration-300">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold">Перевод</h3>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">
                      Определён язык: {translateResult.detected_language}
                    </span>
                    <CopyButton text={translateResult.translated_text} />
                  </div>
                </div>
                <p className="text-sm leading-relaxed">
                  {translateResult.translated_text}
                </p>
              </div>
            )}
            {!translateResult && !translateLoading && (
              <div className="flex flex-col items-center justify-center h-full min-h-[180px] text-center">
                <Languages className="h-10 w-10 text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground">
                  Результат перевода появится здесь
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Estimate Tab */}
      {activeTab === "estimate" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-lg border bg-card p-6 space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <ListChecks className="h-4 w-4" />
              Описание задачи
            </h3>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  Название задачи
                </label>
                <input
                  value={estimateTitle}
                  onChange={(e) => setEstimateTitle(e.target.value)}
                  placeholder="Например: Разработка мобильного приложения"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">
                  Описание
                </label>
                <textarea
                  value={estimateDesc}
                  onChange={(e) => setEstimateDesc(e.target.value)}
                  placeholder="Опишите задачу подробнее..."
                  className="flex min-h-[140px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                />
              </div>
            </div>
            <button
              onClick={handleEstimate}
              disabled={estimateLoading || !estimateTitle.trim()}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:pointer-events-none transition-colors"
            >
              {estimateLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Brain className="h-4 w-4" />
              )}
              Оценить сложность
            </button>
          </div>

          <div className="space-y-4">
            {estimateLoading && (
              <div className="rounded-lg border bg-card p-6 animate-pulse space-y-4">
                <div className="h-5 bg-muted rounded w-1/3" />
                <div className="flex gap-4">
                  <div className="h-16 bg-muted rounded flex-1" />
                  <div className="h-16 bg-muted rounded flex-1" />
                </div>
                <div className="h-3 bg-muted rounded w-full" />
                <div className="h-3 bg-muted rounded w-4/5" />
                <div className="h-4 bg-muted rounded w-1/4 mt-2" />
                <div className="space-y-2">
                  <div className="h-3 bg-muted rounded w-3/4" />
                  <div className="h-3 bg-muted rounded w-2/3" />
                </div>
              </div>
            )}

            {estimateResult && (
              <div className="rounded-lg border bg-card p-6 animate-in fade-in slide-in-from-right-4 duration-300 space-y-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <Brain className="h-4 w-4 text-violet-500" />
                  Результат оценки
                </h3>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border p-4">
                    <p className="text-xs text-muted-foreground mb-1">
                      Сложность
                    </p>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${complexityColors[estimateResult.complexity] || ""}`}
                    >
                      {complexityLabels[estimateResult.complexity] ||
                        estimateResult.complexity}
                    </span>
                  </div>
                  <div className="rounded-lg border p-4">
                    <p className="text-xs text-muted-foreground mb-1">
                      Оценка времени
                    </p>
                    <p className="text-lg font-bold">
                      {estimateResult.estimated_hours}ч
                    </p>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium text-sm mb-1.5">Обоснование:</h4>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {estimateResult.reasoning}
                  </p>
                </div>

                <div>
                  <h4 className="font-medium text-sm mb-2">
                    Предложенные подзадачи:
                  </h4>
                  <ul className="space-y-1.5">
                    {estimateResult.suggested_subtasks.map((task, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-muted text-xs font-medium">
                          {i + 1}
                        </span>
                        <span className="text-muted-foreground">{task}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <button className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium hover:bg-accent transition-colors">
                  <ListChecks className="h-4 w-4" />
                  Создать задачи в проекте
                </button>
              </div>
            )}

            {!estimateResult && !estimateLoading && (
              <div className="rounded-lg border border-dashed bg-card/50 p-12 text-center">
                <Brain className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground">
                  Опишите задачу, и AI оценит её сложность
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
