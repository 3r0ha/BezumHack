"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/auth-context";
import {
  Zap,
  Loader2,
  ArrowRight,
  LayoutDashboard,
  MessageSquare,
  Shield,
} from "lucide-react";

interface FormErrors {
  email?: string;
  password?: string;
}

export default function LoginPage() {
  const router = useRouter();
  const { login, register, user, isAuthenticated, isLoading: authLoading } = useAuth();

  const [activeTab, setActiveTab] = useState("login");

  // Login form state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginErrors, setLoginErrors] = useState<FormErrors>({});
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");

  // Redirect if already authenticated
  useEffect(() => {
    if (!authLoading && isAuthenticated && user) {
      router.replace(user.role === "CLIENT" ? "/client-portal" : "/dashboard");
    }
  }, [authLoading, isAuthenticated, user, router]);

  const validateEmail = (email: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");
    const errors: FormErrors = {};

    if (!loginEmail.trim()) {
      errors.email = "Введите email";
    } else if (!validateEmail(loginEmail)) {
      errors.email = "Некорректный формат email";
    }

    if (!loginPassword) {
      errors.password = "Введите пароль";
    } else if (loginPassword.length < 6) {
      errors.password = "Минимум 6 символов";
    }

    setLoginErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setLoginLoading(true);
    try {
      const loggedUser = await login(loginEmail, loginPassword);
      router.replace(loggedUser.role === "CLIENT" ? "/client-portal" : "/dashboard");
    } catch (err) {
      setLoginError(
        err instanceof Error ? err.message : "Ошибка входа. Проверьте данные."
      );
    } finally {
      setLoginLoading(false);
    }
  };

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-background">
      {/* ====== LEFT DECORATIVE PANEL (lg+) ====== */}
      <div className="hidden lg:flex lg:w-[480px] xl:w-[560px] relative overflow-hidden">
        {/* Gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600 via-blue-700 to-purple-800" />

        {/* Animated orbs */}
        <div className="absolute top-20 -left-20 w-80 h-80 bg-blue-400/20 rounded-full blur-[80px] animate-pulse-soft" />
        <div className="absolute bottom-20 -right-20 w-80 h-80 bg-purple-400/20 rounded-full blur-[80px] animate-pulse-soft delay-1000" />

        {/* Grid pattern overlay */}
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between p-10 xl:p-12 text-white">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center border border-white/20">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <span className="text-2xl font-bold tracking-tight">Envelope</span>
          </div>

          {/* Main messaging */}
          <div className="space-y-8">
            <div>
              <h2 className="text-3xl xl:text-4xl font-bold leading-tight tracking-tight">
                Управляйте
                <br />
                проектами
                <br />
                <span className="text-blue-200">эффективнее</span>
              </h2>
              <p className="mt-4 text-base text-blue-100/80 leading-relaxed max-w-sm">
                Внутренняя платформа студии — задачи, документы, встречи
                и CI/CD в одном месте
              </p>
            </div>

            {/* Feature highlights */}
            <div className="space-y-4">
              {[
                {
                  icon: LayoutDashboard,
                  text: "Kanban + спринты + CI/CD интеграция",
                },
                {
                  icon: MessageSquare,
                  text: "Документы с версиями и встречи с AI-итогами",
                },
                {
                  icon: Shield,
                  text: "Ролевой доступ: менеджер / разработчик / клиент",
                },
              ].map((item, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 text-sm text-blue-100/90"
                >
                  <div className="h-8 w-8 rounded-lg bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/10 flex-shrink-0">
                    <item.icon className="h-4 w-4" />
                  </div>
                  <span>{item.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Testimonial */}
          <div className="rounded-2xl bg-white/10 backdrop-blur-sm p-6 border border-white/10">
            <p className="text-sm leading-relaxed text-blue-50/90 italic">
              &ldquo;Один инструмент вместо Jira + Notion + Slack + Zoom.
              Документы, задачи, встречи и CI/CD — всё синхронизировано
              автоматически.&rdquo;
            </p>
            <div className="mt-4 flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-blue-400/30 flex items-center justify-center text-sm font-semibold text-white border border-white/20">
                АВ
              </div>
              <div>
                <p className="text-sm font-medium text-white">Артём Волков</p>
                <p className="text-xs text-blue-200/70">Project Manager, Envelope Studio</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ====== RIGHT AUTH PANEL ====== */}
      <div className="flex-1 flex items-center justify-center px-4 py-12 sm:px-8">
        {/* Background subtle effects */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/[0.03] rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-0 left-1/2 w-96 h-96 bg-purple-500/[0.03] rounded-full blur-[100px] pointer-events-none" />

        <div className="w-full max-w-md relative animate-scale-in">
          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <Link href="/" className="inline-flex items-center gap-2">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <Zap className="h-5 w-5 text-white" />
              </div>
              <span className="text-2xl font-bold tracking-tight">
                <span className="gradient-text">Envelope</span>
              </span>
            </Link>
            <p className="mt-2 text-sm text-muted-foreground">
              Внутренняя платформа студии
            </p>
          </div>

          <Card className="border-border/50 shadow-smooth-lg bg-card/80 backdrop-blur-sm">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <CardHeader className="pb-4">
                <TabsList className="w-full">
                  <TabsTrigger value="login" className="w-full">Вход</TabsTrigger>
                </TabsList>
              </CardHeader>

              {/* ====== LOGIN TAB ====== */}
              <TabsContent value="login">
                <form onSubmit={handleLogin}>
                  <CardContent className="space-y-4">
                    <div className="space-y-1">
                      <CardTitle className="text-xl">С возвращением</CardTitle>
                      <CardDescription>
                        Войдите в свой аккаунт Envelope
                      </CardDescription>
                    </div>

                    {loginError && (
                      <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
                        {loginError}
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="login-email">Email</Label>
                      <Input
                        id="login-email"
                        type="email"
                        placeholder="you@example.com"
                        value={loginEmail}
                        onChange={(e) => {
                          setLoginEmail(e.target.value);
                          if (loginErrors.email) {
                            setLoginErrors((prev) => ({ ...prev, email: undefined }));
                          }
                        }}
                        className={
                          loginErrors.email
                            ? "border-destructive focus-visible:ring-destructive"
                            : ""
                        }
                        autoComplete="email"
                      />
                      {loginErrors.email && (
                        <p className="text-xs text-destructive mt-1">
                          {loginErrors.email}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="login-password">Пароль</Label>
                        <span className="text-xs text-muted-foreground">
                          Обратитесь к администратору
                        </span>
                      </div>
                      <Input
                        id="login-password"
                        type="password"
                        placeholder="&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;&#8226;"
                        value={loginPassword}
                        onChange={(e) => {
                          setLoginPassword(e.target.value);
                          if (loginErrors.password) {
                            setLoginErrors((prev) => ({
                              ...prev,
                              password: undefined,
                            }));
                          }
                        }}
                        className={
                          loginErrors.password
                            ? "border-destructive focus-visible:ring-destructive"
                            : ""
                        }
                        autoComplete="current-password"
                      />
                      {loginErrors.password && (
                        <p className="text-xs text-destructive mt-1">
                          {loginErrors.password}
                        </p>
                      )}
                    </div>
                  </CardContent>

                  <CardFooter className="flex-col gap-4">
                    <Button
                      type="submit"
                      className="w-full h-11 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 border-0 text-white shadow-lg shadow-blue-500/20 transition-all duration-300"
                      disabled={loginLoading}
                    >
                      {loginLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Вход...
                        </>
                      ) : (
                        <>
                          Войти
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </>
                      )}
                    </Button>
                  </CardFooter>
                </form>
              </TabsContent>

              {/* Register tab redirects to login — accounts are created by admin */}
              <TabsContent value="register">
                <CardContent className="space-y-4 py-6">
                  <div className="space-y-1">
                    <CardTitle className="text-xl">Доступ закрытый</CardTitle>
                    <CardDescription>
                      Аккаунты создаются администратором платформы
                    </CardDescription>
                  </div>
                  <div className="rounded-lg bg-muted/50 border border-border px-4 py-4 text-sm text-muted-foreground space-y-2">
                    <p>Envelope — внутренняя платформа студии. Самостоятельная регистрация недоступна.</p>
                    <p>Обратитесь к менеджеру проекта для получения доступа.</p>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setActiveTab("login")}
                  >
                    Перейти к входу
                  </Button>
                </CardFooter>
              </TabsContent>
            </Tabs>
          </Card>

          {/* Bottom link back to landing */}
          <p className="mt-6 text-center text-sm text-muted-foreground">
            <Link
              href="/"
              className="hover:text-foreground transition-colors inline-flex items-center gap-1"
            >
              &larr; Вернуться на главную
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
