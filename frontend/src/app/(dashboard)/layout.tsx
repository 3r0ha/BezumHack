"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  FolderKanban,
  MessageSquare,
  Brain,
  Settings,
  ChevronLeft,
  BarChart3,
  LayoutGrid,
  Timer,
  CheckSquare,
  Receipt,
  TrendingUp,
  Eye,
  Video,
  ChevronRight,
  Menu,
  Sun,
  Moon,
  Bell,
  LogOut,
  User,
  Search,
  FileText,
  CalendarCheck,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { io } from "socket.io-client";
import { useAuth } from "@/contexts/auth-context";
import { useTheme } from "@/contexts/theme-context";
import { useLocale } from "@/contexts/locale-context";
import { api } from "@/lib/api";

function useNavItems() {
  const { t } = useLocale();
  const { user } = useAuth();
  const role = user?.role || "DEVELOPER";

  const all = [
    { href: "/client-portal", label: t('nav.client_portal'), icon: Eye, roles: ["CLIENT", "MANAGER"] },
    { href: "/dashboard", label: t('nav.dashboard'), icon: LayoutDashboard, roles: ["DEVELOPER", "MANAGER"] },
    { href: "/projects", label: t('nav.projects'), icon: FolderKanban, roles: ["DEVELOPER", "MANAGER"] },
    { href: "/docs", label: "Документы", icon: FileText, roles: ["DEVELOPER", "MANAGER", "CLIENT"] },
    { href: "/meetings", label: "Встречи", icon: CalendarCheck, roles: ["DEVELOPER", "MANAGER", "CLIENT"] },
    { href: "/gantt", label: t('nav.gantt'), icon: BarChart3, roles: ["DEVELOPER", "MANAGER"] },
    { href: "/boards", label: t('nav.boards'), icon: LayoutGrid, roles: ["DEVELOPER", "MANAGER"] },
    { href: "/chat", label: t('nav.chat'), icon: MessageSquare, roles: ["CLIENT", "DEVELOPER", "MANAGER"] },
    { href: "/ai", label: t('nav.ai'), icon: Brain, roles: ["DEVELOPER", "MANAGER"] },
    { href: "/approvals", label: t('nav.approvals'), icon: CheckSquare, roles: ["CLIENT", "MANAGER"] },
    { href: "/billing", label: t('nav.billing'), icon: Receipt, roles: ["MANAGER"] },
    { href: "/analytics", label: t('nav.analytics'), icon: TrendingUp, roles: ["MANAGER"] },
    { href: "/admin", label: t('nav.admin'), icon: Shield, roles: ["MANAGER"] },
  ];

  return all.filter(item => item.roles.includes(role));
}

function usePageTitle(pathname: string): string {
  const { t } = useLocale();
  const pageTitles: Record<string, string> = {
    "/dashboard": t('nav.dashboard'),
    "/projects": t('nav.projects'),
    "/gantt": t('nav.gantt'),
    "/chat": t('nav.chat'),
    "/ai": t('nav.ai'),
    "/approvals": t('nav.approvals'),
    "/billing": t('nav.billing'),
    "/analytics": t('nav.analytics'),
    "/client-portal": t('nav.client_portal'),
    "/boards": t('nav.boards'),
    "/docs": "Документы",
    "/meetings": "Встречи",
    "/search": t('nav.search'),
    "/settings": t('nav.settings'),
    "/admin": t('nav.admin'),
  };
  if (pageTitles[pathname]) return pageTitles[pathname];
  if (pathname.startsWith("/projects/")) return t('nav.projects');
  if (pathname.startsWith("/boards/")) return t('nav.boards');
  if (pathname.startsWith("/docs/")) return "Документы";
  if (pathname.startsWith("/meetings/")) return "Встречи";
  return t('nav.dashboard');
}

function getUserInitials(name?: string): string {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name[0].toUpperCase();
}

function getRoleLabel(role: string, t: (key: string) => string): string {
  const map: Record<string, string> = {
    CLIENT: t('auth.role.client'),
    DEVELOPER: t('auth.role.developer'),
    MANAGER: t('auth.role.manager'),
  };
  return map[role] || role;
}

