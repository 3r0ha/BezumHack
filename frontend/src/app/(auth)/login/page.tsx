"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  name?: string;
  email?: string;
  password?: string;
  role?: string;
}

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, register, isAuthenticated, isLoading: authLoading } = useAuth();

  const defaultTab = searchParams.get("tab") === "register" ? "register" : "login";

  // Login form state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginErrors, setLoginErrors] = useState<FormErrors>({});
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");

  // Register form state
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regRole, setRegRole] = useState("developer");
  const [regErrors, setRegErrors] = useState<FormErrors>({});
  const [regLoading, setRegLoading] = useState(false);
  const [regError, setRegError] = useState("");

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      router.push("/dashboard");
    }
  }, [isAuthenticated, router]);

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
      await login(loginEmail, loginPassword);
      router.push("/dashboard");
    } catch (err) {
      setLoginError(
        err instanceof Error ? err.message : "Ошибка входа. Проверьте данные."
      );
    } finally {
      setLoginLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError("");
    const errors: FormErrors = {};

    if (!regName.trim()) {
      errors.name = "Введите имя";
    }

    if (!regEmail.trim()) {
      errors.email = "Введите email";
    } else if (!validateEmail(regEmail)) {
      errors.email = "Некорректный формат email";
    }

    if (!regPassword) {
      errors.password = "Введите пароль";
    } else if (regPassword.length < 6) {
      errors.password = "Минимум 6 символов";
    }

    setRegErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setRegLoading(true);
    try {
      await register(regEmail, regPassword, regName, regRole);
      router.push("/dashboard");
    } catch (err) {
      setRegError(
        err instanceof Error
          ? err.message
          : "Ошибка регистрации. Попробуйте снова."
      );
    } finally {
      setRegLoading(false);
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
            <span className="text-2xl font-bold tracking-tight">DevSync</span>
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
                Единая платформа для прозрачной работы между заказчиками
                и командами разработки
              </p>
            </div>

            {/* Feature highlights */}
            <div className="space-y-4">
              {[
                {
                  icon: LayoutDashboard,
                  text: "Канбан-доски и графы зависимостей",
                },
                {
                  icon: MessageSquare,
                  text: "Чат с AI-переводом",
                },
                {
                  icon: Shield,
                  text: "Ролевой доступ к проектам",
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
              &ldquo;DevSync полностью изменил наш подход к работе с клиентами.
              Прозрачность проекта выросла на порядок, а количество
              ненужных созвонов сократилось в три раза.&rdquo;
            </p>
            <div className="mt-4 flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-blue-400/30 flex items-center justify-center text-sm font-semibold text-white border border-white/20">
                АС
              </div>
              <div>
                <p className="text-sm font-medium text-white">Алексей Смирнов</p>
                <p className="text-xs text-blue-200/70">CTO, TechVision Studio</p>
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
                Dev<span className="gradient-text">Sync</span>
              </span>
            </Link>
            <p className="mt-2 text-sm text-muted-foreground">
              Платформа для студий разработки
            </p>
          </div>

          <Card className="border-border/50 shadow-smooth-lg bg-card/80 backdrop-blur-sm">
            <Tabs defaultValue={defaultTab}>
              <CardHeader className="pb-4">
                <TabsList className="w-full grid grid-cols-2">
                  <TabsTrigger value="login">Вход</TabsTrigger>
                  <TabsTrigger value="register">Регистрация</TabsTrigger>
                </TabsList>
              </CardHeader>

              {/* ====== LOGIN TAB ====== */}
              <TabsContent value="login">
                <form onSubmit={handleLogin}>
                  <CardContent className="space-y-4">
                    <div className="space-y-1">
                      <CardTitle className="text-xl">С возвращением</CardTitle>
                      <CardDescription>
                        Войдите в свой аккаунт DevSync
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
                        <Link
                          href="#"
                          className="text-xs text-muted-foreground hover:text-primary transition-colors"
                        >
                          Забыли пароль?
                        </Link>
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

              {/* ====== REGISTER TAB ====== */}
              <TabsContent value="register">
                <form onSubmit={handleRegister}>
                  <CardContent className="space-y-4">
                    <div className="space-y-1">
                      <CardTitle className="text-xl">Создать аккаунт</CardTitle>
                      <CardDescription>
                        Начните работу с DevSync за минуту
                      </CardDescription>
                    </div>

                    {regError && (
                      <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
                        {regError}
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="reg-name">Имя</Label>
                      <Input
                        id="reg-name"
                        type="text"
                        placeholder="Ваше имя"
                        value={regName}
                        onChange={(e) => {
                          setRegName(e.target.value);
                          if (regErrors.name) {
                            setRegErrors((prev) => ({ ...prev, name: undefined }));
                          }
                        }}
                        className={
                          regErrors.name
                            ? "border-destructive focus-visible:ring-destructive"
                            : ""
                        }
                        autoComplete="name"
                      />
                      {regErrors.name && (
                        <p className="text-xs text-destructive mt-1">
                          {regErrors.name}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="reg-email">Email</Label>
                      <Input
                        id="reg-email"
                        type="email"
                        placeholder="you@example.com"
                        value={regEmail}
                        onChange={(e) => {
                          setRegEmail(e.target.value);
                          if (regErrors.email) {
                            setRegErrors((prev) => ({ ...prev, email: undefined }));
                          }
                        }}
                        className={
                          regErrors.email
                            ? "border-destructive focus-visible:ring-destructive"
                            : ""
                        }
                        autoComplete="email"
                      />
                      {regErrors.email && (
                        <p className="text-xs text-destructive mt-1">
                          {regErrors.email}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="reg-password">Пароль</Label>
                      <Input
                        id="reg-password"
                        type="password"
                        placeholder="Минимум 6 символов"
                        value={regPassword}
                        onChange={(e) => {
                          setRegPassword(e.target.value);
                          if (regErrors.password) {
                            setRegErrors((prev) => ({
                              ...prev,
                              password: undefined,
                            }));
                          }
                        }}
                        className={
                          regErrors.password
                            ? "border-destructive focus-visible:ring-destructive"
                            : ""
                        }
                        autoComplete="new-password"
                      />
                      {regErrors.password && (
                        <p className="text-xs text-destructive mt-1">
                          {regErrors.password}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="reg-role">Роль</Label>
                      <select
                        id="reg-role"
                        value={regRole}
                        onChange={(e) => setRegRole(e.target.value)}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 appearance-none cursor-pointer"
                      >
                        <option value="client">Клиент</option>
                        <option value="developer">Разработчик</option>
                        <option value="manager">Менеджер</option>
                      </select>
                    </div>
                  </CardContent>

                  <CardFooter className="flex-col gap-4">
                    <Button
                      type="submit"
                      className="w-full h-11 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 border-0 text-white shadow-lg shadow-blue-500/20 transition-all duration-300"
                      disabled={regLoading}
                    >
                      {regLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Регистрация...
                        </>
                      ) : (
                        <>
                          Зарегистрироваться
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </>
                      )}
                    </Button>
                  </CardFooter>
                </form>
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
