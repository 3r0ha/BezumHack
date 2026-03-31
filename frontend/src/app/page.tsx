"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import {
  LayoutDashboard,
  MessageSquare,
  Brain,
  Eye,
  GitBranch,
  Shield,
  ArrowRight,
  ChevronRight,
  Sparkles,
  Zap,
} from "lucide-react";

const features = [
  {
    icon: LayoutDashboard,
    title: "Управление проектами",
    description:
      "Графы зависимостей задач, канбан-доски, отслеживание прогресса в реальном времени",
    gradient: "from-blue-500/10 to-cyan-500/10",
    iconColor: "text-blue-500",
  },
  {
    icon: MessageSquare,
    title: "Умный чат",
    description:
      "Встроенный мессенджер с AI-переводом для международных команд",
    gradient: "from-violet-500/10 to-purple-500/10",
    iconColor: "text-violet-500",
  },
  {
    icon: Brain,
    title: "AI-ассистент",
    description:
      "Автоматическая суммаризация ТЗ, оценка сложности задач, генерация подзадач",
    gradient: "from-pink-500/10 to-rose-500/10",
    iconColor: "text-pink-500",
  },
  {
    icon: Eye,
    title: "Прозрачность",
    description:
      "Клиент видит статус проекта в реальном времени без лишних созвонов",
    gradient: "from-amber-500/10 to-orange-500/10",
    iconColor: "text-amber-500",
  },
  {
    icon: GitBranch,
    title: "Зависимости",
    description:
      "Визуальный граф зависимостей между задачами с автоматическим контролем порядка",
    gradient: "from-emerald-500/10 to-green-500/10",
    iconColor: "text-emerald-500",
  },
  {
    icon: Shield,
    title: "Безопасность",
    description:
      "Ролевой доступ: клиент, разработчик, менеджер. Каждый видит только своё",
    gradient: "from-indigo-500/10 to-blue-500/10",
    iconColor: "text-indigo-500",
  },
];