interface SidebarContentProps {
  collapsed: boolean;
  pathname: string;
  onNavigate?: () => void;
  user: { name: string; role: string } | null;
}

function SidebarContent({ collapsed, pathname, onNavigate, user }: SidebarContentProps) {
  const navItems = useNavItems();
  const { t } = useLocale();
  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname === href || pathname.startsWith(href + "/");
  };

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="h-14 flex items-center px-4 shrink-0">
        <Link
          href="/dashboard"
          className="flex items-center gap-2.5 overflow-hidden group"
          onClick={onNavigate}
        >
          <div className="h-7 w-7 rounded-lg gradient-bg flex items-center justify-center shrink-0 group-hover:glow transition-shadow">
            <span className="text-white font-bold text-xs">E</span>
          </div>
          {!collapsed && (
            <span className="text-[15px] font-semibold tracking-tight whitespace-nowrap">
              Envelope
            </span>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-3 space-y-px overflow-y-auto">
        {navItems.map((item) => {
          const active = isActive(item.href);
          const linkContent = (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={`
                group flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13px] font-medium
                transition-all duration-150 relative
                ${collapsed ? "justify-center" : ""}
                ${
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-foreground/[0.04]"
                }
              `}
            >
              {active && !collapsed && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 rounded-r-full bg-primary" />
              )}
              <item.icon className={`h-4 w-4 shrink-0 transition-colors ${active ? "text-primary" : ""}`} />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );

          if (collapsed) {
            return (
              <Tooltip key={item.href}>
                <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                <TooltipContent side="right">
                  <p>{item.label}</p>
                </TooltipContent>
              </Tooltip>
            );
          }

          return linkContent;
        })}
      </nav>

      <div className="px-3 py-2">
        <Separator className="mb-2" />
        {/* Settings link */}
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href="/settings"
                onClick={onNavigate}
                className="flex items-center justify-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-all duration-200"
              >
                <Settings className="h-5 w-5 shrink-0" />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>{t('nav.settings')}</p>
            </TooltipContent>
          </Tooltip>
        ) : (
          <Link
            href="/settings"
            onClick={onNavigate}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-all duration-200"
          >
            <Settings className="h-5 w-5 shrink-0" />
            <span>{t('nav.settings')}</span>
          </Link>
        )}
      </div>

      {/* User info at bottom */}
      {user && (
        <div className="border-t p-3 shrink-0">
          <div
            className={`flex items-center gap-3 rounded-lg px-2 py-2 ${
              collapsed ? "justify-center" : ""
            }`}
          >
            <Avatar className="h-9 w-9 shrink-0">
              <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                {getUserInitials(user.name)}
              </AvatarFallback>
            </Avatar>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user.name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {getRoleLabel(user.role, t) || user.role}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function NotificationsDropdown() {
  const { t } = useLocale();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);

  const loadNotifications = async () => {
    try {
      const data = await api.get<any>("/api/notifications/notifications?limit=20");
      if (data?.notifications) {
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch {}
  };

  // Initial load + periodic refresh
  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  // Real-time via notifications socket
  useEffect(() => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (!token || !user) return;

    const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL || "";
    const socket = io(SOCKET_URL, {
      path: "/notifications-ws/",
      auth: { token },
      transports: ["websocket", "polling"],
      reconnectionAttempts: 5,
    });

    socket.on("notification", (notif: any) => {
      setNotifications((prev) => {
        if (prev.find((n) => n.id === notif.id)) return prev;
        return [notif, ...prev].slice(0, 20);
      });
      setUnreadCount((c) => c + 1);
    });

    return () => { socket.disconnect(); };
  }, [user?.id]);

  const handleMarkAllRead = async () => {
    try {
      await api.post("/api/notifications/notifications/read-all");
    } catch {}
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  const handleNotificationClick = async (n: any) => {
    if (!n.read) {
      try {
        await api.patch(`/api/notifications/notifications/${n.id}/read`);
      } catch {}
      setNotifications((prev) =>
        prev.map((item) => (item.id === n.id ? { ...item, read: true } : item))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    }
  };

  const typeIcons: Record<string, string> = {
    TASK_ASSIGNED: "bg-blue-500",
    BLOCKER_RESOLVED: "bg-emerald-500",
    DEADLINE_APPROACHING: "bg-amber-500",
    APPROVAL_REQUESTED: "bg-violet-500",
    TASK_COMMENT: "bg-sky-500",
    MESSAGE_RECEIVED: "bg-indigo-500",
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-muted-foreground hover:text-foreground relative"
        >
          <Bell className="h-[18px] w-[18px]" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[380px]">
        <div className="flex items-center justify-between px-4 py-2">
          <DropdownMenuLabel className="p-0">{t('notifications.title')}</DropdownMenuLabel>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="text-xs text-primary hover:text-primary/80 font-medium"
            >
              {t('notifications.read_all')}
            </button>
          )}
        </div>
        <DropdownMenuSeparator />
        <div className="max-h-[400px] overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              {t('notifications.empty')}
            </div>
          ) : (
            notifications.map((n) => (
              <DropdownMenuItem
                key={n.id}
                className={`flex items-start gap-3 px-4 py-3 cursor-pointer ${
                  !n.read ? "bg-accent/50" : ""
                }`}
                onClick={() => handleNotificationClick(n)}
              >
                <div
                  className={`h-2 w-2 rounded-full mt-1.5 shrink-0 ${
                    typeIcons[n.type] || "bg-muted-foreground"
                  }`}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium leading-tight">{n.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                    {n.body}
                  </p>
                  <p className="text-[10px] text-muted-foreground/60 mt-1">
                    {new Date(n.createdAt).toLocaleString("ru", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                {!n.read && (
                  <div className="h-1.5 w-1.5 rounded-full bg-primary shrink-0 mt-2" />
                )}
              </DropdownMenuItem>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function LoadingSkeleton() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 rounded-lg bg-primary/20 animate-pulse" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-24 mx-auto" />
        </div>
      </div>
    </div>
  );
}

function NavigationProgress() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const prevRef = useRef(pathname);

  useEffect(() => {
    if (pathname !== prevRef.current) {
      prevRef.current = pathname;
      setVisible(true);
      const t = setTimeout(() => setVisible(false), 400);
      return () => clearTimeout(t);
    }
  }, [pathname]);

  if (!visible) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] h-0.5 bg-primary/20">
      <div className="h-full bg-primary rounded-r-full transition-all duration-400" style={{ width: "100%" }} />
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading, isAuthenticated, logout } = useAuth();
  const { resolvedTheme, toggleTheme } = useTheme();
  const { t } = useLocale();
  const pageTitle = usePageTitle(pathname);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isLoading, isAuthenticated, router]);

  // Role-based page access guard
  useEffect(() => {
    if (isLoading || !user) return;
    const role = user.role;
    const restricted: Record<string, string[]> = {
      "/dashboard": ["DEVELOPER", "MANAGER"],
      "/projects": ["DEVELOPER", "MANAGER"],
      "/gantt": ["DEVELOPER", "MANAGER"],
      "/boards": ["DEVELOPER", "MANAGER"],
      "/ai": ["DEVELOPER", "MANAGER"],
      "/billing": ["MANAGER"],
      "/analytics": ["MANAGER"],
      "/admin": ["MANAGER"],
      "/settings/api": ["DEVELOPER", "MANAGER"],
      "/settings/webhooks": ["DEVELOPER", "MANAGER"],
    };
    for (const [path, roles] of Object.entries(restricted)) {
      if (pathname.startsWith(path) && !roles.includes(role)) {
        router.replace(role === "CLIENT" ? "/client-portal" : "/dashboard");
        return;
      }
    }
  }, [isLoading, user, pathname, router]);

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (!isAuthenticated) {
    return <LoadingSkeleton />;
  }

  const sidebarUser = user
    ? { name: user.name || "Пользователь", role: user.role || "DEVELOPER" }
    : null;

  return (
    <TooltipProvider delayDuration={100}>
      <NavigationProgress />
      <div className="min-h-screen flex bg-background">
        {/* Desktop sidebar */}
        <aside
          className={`
            hidden lg:flex flex-col border-r border-border/30 bg-card shrink-0
            transition-all duration-300 ease-in-out
            ${collapsed ? "w-[56px]" : "w-[220px]"}
          `}
        >
          <SidebarContent
            collapsed={collapsed}
            pathname={pathname}
            user={sidebarUser}
          />
          {/* Collapse toggle */}
          <div className="border-t p-2 flex justify-center">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCollapsed(!collapsed)}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
            >
              {collapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </Button>
          </div>
        </aside>

        {/* Main content area */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <header className="h-12 border-b border-border/30 bg-card flex items-center justify-between px-4 lg:px-5 shrink-0 sticky top-0 z-30">
            <div className="flex items-center gap-3">
              {/* Mobile menu trigger */}
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="lg:hidden h-9 w-9"
                  >
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="p-0 w-[280px]">
                  <SidebarContent
                    collapsed={false}
                    pathname={pathname}
                    onNavigate={() => setMobileOpen(false)}
                    user={sidebarUser}
                  />
                </SheetContent>
              </Sheet>

              {/* Page title */}
              <div>
                <h1 className="text-lg font-semibold tracking-tight">
                  {pageTitle}
                </h1>
              </div>
            </div>

            {/* Right side actions */}
            <div className="flex items-center gap-1">
              {/* Theme toggle */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggleTheme}
                    className="h-9 w-9 text-muted-foreground hover:text-foreground"
                  >
                    {resolvedTheme === "dark" ? (
                      <Sun className="h-[18px] w-[18px]" />
                    ) : (
                      <Moon className="h-[18px] w-[18px]" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{resolvedTheme === "dark" ? t('settings.theme.light') : t('settings.theme.dark')}</p>
                </TooltipContent>
              </Tooltip>

              {/* Search */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => router.push("/search")}
                    className="h-9 w-9 text-muted-foreground hover:text-foreground"
                  >
                    <Search className="h-[18px] w-[18px]" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{t('nav.search')}</p>
                </TooltipContent>
              </Tooltip>

              {/* New Meet */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={async () => {
                      try {
                        const res = await api.post<any>("/api/chat/calls", {
                          initiatorId: user?.id,
                          participants: [user?.id],
                          type: "video",
                        });
                        router.push(`/call/${res.id}`);
                      } catch {
                        const id = crypto.randomUUID();
                        router.push(`/call/${id}`);
                      }
                    }}
                    className="h-9 w-9 text-muted-foreground hover:text-foreground"
                  >
                    <Video className="h-[18px] w-[18px]" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{t('call.start')}</p>
                </TooltipContent>
              </Tooltip>

              {/* Notifications dropdown */}
              <NotificationsDropdown />

              <Separator orientation="vertical" className="mx-2 h-6" />

              {/* User dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="h-auto p-1.5 gap-2 hover:bg-accent"
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                        {getUserInitials(user?.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="hidden sm:block text-left">
                      <p className="text-sm font-medium leading-tight">
                        {user?.name || "Пользователь"}
                      </p>
                      <p className="text-xs text-muted-foreground leading-tight">
                        {getRoleLabel(user?.role || "", t) || user?.role}
                      </p>
                    </div>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium">{user?.name}</p>
                      <p className="text-xs text-muted-foreground">{user?.email}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => router.push("/settings")}>
                    <User className="mr-2 h-4 w-4" />
                    {t('settings.profile')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push("/settings")}>
                    <Settings className="mr-2 h-4 w-4" />
                    {t('nav.settings')}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => {
                      logout();
                      router.push("/login");
                    }}
                    className="text-destructive focus:text-destructive"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    {t('auth.logout')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          {/* Page content */}
          <main className="flex-1 p-4 lg:p-5 overflow-auto">{children}</main>
        </div>
      </div>
    </TooltipProvider>
  );
}
