"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { ArrowRight, Zap } from "lucide-react";

/* ================================================================
   TYPEWRITER TEXT
   ================================================================ */
function TypewriterText({ text, speed = 40 }: { text: string; speed?: number }) {
  const [displayed, setDisplayed] = useState("");
  const idx = useRef(0);

  useEffect(() => {
    idx.current = 0;
    setDisplayed("");
    const interval = setInterval(() => {
      idx.current += 1;
      setDisplayed(text.slice(0, idx.current));
      if (idx.current >= text.length) clearInterval(interval);
    }, speed);
    return () => clearInterval(interval);
  }, [text, speed]);

  return (
    <span className="text-sm text-zinc-300">
      {displayed}
      <span className="inline-block w-[2px] h-3.5 bg-primary/70 ml-0.5 align-middle animate-pulse" />
    </span>
  );
}

/* ================================================================
   SECTION 1 — CHAT DEMO
   ================================================================ */
function ConvRow({ name, avatar, message, time, unread, isNew }: {
  name: string; avatar: string; message: string; time: string; unread?: number; isNew?: boolean;
}) {
  return (
    <div className={`flex items-center gap-3 px-4 py-3 transition-all duration-500 shrink-0 ${isNew ? "bg-zinc-800/30" : ""}`}>
      <div className={`h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${isNew ? "bg-primary/20 text-primary" : "bg-zinc-800 text-zinc-500"}`}>
        {avatar}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className={`text-sm truncate ${isNew ? "text-zinc-100 font-semibold" : "text-zinc-400 font-medium"}`}>{name}</p>
          <span className={`text-[10px] shrink-0 ${isNew ? "text-primary" : "text-zinc-600"}`}>{time}</span>
        </div>
        <p className={`text-xs truncate ${isNew ? "text-zinc-300" : "text-zinc-600"}`}>{message}</p>
      </div>
      {unread ? (
        <div className="h-5 min-w-[20px] rounded-full bg-primary flex items-center justify-center text-[10px] text-white font-bold shrink-0 px-1">
          {unread}
        </div>
      ) : null}
    </div>
  );
}