const steps = [
  {
    number: "01",
    title: "Создайте проект",
    description:
      "Загрузите ТЗ, AI создаст краткую выжимку и предложит декомпозицию задач",
  },
  {
    number: "02",
    title: "Управляйте задачами",
    description:
      "Назначайте исполнителей, стройте зависимости, отслеживайте прогресс",
  },
  {
    number: "03",
    title: "Общайтесь эффективно",
    description:
      "Обсуждайте задачи в контексте проекта с автопереводом",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background overflow-hidden">
      {/* ====== HEADER ====== */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <Zap className="h-4 w-4 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight">
              Dev<span className="gradient-text">Sync</span>
            </span>
          </Link>
          <nav className="flex items-center gap-3">
            <Link href="#features" className="hidden sm:inline-flex">
              <Button variant="ghost" className="text-sm text-muted-foreground hover:text-foreground">
                Возможности
              </Button>
            </Link>
            <Link href="#how-it-works" className="hidden sm:inline-flex">
              <Button variant="ghost" className="text-sm text-muted-foreground hover:text-foreground">
                Как это работает
              </Button>
            </Link>
            <Link href="/login">
              <Button variant="outline" size="sm" className="text-sm">
                Войти
              </Button>
            </Link>
            <Link href="/login?tab=register">
              <Button size="sm" className="text-sm bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 border-0 text-white shadow-lg shadow-blue-500/25">
                Начать бесплатно
              </Button>
            </Link>
          </nav>
        </div>
      </header>

      {/* ====== HERO SECTION ====== */}
      <section className="relative pt-32 pb-20 sm:pt-40 sm:pb-32">
        {/* Background grid pattern */}
        <div className="absolute inset-0 bg-grid bg-grid-fade" />

        {/* Gradient orbs */}
        <div className="absolute top-20 left-1/4 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[128px] animate-pulse-soft" />
        <div className="absolute top-40 right-1/4 w-[400px] h-[400px] bg-purple-500/10 rounded-full blur-[128px] animate-pulse-soft delay-1000" />

        <div className="container relative mx-auto px-4 sm:px-6">
          <div className="max-w-4xl mx-auto text-center">
            {/* Badge */}
            <div
              className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-muted/50 px-4 py-1.5 text-sm text-muted-foreground mb-8 opacity-0 animate-slide-up"
            >
              <Sparkles className="h-3.5 w-3.5 text-purple-500" />
              <span>Платформа нового поколения</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </div>

            {/* Heading */}
            <h1
              className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1] opacity-0 animate-slide-up delay-100"
            >
              <span className="gradient-text">DevSync</span>
            </h1>
            <p
              className="mt-4 text-2xl sm:text-3xl lg:text-4xl font-semibold tracking-tight text-foreground/90 opacity-0 animate-slide-up delay-200"
            >
              Платформа для взаимодействия
              <br className="hidden sm:block" />
              студий разработки и заказчиков
            </p>

            {/* Description */}
            <p
              className="mt-6 text-lg sm:text-xl leading-relaxed text-muted-foreground max-w-2xl mx-auto opacity-0 animate-slide-up delay-300"
            >
              Объединяем управление задачами, коммуникацию и AI-инструменты
              в единую экосистему. Прозрачность для клиентов, эффективность
              для команд.
            </p>

            {/* CTA Buttons */}
            <div
              className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 opacity-0 animate-slide-up delay-400"
            >
              <Link href="/login?tab=register">
                <Button
                  size="lg"
                  className="text-base px-8 h-12 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 border-0 text-white shadow-xl shadow-blue-500/25 hover:shadow-blue-500/40 transition-all duration-300 hover:scale-[1.02]"
                >
                  Начать бесплатно
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href="#features">
                <Button
                  variant="outline"
                  size="lg"
                  className="text-base px-8 h-12 border-border/60 hover:bg-muted/50 transition-all duration-300"
                >
                  Узнать больше
                </Button>
              </Link>
            </div>

            {/* Social proof line */}
            <div className="mt-16 flex items-center justify-center gap-8 opacity-0 animate-slide-up delay-500">
              <div className="flex -space-x-2">
                {[
                  "bg-blue-500",
                  "bg-purple-500",
                  "bg-pink-500",
                  "bg-amber-500",
                ].map((color, i) => (
                  <div
                    key={i}
                    className={`h-8 w-8 rounded-full ${color} border-2 border-background flex items-center justify-center text-white text-xs font-medium`}
                  >
                    {["A", "M", "K", "D"][i]}
                  </div>
                ))}
              </div>
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">500+</span>{" "}
                команд уже используют DevSync
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ====== FEATURES SECTION ====== */}
      <section id="features" className="relative py-24 sm:py-32">
        <div className="container mx-auto px-4 sm:px-6">
          {/* Section header */}
          <div className="max-w-2xl mx-auto text-center mb-16">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-muted/50 px-4 py-1.5 text-sm text-muted-foreground mb-6">
              <Zap className="h-3.5 w-3.5 text-blue-500" />
              Возможности
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Всё, что нужно для{" "}
              <span className="gradient-text">эффективной разработки</span>
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Мощный набор инструментов, спроектированных для реальных рабочих
              процессов
            </p>
          </div>

          {/* Feature cards grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((feature, index) => (
              <Card
                key={feature.title}
                className="group relative overflow-hidden border-border/50 bg-card/50 backdrop-blur-sm hover:border-border hover:shadow-smooth-lg transition-all duration-500 cursor-default"
              >
                {/* Hover gradient background */}
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`}
                />
                <CardHeader className="relative">
                  <div
                    className={`mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${feature.gradient} ${feature.iconColor} ring-1 ring-border/50`}
                  >
                    <feature.icon className="h-5 w-5" />
                  </div>
                  <CardTitle className="text-lg font-semibold tracking-tight">
                    {feature.title}
                  </CardTitle>
                </CardHeader>
                <CardContent className="relative">
                  <CardDescription className="text-sm leading-relaxed text-muted-foreground">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ====== HOW IT WORKS SECTION ====== */}
      <section id="how-it-works" className="relative py-24 sm:py-32 bg-muted/30">
        {/* Subtle top border gradient */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

        <div className="container mx-auto px-4 sm:px-6">
          {/* Section header */}
          <div className="max-w-2xl mx-auto text-center mb-16">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background/80 px-4 py-1.5 text-sm text-muted-foreground mb-6">
              <Sparkles className="h-3.5 w-3.5 text-purple-500" />
              Процесс
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Как это{" "}
              <span className="gradient-text">работает</span>
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Три простых шага до эффективной разработки
            </p>
          </div>

          {/* Steps */}
          <div className="max-w-4xl mx-auto">
            <div className="relative">
              {/* Connecting line */}
              <div className="absolute left-8 top-12 bottom-12 w-px bg-gradient-to-b from-blue-500/50 via-purple-500/50 to-blue-500/50 hidden md:block" />

              <div className="space-y-12 md:space-y-16">
                {steps.map((step, index) => (
                  <div
                    key={step.number}
                    className="relative flex flex-col md:flex-row items-start gap-6 md:gap-10"
                  >
                    {/* Step number circle */}
                    <div className="relative z-10 flex-shrink-0">
                      <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                        <span className="text-xl font-bold text-white">
                          {step.number}
                        </span>
                      </div>
                    </div>

                    {/* Step content */}
                    <div className="flex-1 pt-1">
                      <Card className="border-border/50 bg-card/80 backdrop-blur-sm shadow-smooth hover:shadow-smooth-lg transition-all duration-500">
                        <CardContent className="p-6 sm:p-8">
                          <h3 className="text-xl font-semibold tracking-tight mb-2">
                            {step.title}
                          </h3>
                          <p className="text-muted-foreground leading-relaxed">
                            {step.description}
                          </p>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ====== CTA SECTION ====== */}
      <section className="relative py-24 sm:py-32 overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 bg-gradient-to-b from-background via-blue-500/[0.03] to-background" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/5 rounded-full blur-[128px]" />

        <div className="container relative mx-auto px-4 sm:px-6">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight">
              Готовы оптимизировать
              <br />
              <span className="gradient-text">разработку?</span>
            </h2>
            <p className="mt-6 text-lg text-muted-foreground max-w-xl mx-auto">
              Присоединяйтесь к командам, которые уже управляют проектами
              эффективнее с DevSync
            </p>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/login?tab=register">
                <Button
                  size="lg"
                  className="text-base px-10 h-13 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 border-0 text-white shadow-xl shadow-blue-500/25 hover:shadow-blue-500/40 transition-all duration-300 hover:scale-[1.02]"
                >
                  Начать работу
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
            {/* Logo */}
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <Zap className="h-3.5 w-3.5 text-white" />
              </div>
              <span className="text-lg font-bold tracking-tight">
                Dev<span className="gradient-text">Sync</span>
              </span>
            </div>

            {/* Links */}
            <nav className="flex items-center gap-6">
              <Link
                href="#features"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                О платформе
              </Link>
              <Link
                href="#"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Контакты
              </Link>
            </nav>

            {/* Copyright */}
            <p className="text-sm text-muted-foreground">
              &copy; 2024 DevSync. Все права защищены.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
