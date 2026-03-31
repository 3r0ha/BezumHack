"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  FolderKanban,
  MessageSquare,
  Brain,
  Settings,
  ChevronLeft,
  ChevronRight,
  Menu,
  Sun,
  Moon,
  Bell,
  LogOut,
  User,
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
import { useAuth } from "@/contexts/auth-context";
import { useTheme } from "@/contexts/theme-context";

const navItems = [
  { href: "/", label: "Дашборд", icon: LayoutDashboard },
  { href: "/projects", label: "Проекты", icon: FolderKanban },
  { href: "/chat", label: "Чат", icon: MessageSquare },
  { href: "/ai", label: "AI Ассистент", icon: Brain },
];

const pageTitles: Record<string, string> = {
  "/": "Дашборд",
  "/projects": "Проекты",
  "/chat": "Чат",
  "/ai": "AI Ассистент",
  "/settings": "Настройки",
};

function getPageTitle(pathname: string): string {
  if (pageTitles[pathname]) return pageTitles[pathname];
  if (pathname.startsWith("/projects/")) return "Проект";
  return "Дашборд";
}

function getUserInitials(name?: string): string {
  if (!name) return "U";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name[0].toUpperCase();
}

const roleLabels: Record<string, string> = {
  CLIENT: "Клиент",
  DEVELOPER: "Разработчик",
  MANAGER: "Менеджер",
};

interface SidebarContentProps {
  collapsed: boolean;
  pathname: string;
  onNavigate?: () => void;
  user: { name: string; role: string } | null;
}

function SidebarContent({ collapsed, pathname, onNavigate, user }: SidebarContentProps) {
  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(href + "/");
  };

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="h-16 flex items-center px-4 border-b shrink-0">
        <Link
          href="/"
          className="flex items-center gap-3 overflow-hidden"
          onClick={onNavigate}
        >
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center shrink-0">
            <span className="text-primary-foreground font-bold text-sm">DS</span>
          </div>
          {!collapsed && (
            <span className="text-lg font-bold tracking-tight whitespace-nowrap">
              DevSync
            </span>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const active = isActive(item.href);
          const linkContent = (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={`
                group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium
                transition-all duration-200 relative
                ${collapsed ? "justify-center" : ""}
                ${
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                }
              `}
            >
              <item.icon className={`h-5 w-5 shrink-0 ${active ? "" : "group-hover:scale-110 transition-transform"}`} />
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
              <p>Настройки</p>
            </TooltipContent>
          </Tooltip>
        ) : (
          <Link
            href="/settings"
            onClick={onNavigate}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-all duration-200"
          >
            <Settings className="h-5 w-5 shrink-0" />
            <span>Настройки</span>
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
                  {roleLabels[user.role] || user.role}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
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

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoading, isAuthenticated, logout } = useAuth();
  const { resolvedTheme, toggleTheme } = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isLoading, isAuthenticated, router]);

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
      <div className="min-h-screen flex bg-background">
        {/* Desktop sidebar */}
        <aside
          className={`
            hidden lg:flex flex-col border-r bg-card shrink-0
            transition-all duration-300 ease-in-out
            ${collapsed ? "w-[64px]" : "w-[240px]"}
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
          <header className="h-16 border-b bg-card flex items-center justify-between px-4 lg:px-6 shrink-0 sticky top-0 z-30">
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
                  {getPageTitle(pathname)}
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
                  <p>{resolvedTheme === "dark" ? "Светлая тема" : "Тёмная тема"}</p>
                </TooltipContent>
              </Tooltip>

              {/* Notifications placeholder */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-muted-foreground hover:text-foreground relative"
                  >
                    <Bell className="h-[18px] w-[18px]" />
                    <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-primary" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Уведомления</p>
                </TooltipContent>
              </Tooltip>

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
                        {roleLabels[user?.role || ""] || user?.role}
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
                    Профиль
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push("/settings")}>
                    <Settings className="mr-2 h-4 w-4" />
                    Настройки
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
                    Выйти
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          {/* Page content */}
          <main className="flex-1 p-4 lg:p-6 overflow-auto">{children}</main>
        </div>
      </div>
    </TooltipProvider>
  );
}
