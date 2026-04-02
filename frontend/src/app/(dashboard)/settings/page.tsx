"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Settings, User, Palette, Lock, Save, Loader2, Key, Webhook, ArrowRight, Globe, Send } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/auth-context";
import { useTheme } from "@/contexts/theme-context";
import { useLocale } from "@/contexts/locale-context";
import { api } from "@/lib/api";

function getRoleLabels(t: (key: string) => string): Record<string, string> {
  return {
    CLIENT: t('auth.role.client'),
    DEVELOPER: t('auth.role.developer'),
    MANAGER: t('auth.role.manager'),
  };
}

export default function SettingsPage() {
  const { user } = useAuth();
  const { theme, setTheme } = useTheme();
  const { locale, setLocale, t } = useLocale();
  const roleLabels = getRoleLabels(t);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [telegramLinked, setTelegramLinked] = useState(false);
  const [telegramEnabled, setTelegramEnabled] = useState(false);
  const [linkingTelegram, setLinkingTelegram] = useState(false);
  const [telegramLinkUrl, setTelegramLinkUrl] = useState("");

  useEffect(() => {
    if (user) {
      setName(user.name || "");
      setEmail(user.email || "");
    }
  }, [user]);

  useEffect(() => {
    api.get<any>("/api/auth/telegram/status").then(d => {
      setTelegramLinked(d?.linked || false);
      setTelegramEnabled(d?.enabled || false);
    }).catch(() => {});
  }, []);

  const handleProfileSave = async () => {
    if (!user) return;
    setProfileSaving(true);
    setProfileMessage(null);

    try {
      await api.patch(`/api/auth/users/${user.id}`, { name, email });
      setProfileMessage({ type: "success", text: t('settings.profile_saved') });
    } catch (err: any) {
      setProfileMessage({
        type: "error",
        text: err?.message || t('settings.profile_error'),
      });
    }
    setProfileSaving(false);
  };

  const handlePasswordChange = async () => {
    setPasswordMessage(null);

    if (!currentPassword || !newPassword) {
      setPasswordMessage({ type: "error", text: t('settings.fill_all_fields') });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMessage({ type: "error", text: t('settings.passwords_mismatch') });
      return;
    }
    if (newPassword.length < 6) {
      setPasswordMessage({ type: "error", text: t('auth.min_password') });
      return;
    }

    try {
      await api.post("/api/auth/change-password", { currentPassword, newPassword });
      setPasswordMessage({ type: "success", text: t('settings.password_changed') });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setPasswordMessage({
        type: "error",
        text: err?.message || t('settings.password_error'),
      });
    }
  };

  const startTelegramLink = async () => {
    setLinkingTelegram(true);
    const token = crypto.randomUUID();
    const botName = "envelope_notifybot"; // TODO: configure
    setTelegramLinkUrl(`https://t.me/${botName}?start=${token}`);

    // Poll for link completion
    const poll = setInterval(async () => {
      try {
        const resp = await api.get<any>(`/api/telegram/pending/${token}`);
        if (resp?.chatId) {
          clearInterval(poll);
          await api.post("/api/auth/telegram/link", { chatId: resp.chatId });
          setTelegramLinked(true);
          setTelegramEnabled(true);
          setLinkingTelegram(false);
          setTelegramLinkUrl("");
        }
      } catch {}
    }, 3000);

    setTimeout(() => { clearInterval(poll); setLinkingTelegram(false); }, 120000);
  };

  const unlinkTelegram = async () => {
    await api.post("/api/auth/telegram/unlink");
    setTelegramLinked(false);
    setTelegramEnabled(false);
  };

  const toggleTelegram = async (enabled: boolean) => {
    setTelegramEnabled(enabled);
    // TODO: add enable/disable endpoint
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-slate-500 to-slate-700 text-white">
          <Settings className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t('settings.title')}</h1>
          <p className="text-sm text-muted-foreground">
            {t('settings.subtitle')}
          </p>
        </div>
      </div>

      {/* Profile Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4" />
            {t('settings.profile')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="settings-name">{t('settings.name')}</Label>
              <Input
                id="settings-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('settings.your_name')}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="settings-email">Email</Label>
              <Input
                id="settings-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t('settings.role')}</Label>
            <Input
              value={user ? roleLabels[user.role] || user.role : ""}
              disabled
              className="bg-muted"
            />
          </div>

          {profileMessage && (
            <p
              className={`text-sm ${
                profileMessage.type === "success"
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-red-600 dark:text-red-400"
              }`}
            >
              {profileMessage.text}
            </p>
          )}

          <Button onClick={handleProfileSave} disabled={profileSaving} className="gap-2">
            {profileSaving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {t('settings.save_profile')}
          </Button>
        </CardContent>
      </Card>

      <Separator />

      {/* Password Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Lock className="h-4 w-4" />
            {t('settings.password_change')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="settings-current-pw">{t('settings.current_password')}</Label>
            <Input
              id="settings-current-pw"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder={t('settings.enter_current')}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="settings-new-pw">{t('settings.new_password')}</Label>
            <Input
              id="settings-new-pw"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder={t('settings.min_6_chars')}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="settings-confirm-pw">{t('settings.confirm_password')}</Label>
            <Input
              id="settings-confirm-pw"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder={t('settings.repeat_password')}
            />
          </div>

          {passwordMessage && (
            <p
              className={`text-sm ${
                passwordMessage.type === "success"
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-red-600 dark:text-red-400"
              }`}
            >
              {passwordMessage.text}
            </p>
          )}

          <Button onClick={handlePasswordChange} variant="outline" className="gap-2">
            <Lock className="h-4 w-4" />
            {t('settings.change_password')}
          </Button>
        </CardContent>
      </Card>

      <Separator />

      {/* Theme Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Palette className="h-4 w-4" />
            {t('settings.theme')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{t('settings.theme_label')}</Label>
            <Select value={theme} onValueChange={(v) => setTheme(v as "light" | "dark" | "system")}>
              <SelectTrigger className="w-full sm:w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">{t('settings.theme.light')}</SelectItem>
                <SelectItem value="dark">{t('settings.theme.dark')}</SelectItem>
                <SelectItem value="system">{t('settings.theme.system')}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {t('settings.theme_instant')}
            </p>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Language Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Globe className="h-4 w-4" />
            {t('settings.language')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{t('settings.language_label')}</Label>
            <Select value={locale} onValueChange={(v) => setLocale(v as 'ru' | 'en')}>
              <SelectTrigger className="w-full sm:w-[220px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ru">Русский</SelectItem>
                <SelectItem value="en">English</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Telegram Notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Send className="h-4 w-4" />
            Telegram
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {telegramLinked ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="text-sm">{t('settings.telegram_linked')}</span>
              </div>
              <div className="flex items-center gap-3">
                <Label className="flex-1">{t('settings.telegram_notifications')}</Label>
                <Switch checked={telegramEnabled} onCheckedChange={toggleTelegram} />
              </div>
              <Button variant="outline" size="sm" onClick={unlinkTelegram}>
                {t('settings.telegram_unlink')}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">{t('settings.telegram_desc')}</p>
              <Button onClick={startTelegramLink} disabled={linkingTelegram}>
                {linkingTelegram ? t('common.loading') : t('settings.telegram_link')}
              </Button>
              {telegramLinkUrl && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">{t('settings.telegram_open')}</p>
                  <a href={telegramLinkUrl} target="_blank" rel="noopener" className="text-sm text-primary hover:underline break-all">
                    {telegramLinkUrl}
                  </a>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Developer Section — hidden for clients */}
      {user?.role !== "CLIENT" && (
      <>
      <Separator />
      <h2 className="text-lg font-semibold">{t('settings.developers')}</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/settings/api" className="group">
          <Card className="hover:border-primary/30 transition-colors">
            <CardContent className="pt-6 flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 shrink-0">
                <Key className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="font-medium group-hover:text-primary transition-colors">{t('settings.api_keys')}</p>
                <p className="text-xs text-muted-foreground">{t('settings.api_desc')}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
            </CardContent>
          </Card>
        </Link>
        <Link href="/settings/webhooks" className="group">
          <Card className="hover:border-primary/30 transition-colors">
            <CardContent className="pt-6 flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400 shrink-0">
                <Webhook className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="font-medium group-hover:text-primary transition-colors">{t('settings.webhooks')}</p>
                <p className="text-xs text-muted-foreground">{t('settings.webhooks_desc')}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
            </CardContent>
          </Card>
        </Link>
      </div>
      </>
      )}
    </div>
  );
}