function ChatDemo() {
  const [step, setStep] = useState(0);
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    // step 0: initial (static chats visible)
    // step 1: Заказчик appears at top (1.5s)
    // step 2: Бывшая "спишь?" appears at top (3s)
    // step 3: Бывшая updates to "нужно поговорить" (4.5s)
    // step 4: hold (7.5s) then reset
    const timers = [
      setTimeout(() => setStep(1), 1500),
      setTimeout(() => setStep(2), 3000),
      setTimeout(() => setStep(3), 4500),
      setTimeout(() => { setStep(0); setCycle(c => c + 1); }, 9000),
    ];
    return () => timers.forEach(clearTimeout);
  }, [cycle]);

  const staticChats = [
    { name: "Команда Backend", avatar: "KB", message: "API готов, можно тестить", time: "15 мин" },
    { name: "Дизайнер", avatar: "Д", message: "Скинул макеты в Figma", time: "1 час" },
    { name: "PM Алексей", avatar: "А", message: "Стендап в 11:00", time: "2 часа" },
  ];

  const newChats: { name: string; avatar: string; message: string; time: string; unread: number }[] = [];

  if (step >= 3) {
    newChats.push({ name: "Бывшая", avatar: "Б", message: "нужно поговорить", time: "сейчас", unread: 2 });
  } else if (step >= 2) {
    newChats.push({ name: "Бывшая", avatar: "Б", message: "спишь?", time: "сейчас", unread: 1 });
  }

  if (step >= 1) {
    newChats.push({ name: "Заказчик", avatar: "З", message: "здарова надоел", time: step >= 2 ? "1 мин" : "сейчас", unread: 1 });
  }

  return (
    <div className="w-full max-w-[320px] mx-auto">
      <div className="bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-sm text-zinc-300 font-medium">Чаты</span>
          </div>
          <div className="h-7 w-7 rounded-lg bg-zinc-800 flex items-center justify-center">
            <span className="text-xs text-zinc-400">+</span>
          </div>
        </div>
        {/* Search */}
        <div className="px-4 py-2 border-b border-zinc-800/50">
          <div className="bg-zinc-800/50 rounded-lg px-3 py-1.5 text-xs text-zinc-600">Поиск...</div>
        </div>
        {/* Conversation list */}
        <div className="h-[280px] flex flex-col overflow-hidden">
          {newChats.map((c, i) => (
            <div key={`${c.name}-${step}-${i}`} className="animate-slide-down">
              <ConvRow {...c} isNew />
            </div>
          ))}
          {staticChats.map((c) => (
            <ConvRow key={c.name} {...c} />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   SECTION 2 — AUTOPILOT DEMO
   ================================================================ */
function AutopilotDemo() {
  const [phase, setPhase] = useState<"typing" | "result">("typing");
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("result"), 2500);
    const t2 = setTimeout(() => {
      setPhase("typing");
      setCycle((c) => c + 1);
    }, 8000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [cycle]);

  const tasks = [
    "Аналитика · 24ч",
    "Дизайн UI/UX · 40ч",
    "Backend API · 80ч",
    "Frontend · 60ч",
    "Тестирование · 32ч",
  ];

  return (
    <div className="w-full max-w-[320px] mx-auto bg-zinc-900 rounded-2xl border border-zinc-800 p-4 shadow-2xl">
      {phase === "typing" ? (
        <div key={`typing-${cycle}`} className="space-y-3">
          <div className="text-xs text-zinc-500">Техническое задание</div>
          <div className="bg-zinc-800 rounded-lg p-3 h-24 overflow-hidden">
            <TypewriterText text="Разработать CRM систему для отдела продаж с интеграцией телефонии..." />
          </div>
          <div className="h-9 rounded-lg bg-primary/20 animate-pulse flex items-center justify-center text-xs text-primary">
            AI анализирует...
          </div>
        </div>
      ) : (
        <div key={`result-${cycle}`} className="space-y-2">
          <div className="text-xs text-zinc-500 mb-2">Сгенерированный план</div>
          {tasks.map((task, i) => (
            <div
              key={i}
              className="bg-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-300 opacity-0"
              style={{
                animation: "demo-fade-in 0.4s ease-out forwards",
                animationDelay: `${i * 300}ms`,
              }}
            >
              {task}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ================================================================
   SECTION 3 — KANBAN DEMO
   ================================================================ */
function KanbanDemo() {
  const [step, setStep] = useState(0); // 0 = in todo, 1 = in progress, 2 = done
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setStep(1), 1500);
    const t2 = setTimeout(() => setStep(2), 3500);
    const t3 = setTimeout(() => {
      setStep(0);
      setCycle((c) => c + 1);
    }, 6500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [cycle]);

  const columns = [
    { title: "To Do", color: "bg-zinc-500" },
    { title: "In Progress", color: "bg-amber-500" },
    { title: "Done", color: "bg-emerald-500" },
  ];

  const taskCard = (
    <div className="bg-zinc-800 border border-zinc-700 rounded-lg p-2 text-xs text-zinc-300 transition-all duration-500">
      <div className="font-medium mb-1">Интеграция API</div>
      <div className="flex items-center gap-1">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500 inline-block" />
        <span className="text-zinc-500 text-[10px]">Высокий</span>
      </div>
    </div>
  );

  const staticCards = [
    <div key="s1" className="bg-zinc-800/60 border border-zinc-700/50 rounded-lg p-2 text-xs text-zinc-500">
      <div className="font-medium mb-1">Дизайн UI</div>
      <div className="text-[10px]">Средний</div>
    </div>,
    <div key="s2" className="bg-zinc-800/60 border border-zinc-700/50 rounded-lg p-2 text-xs text-zinc-500">
      <div className="font-medium mb-1">Тесты</div>
      <div className="text-[10px]">Низкий</div>
    </div>,
  ];

  return (
    <div className="w-full max-w-[340px] mx-auto bg-zinc-900 rounded-2xl border border-zinc-800 p-3 shadow-2xl">
      <div className="grid grid-cols-3 gap-2">
        {columns.map((col, colIdx) => (
          <div key={col.title} className="space-y-2">
            <div className="flex items-center gap-1.5 mb-2">
              <div className={`h-2 w-2 rounded-full ${col.color}`} />
              <span className="text-[10px] text-zinc-400 font-medium">{col.title}</span>
            </div>
            {/* Moving task card */}
            {step === colIdx && (
              <div
                className="opacity-0"
                style={{
                  animation: "demo-fade-in 0.4s ease-out forwards",
                }}
              >
                {taskCard}
              </div>
            )}
            {/* Static placeholder cards in first column */}
            {colIdx === 0 && staticCards}
            {/* Static done card */}
            {colIdx === 2 && (
              <div className="bg-zinc-800/60 border border-zinc-700/50 rounded-lg p-2 text-xs text-zinc-500">
                <div className="font-medium mb-1 line-through">Авториз.</div>
                <div className="text-[10px]">Готово</div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ================================================================
   SECTION 4 — WHITEBOARD DEMO
   ================================================================ */
function WhiteboardDemo() {
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setCycle((c) => c + 1), 8000);
    return () => clearInterval(timer);
  }, []);

  const notes = [
    { text: "Идея", color: "bg-amber-500/20 border-amber-500/40 text-amber-300", x: "10%", y: "15%", delay: 0 },
    { text: "MVP", color: "bg-emerald-500/20 border-emerald-500/40 text-emerald-300", x: "55%", y: "10%", delay: 600 },
    { text: "UX", color: "bg-pink-500/20 border-pink-500/40 text-pink-300", x: "25%", y: "55%", delay: 1200 },
    { text: "Launch", color: "bg-blue-500/20 border-blue-500/40 text-blue-300", x: "65%", y: "55%", delay: 1800 },
  ];

  return (
    <div key={cycle} className="w-full max-w-[320px] mx-auto bg-zinc-900 rounded-2xl border border-zinc-800 shadow-2xl overflow-hidden">
      {/* Toolbar */}
      <div className="px-3 py-2 border-b border-zinc-800 flex items-center gap-2">
        <div className="flex gap-1">
          {["bg-zinc-600", "bg-primary/50", "bg-emerald-500/50"].map((c, i) => (
            <div key={i} className={`h-5 w-5 rounded ${c} border border-zinc-700`} />
          ))}
        </div>
        <span className="text-[10px] text-zinc-500 ml-auto">Whiteboard</span>
      </div>
      {/* Canvas */}
      <div className="relative h-[240px] p-2">
        {/* Grid dots */}
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: "radial-gradient(circle, rgb(113 113 122) 1px, transparent 1px)",
            backgroundSize: "20px 20px",
          }}
        />
        {/* Sticky notes */}
        {notes.map((note, i) => (
          <div
            key={i}
            className={`absolute border rounded-lg px-2 py-1.5 text-xs font-medium opacity-0 ${note.color}`}
            style={{
              left: note.x,
              top: note.y,
              animation: "demo-fade-in 0.5s ease-out forwards",
              animationDelay: `${note.delay}ms`,
            }}
          >
            {note.text}
          </div>
        ))}
        {/* SVG connecting lines */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" xmlns="http://www.w3.org/2000/svg">
          <line
            x1="22%" y1="26%" x2="57%" y2="22%"
            stroke="rgb(161 161 170)" strokeWidth="1" strokeDasharray="200" strokeDashoffset="200"
            style={{ animation: "draw-line 1s ease-out forwards", animationDelay: "2400ms" }}
          />
          <line
            x1="33%" y1="66%" x2="67%" y2="66%"
            stroke="rgb(161 161 170)" strokeWidth="1" strokeDasharray="200" strokeDashoffset="200"
            style={{ animation: "draw-line 1s ease-out forwards", animationDelay: "2800ms" }}
          />
          <line
            x1="60%" y1="25%" x2="70%" y2="55%"
            stroke="rgb(161 161 170)" strokeWidth="1" strokeDasharray="200" strokeDashoffset="200"
            style={{ animation: "draw-line 1s ease-out forwards", animationDelay: "3200ms" }}
          />
        </svg>
        {/* Cursor */}
        <div
          className="absolute w-3 h-3"
          style={{
            animation: "cursor-move 5s ease-in-out infinite",
            animationDelay: "1s",
          }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M1 1l4 10 1.5-4L11 5.5 1 1z" fill="white" stroke="black" strokeWidth="0.5" />
          </svg>
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   SECTION 5 — ANALYTICS DEMO
   ================================================================ */
function AnalyticsDemo() {
  const [score, setScore] = useState(0);
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    setScore(0);
    let current = 0;
    const interval = setInterval(() => {
      current += 1;
      if (current > 87) {
        clearInterval(interval);
        return;
      }
      setScore(current);
    }, 25);

    const reset = setTimeout(() => {
      setCycle((c) => c + 1);
    }, 8000);

    return () => {
      clearInterval(interval);
      clearTimeout(reset);
    };
  }, [cycle]);

  const insights = [
    { label: "Sprint Velocity", value: "+12%", delay: 1200 },
    { label: "Прогноз: в срок", value: "94%", delay: 1600 },
    { label: "Блокеров", value: "2", delay: 2000 },
  ];

  return (
    <div key={cycle} className="w-full max-w-[320px] mx-auto bg-zinc-900 rounded-2xl border border-zinc-800 p-4 shadow-2xl">
      {/* Health Score */}
      <div className="text-center mb-4">
        <div className="text-xs text-zinc-500 mb-2">Здоровье проекта</div>
        <div className="text-5xl font-bold text-emerald-400 tabular-nums">{score}</div>
        <div className="text-xs text-zinc-500 mt-1">из 100</div>
      </div>
      {/* Progress bar */}
      <div className="mb-4">
        <div className="flex justify-between text-[10px] text-zinc-500 mb-1">
          <span>Прогресс спринта</span>
          <span>73%</span>
        </div>
        <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary to-purple-500 rounded-full"
            style={{
              width: "0%",
              animation: "count-bar 2s ease-out forwards",
              animationDelay: "500ms",
              ["--bar-width" as string]: "73%",
            }}
          />
        </div>
      </div>
      {/* Insight cards */}
      <div className="space-y-2">
        {insights.map((item, i) => (
          <div
            key={i}
            className="flex items-center justify-between bg-zinc-800 rounded-lg px-3 py-2 opacity-0"
            style={{
              animation: "demo-fade-in 0.4s ease-out forwards",
              animationDelay: `${item.delay}ms`,
            }}
          >
            <span className="text-xs text-zinc-400">{item.label}</span>
            <span className="text-xs font-semibold text-zinc-200">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ================================================================
   SECTION 6 — BILLING DEMO
   ================================================================ */
function BillingDemo() {
  const [amount, setAmount] = useState(0);
  const [cycle, setCycle] = useState(0);
  const target = 384000;

  useEffect(() => {
    setAmount(0);
    let current = 0;
    const step = target / 60;
    const interval = setInterval(() => {
      current += step;
      if (current >= target) {
        current = target;
        clearInterval(interval);
      }
      setAmount(Math.round(current));
    }, 30);

    const reset = setTimeout(() => {
      setCycle((c) => c + 1);
    }, 7000);

    return () => {
      clearInterval(interval);
      clearTimeout(reset);
    };
  }, [cycle]);

  const lines = [
    { desc: "Backend разработка", hrs: "80ч", amount: "240 000" },
    { desc: "Frontend", hrs: "60ч", amount: "108 000" },
    { desc: "QA", hrs: "24ч", amount: "36 000" },
  ];

  return (
    <div key={cycle} className="w-full max-w-[320px] mx-auto bg-zinc-900 rounded-2xl border border-zinc-800 p-4 shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-xs text-zinc-500">Счёт #2024-037</div>
          <div className="text-sm text-zinc-300 font-medium mt-0.5">ООО "Клиент"</div>
        </div>
        <div className="bg-emerald-500/20 text-emerald-400 text-[10px] font-medium px-2 py-0.5 rounded-full">
          Готов
        </div>
      </div>
      {/* Line items */}
      <div className="space-y-1.5 mb-4">
        {lines.map((line, i) => (
          <div
            key={i}
            className="flex items-center justify-between text-xs opacity-0"
            style={{
              animation: "demo-fade-in 0.4s ease-out forwards",
              animationDelay: `${i * 400}ms`,
            }}
          >
            <span className="text-zinc-400">
              {line.desc} <span className="text-zinc-600">({line.hrs})</span>
            </span>
            <span className="text-zinc-300">{line.amount} ₽</span>
          </div>
        ))}
      </div>
      {/* Divider */}
      <div className="border-t border-zinc-800 pt-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-zinc-400 font-medium">Итого</span>
          <span className="text-lg font-bold text-zinc-100 tabular-nums">
            {amount.toLocaleString("ru-RU")} ₽
          </span>
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   SECTION 7 — GANTT DEMO
   ================================================================ */
function GanttDemo() {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setProgress(p => p >= 100 ? 0 : p + 1), 80);
    return () => clearInterval(t);
  }, []);

  const tasks = [
    { name: "Аналитика", start: 0, width: 20, color: "#22c55e", done: true },
    { name: "Дизайн", start: 15, width: 25, color: "#3b82f6", done: progress > 40 },
    { name: "Backend", start: 30, width: 35, color: "#f59e0b", done: false },
    { name: "Frontend", start: 45, width: 30, color: "#8b5cf6", done: false },
    { name: "Тесты", start: 70, width: 20, color: "#ef4444", done: false },
  ];

  return (
    <div className="w-full max-w-[360px] mx-auto bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden shadow-2xl p-4">
      <div className="text-xs text-zinc-500 mb-3 flex items-center justify-between">
        <span>Gantt · Проект</span>
        <span className="text-primary">{Math.min(progress, 100)}%</span>
      </div>
      <div className="space-y-2">
        {tasks.map((t) => (
          <div key={t.name} className="flex items-center gap-2">
            <span className="text-[10px] text-zinc-500 w-16 shrink-0 truncate">{t.name}</span>
            <div className="flex-1 h-5 bg-zinc-800 rounded relative overflow-hidden">
              <div
                className="h-full rounded transition-all duration-300"
                style={{
                  width: `${Math.min(Math.max(progress - t.start, 0), t.width) / t.width * 100}%`,
                  backgroundColor: t.color,
                  opacity: t.done ? 1 : 0.6,
                }}
              />
              {progress >= t.start && progress <= t.start + t.width && (
                <div className="absolute right-0 top-0 bottom-0 w-0.5 bg-white/80 animate-pulse" />
              )}
            </div>
          </div>
        ))}
      </div>
      {/* Today marker */}
      <div className="mt-3 flex items-center gap-1 text-[10px] text-zinc-600">
        <div className="h-px flex-1 bg-red-500/30" />
        <span className="text-red-400">сегодня</span>
        <div className="h-px flex-1 bg-red-500/30" />
      </div>
    </div>
  );
}

/* ================================================================
   SECTION 8 — APPROVALS DEMO
   ================================================================ */
function ApprovalsDemo() {
  const [step, setStep] = useState(0);
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setStep(1), 2000),
      setTimeout(() => setStep(2), 4000),
      setTimeout(() => { setStep(0); setCycle(c => c + 1); }, 8000),
    ];
    return () => timers.forEach(clearTimeout);
  }, [cycle]);

  return (
    <div className="w-full max-w-[320px] mx-auto bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden shadow-2xl p-4">
      <div className="text-xs text-zinc-500 mb-3">Согласования</div>
      <div className="space-y-2">
        <div className={`rounded-xl border p-3 transition-all duration-500 ${
          step >= 2 ? "border-emerald-500/30 bg-emerald-500/5" : step >= 1 ? "border-primary/30 bg-primary/5 animate-pulse" : "border-zinc-800 bg-zinc-800/50"
        }`}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-zinc-200">Дизайн главной</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${
              step >= 2 ? "bg-emerald-500/20 text-emerald-400" : step >= 1 ? "bg-amber-500/20 text-amber-400" : "bg-zinc-700 text-zinc-400"
            }`}>
              {step >= 2 ? "Одобрено ✓" : step >= 1 ? "На ревью..." : "Ожидает"}
            </span>
          </div>
          <p className="text-[11px] text-zinc-500">Запросил: Дизайнер · Заказчику</p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-800/50 p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-zinc-200">Бюджет Q2</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-700 text-zinc-400">Ожидает</span>
          </div>
          <p className="text-[11px] text-zinc-500">Запросил: PM · Заказчику</p>
        </div>
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-zinc-200">Смена стека</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">Отклонено</span>
          </div>
          <p className="text-[11px] text-zinc-500">Запросил: Техлид · Заказчику</p>
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   SECTION 9 — API/WEBHOOKS DEMO
   ================================================================ */
function ApiDemo() {
  const [line, setLine] = useState(0);
  const [cycle, setCycle] = useState(0);
  const lines = [
    '$ curl -X POST /api/projects',
    '  -H "X-API-Key: sk_live_..."',
    '  -d \'{"title": "Проект"}\'',
    '',
    '→ 201 Created',
    '  {"id": "a3f2...", "title": "Проект"}',
  ];

  useEffect(() => {
    if (line < lines.length) {
      const t = setTimeout(() => setLine(l => l + 1), 600);
      return () => clearTimeout(t);
    } else {
      const t = setTimeout(() => { setLine(0); setCycle(c => c + 1); }, 3000);
      return () => clearTimeout(t);
    }
  }, [line, cycle]);

  return (
    <div className="w-full max-w-[360px] mx-auto bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden shadow-2xl">
      <div className="px-4 py-2 border-b border-zinc-800 flex items-center gap-2">
        <div className="flex gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-red-500/60" />
          <div className="h-2.5 w-2.5 rounded-full bg-yellow-500/60" />
          <div className="h-2.5 w-2.5 rounded-full bg-green-500/60" />
        </div>
        <span className="text-[10px] text-zinc-600 ml-2">Terminal</span>
      </div>
      <div className="p-4 font-mono text-xs h-[180px]">
        {lines.slice(0, line).map((l, i) => (
          <div key={`${cycle}-${i}`} className={`animate-demo-fade-in ${l.startsWith('→') ? 'text-emerald-400' : l.startsWith('  {') ? 'text-amber-400' : 'text-zinc-400'}`}>
            {l || '\u00A0'}
          </div>
        ))}
        {line < lines.length && (
          <span className="inline-block w-2 h-4 bg-primary animate-pulse" />
        )}
      </div>
    </div>
  );
}

/* ================================================================
   SECTION 10 — MEET DEMO
   ================================================================ */
function MeetDemo() {
  const [step, setStep] = useState(0);
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setStep(1), 1500),
      setTimeout(() => setStep(2), 3000),
      setTimeout(() => { setStep(0); setCycle(c => c + 1); }, 7000),
    ];
    return () => timers.forEach(clearTimeout);
  }, [cycle]);

  return (
    <div className="w-full max-w-[340px] mx-auto bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden shadow-2xl">
      <div className="px-4 py-2 border-b border-zinc-800 flex items-center justify-between">
        <span className="text-xs text-zinc-400">Envelope Meet</span>
        <span className="text-[10px] text-emerald-400">● Live</span>
      </div>
      <div className="p-3">
        <div className="grid grid-cols-2 gap-2">
          {["Алексей", "Мария", ...(step >= 1 ? ["Заказчик"] : []), ...(step >= 2 ? ["Дизайнер"] : [])].map((name, i) => (
            <div key={name} className={`aspect-video rounded-xl bg-zinc-800 flex items-center justify-center transition-all duration-500 ${i === 0 ? "ring-2 ring-primary/30" : ""}`}
              style={i >= 2 ? { animation: "demo-fade-in 0.5s ease-out forwards" } : undefined}>
              <div className="text-center">
                <div className="h-10 w-10 rounded-full bg-primary/15 flex items-center justify-center text-sm text-primary font-bold mx-auto mb-1">
                  {name[0]}
                </div>
                <span className="text-[10px] text-zinc-500">{name}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="px-4 py-3 border-t border-zinc-800 flex items-center justify-center gap-3">
        <div className="h-8 w-8 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 text-xs">🎤</div>
        <div className="h-8 w-8 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 text-xs">📷</div>
        <div className="h-8 w-8 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 text-xs">🖥</div>
        <div className="h-8 w-8 rounded-full bg-red-500/80 flex items-center justify-center text-white text-xs">📞</div>
      </div>
    </div>
  );
}

/* ================================================================
   SECTION 11 — CLIENT PORTAL DEMO
   ================================================================ */
function PortalDemo() {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setProgress(p => p >= 67 ? 0 : p + 1), 60);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="w-full max-w-[320px] mx-auto bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden shadow-2xl p-4">
      <div className="text-xs text-zinc-500 mb-1">Портал клиента</div>
      <div className="text-sm text-zinc-200 font-medium mb-3">Мобильное приложение</div>
      {/* Progress */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-zinc-500">Прогресс</span>
          <span className="text-lg font-bold text-primary">{progress}%</span>
        </div>
        <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all duration-100" style={{ width: `${progress}%` }} />
        </div>
      </div>
      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-zinc-800/50 rounded-lg p-2 text-center">
          <div className="text-sm font-bold text-emerald-400">{Math.round(progress * 0.36)}</div>
          <div className="text-[9px] text-zinc-600">Готово</div>
        </div>
        <div className="bg-zinc-800/50 rounded-lg p-2 text-center">
          <div className="text-sm font-bold text-amber-400">{Math.round(progress * 0.12)}</div>
          <div className="text-[9px] text-zinc-600">В работе</div>
        </div>
        <div className="bg-zinc-800/50 rounded-lg p-2 text-center">
          <div className="text-sm font-bold text-zinc-400">{36 - Math.round(progress * 0.36) - Math.round(progress * 0.12)}</div>
          <div className="text-[9px] text-zinc-600">Ожидает</div>
        </div>
      </div>
      {/* Status bar */}
      <div className="mt-3 flex h-2 rounded-full overflow-hidden">
        <div className="bg-emerald-500 transition-all" style={{ width: `${progress * 0.54}%` }} />
        <div className="bg-amber-400 transition-all" style={{ width: `${progress * 0.18}%` }} />
        <div className="flex-1 bg-zinc-800" />
      </div>
    </div>
  );
}

/* ================================================================
   FEATURE SECTION WRAPPER
   ================================================================ */
function FeatureSection({
  reverse,
  title,
  description,
  cta,
  children,
}: {
  reverse?: boolean;
  title: string;
  description: string;
  cta?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true); else setVisible(false); },
      { threshold: 0.25 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <section ref={ref} className="min-h-screen flex items-center relative sm:snap-start sm:snap-always overflow-hidden py-24 lg:py-0 lg:h-screen">
      <div className="container mx-auto px-4 sm:px-6 w-full">
        <div
          className={`flex flex-col ${
            reverse ? "lg:flex-row-reverse" : "lg:flex-row"
          } items-center gap-10 lg:gap-16`}
        >
          {/* Text side */}
          <div className="flex-1 text-center lg:text-left max-w-lg w-full">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-foreground">
              {title}
            </h2>
            <p className="mt-4 text-base sm:text-lg text-muted-foreground leading-relaxed">
              {description}
            </p>
            {cta && (
              <div className="mt-6">
                <Link href="/login">
                  <Button size="lg" className="text-base px-6 h-11 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 border-0 text-white shadow-lg shadow-blue-500/25">
                    {cta}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            )}
          </div>
          {/* Demo side — only renders when visible, no scale on mobile */}
          <div className="flex-1 flex justify-center w-full lg:scale-125 origin-center">
            {visible ? children : <div className="w-full max-w-[320px] h-[280px]" />}
          </div>
        </div>
      </div>
      {/* Scroll hint — hidden on mobile to save space */}
      <div className="hidden lg:flex absolute bottom-6 left-1/2 -translate-x-1/2 flex-col items-center gap-1 opacity-40">
        <svg className="h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7" />
        </svg>
      </div>
    </section>
  );
}

/* ================================================================
   MAIN LANDING PAGE
   ================================================================ */
export default function LandingPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.replace("/dashboard");
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading || isAuthenticated) return null;

  return (
    <div data-landing className="h-screen bg-background overflow-y-auto overflow-x-hidden sm:snap-y sm:snap-mandatory" style={{ scrollBehavior: "smooth" }}>
      {/* ====== HEADER ====== */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <Zap className="h-4 w-4 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight">
              <span className="gradient-text">Envelope</span>
            </span>
          </Link>
          <nav className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="outline" size="sm" className="text-sm">
                Войти
              </Button>
            </Link>
            <Link href="/login">
              <Button
                size="sm"
                className="text-sm bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 border-0 text-white shadow-lg shadow-blue-500/25"
              >
                Открыть платформу
              </Button>
            </Link>
          </nav>
        </div>
      </header>

      {/* Back to top button */}
      <button
        onClick={() => {
          const container = document.querySelector('[data-landing]');
          if (container) container.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        className="fixed bottom-6 right-6 z-50 h-10 w-10 rounded-full bg-zinc-800/80 backdrop-blur border border-zinc-700/50 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-700 transition-all shadow-lg"
        title="Наверх"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7" />
        </svg>
      </button>

      {/* ====== HERO SECTION ====== */}
      <section className="relative h-screen min-h-[600px] flex items-center justify-center sm:snap-start sm:snap-always overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-background via-primary/[0.03] to-background" />
        <div className="absolute top-20 left-1/4 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[128px] animate-pulse-soft" />
        <div className="absolute top-40 right-1/4 w-[400px] h-[400px] bg-purple-500/10 rounded-full blur-[128px] animate-pulse-soft" style={{ animationDelay: "2s" }} />

        <div className="container relative mx-auto px-4 sm:px-6 pt-16 lg:pt-0">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1] opacity-0 animate-slide-up">
              <span className="gradient-text">Envelope</span>
            </h1>
            <p className="mt-4 text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-tight text-foreground/90 opacity-0 animate-slide-up" style={{ animationDelay: "100ms" }}>
              Внутренняя платформа
              <br className="hidden sm:block" />
              нашей студии разработки
            </p>
            <p className="mt-6 text-lg sm:text-xl leading-relaxed text-muted-foreground max-w-2xl mx-auto opacity-0 animate-slide-up" style={{ animationDelay: "200ms" }}>
              Задачи, документы, встречи, CI/CD и AI — в одной экосистеме.
              Менеджеры управляют проектами, разработчики работают, клиенты видят прогресс.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 opacity-0 animate-slide-up" style={{ animationDelay: "300ms" }}>
              <Link href="/login">
                <Button
                  size="lg"
                  className="text-base px-8 h-12 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 border-0 text-white shadow-xl shadow-blue-500/25 hover:shadow-blue-500/40 transition-all duration-300 hover:scale-[1.02]"
                >
                  Открыть платформу
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href="#features">
                <Button
                  variant="outline"
                  size="lg"
                  className="text-base px-8 h-12 border-border/60 hover:bg-muted/50 transition-all duration-300"
                >
                  Что внутри?
                </Button>
              </Link>
            </div>

          </div>
        </div>
        {/* Scroll hint — anchored to section bottom */}
        <div className="absolute bottom-16 sm:bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 opacity-40">
          <span className="text-xs text-muted-foreground">Скролл</span>
          <svg className="h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7" />
          </svg>
        </div>
      </section>

      {/* ====== FEATURE SECTIONS ====== */}
      <div id="features">
        <FeatureSection
          title="Задачи и Kanban"
          description="Drag-n-drop доска с зависимостями, приоритетами и спринтами. Статус задачи синхронизируется с PR/MR из GitLab и GitHub — задача сама переходит в REVIEW и DONE."
          cta="Открыть доску"
        >
          <KanbanDemo />
        </FeatureSection>

        <FeatureSection
          reverse
          title="Whiteboard и брейнштормы"
          description="Бесконечное полотно для схем, диаграмм и заметок. Связывайте идеи стрелками, оставляйте стикеры — всё хранится в проекте."
          cta="Открыть доску"
        >
          <WhiteboardDemo />
        </FeatureSection>

        <FeatureSection
          title="Встречи и согласование слотов"
          description="Двустороннее голосование за удобное время — система сама выберет пересечение. После встречи AI суммаризирует транскрипцию и выделяет action items."
          cta="Запланировать встречу"
        >
          <MeetDemo />
        </FeatureSection>

        <FeatureSection
          reverse
          title="Спринты (эпохи)"
          description="Группируйте задачи, документы и встречи по спринтам. Прогресс вычисляется автоматически — Gantt показывает отставание до того, как оно стало проблемой."
          cta="Создать спринт"
        >
          <GanttDemo />
        </FeatureSection>

        <FeatureSection
          title="CI/CD интеграция"
          description="Webhook от GitLab и GitHub обновляет статус задачи при открытии PR (→ REVIEW), мёрже (→ DONE) и пуше тега (→ релиз). Без ручного труда."
          cta="Настроить CI/CD"
        >
          <ApiDemo />
        </FeatureSection>

        <FeatureSection
          reverse
          title="AI Автопилот"
          description="Загрузите ТЗ — получите план проекта с задачами, оценками и зависимостями. AI предлагает, менеджер утверждает."
          cta="Запустить автопилот"
        >
          <AutopilotDemo />
        </FeatureSection>

        <FeatureSection
          title="Аналитика проекта"
          description="Health score, velocity спринта, точность оценок и прогноз дедлайна — всё в одном дашборде. AI подсвечивает блокеры и рекомендует действия."
          cta="Открыть аналитику"
        >
          <AnalyticsDemo />
        </FeatureSection>

        <FeatureSection
          reverse
          title="Чат и видеозвонки"
          description="Встроенный мессенджер с вложениями, тредами и видеозвонками. Клиент и команда в одном пространстве — без Telegram и Zoom."
          cta="Написать команде"
        >
          <ChatDemo />
        </FeatureSection>

        <FeatureSection
          title="Портал клиента"
          description="Заказчик видит прогресс в реальном времени: задачи, документы (PUBLIC), согласования и встречи. Без лишних вопросов менеджеру."
          cta="Открыть портал"
        >
          <PortalDemo />
        </FeatureSection>

        <FeatureSection
          reverse
          title="Согласования"
          description="Формальный процесс одобрения этапов, дизайна и технических решений. Клиент подписывает внутри платформы — история согласований хранится навсегда."
          cta="Создать согласование"
        >
          <ApprovalsDemo />
        </FeatureSection>

        <FeatureSection
          title="Биллинг и счета"
          description="Трудозатраты из time entries превращаются в счёт одним кликом. Клиент получает детализацию по задачам, менеджер видит прибыльность проекта."
          cta="Выставить счёт"
        >
          <BillingDemo />
        </FeatureSection>
      </div>

      {/* ====== CTA SECTION ====== */}
      <section className="relative h-screen min-h-[500px] flex items-center justify-center overflow-hidden snap-start snap-always">
        <div className="absolute inset-0 bg-gradient-to-b from-background via-primary/[0.04] to-background" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[128px]" />

        <div className="container relative mx-auto px-4 sm:px-6">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight">
              Всё, что нужно студии —
              <br />
              <span className="gradient-text">в одном месте</span>
            </h2>
            <p className="mt-6 text-lg text-muted-foreground max-w-xl mx-auto">
              Задачи, документы, встречи, CI/CD, AI и клиентский портал.
              Envelope — внутренняя платформа, которая растёт вместе со студией.
            </p>
            <div className="mt-10">
              <Link href="/login">
                <Button
                  size="lg"
                  className="text-base px-10 h-13 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 border-0 text-white shadow-xl shadow-blue-500/25 hover:shadow-blue-500/40 transition-all duration-300 hover:scale-[1.02]"
                >
                  Войти в платформу
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ====== FOOTER ====== */}
      <footer className="relative border-t border-border/50 bg-muted/20">
        <div className="container mx-auto px-4 sm:px-6 py-12">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <Zap className="h-3.5 w-3.5 text-white" />
              </div>
              <span className="text-lg font-bold tracking-tight">
                <span className="gradient-text">Envelope</span>
              </span>
            </div>
            <nav className="flex items-center gap-6">
              <Link
                href="#features"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Возможности
              </Link>
              <Link
                href="/login"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Войти
              </Link>
            </nav>
            <p className="text-sm text-muted-foreground">
              &copy; 2026 Envelope. Внутренняя платформа студии.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
