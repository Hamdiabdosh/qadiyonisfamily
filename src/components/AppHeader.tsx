import { Link } from "@tanstack/react-router";
import { Bell, Globe, Moon, Sun, User } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/lib/auth";
import { useI18n, type Lang } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";
import { getUserNotificationsFn } from "@/lib/api/content.functions";
const LANGS: { code: Lang; label: string }[] = [
  { code: "en", label: "English" },
  { code: "am", label: "አማርኛ" },
];

export function AppHeader() {
  const { t, lang, setLang } = useI18n();
  const { user } = useAuth();
  const { dark, toggleDark } = useSettings();
  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications", "user"],
    queryFn: getUserNotificationsFn,
    enabled: !!user,
  });
  const unread = user ? notifications.filter((n) => !n.isRead).length : 0;

  return (
    <header className="header-glass sticky top-0 z-40 flex h-14 items-center justify-between border-b px-4">
      <div className="flex min-w-0 items-center gap-2.5">
        <img src="/icon.svg" alt="" className="logo-glow size-9 shrink-0 rounded-xl object-cover" />
        <div className="min-w-0">
          <h1 className="truncate text-base font-bold tracking-tight">{t("appName")}</h1>
          <p className="truncate text-xs text-muted-foreground">{t("tagline")}</p>
        </div>
      </div>
      <div className="flex items-center gap-0.5">
        <Button variant="ghost" size="icon" className="relative rounded-xl" asChild>
          <Link
            to={user ? "/notifications" : "/auth"}
            search={user ? undefined : ({ redirect: "/notifications" } as never)}
          >
            <Bell className="size-5" />
            {unread > 0 && (
              <span className="absolute right-1 top-1 flex size-4 animate-pulse items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground shadow-md shadow-destructive/40">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </Link>
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="rounded-xl"
          onClick={toggleDark}
          aria-label={t("darkMode")}
        >
          {dark ? <Sun className="size-5" /> : <Moon className="size-5" />}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-xl">
              <Globe className="size-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="rounded-xl border-primary/15 backdrop-blur-xl">
            {LANGS.map(({ code, label }) => (
              <DropdownMenuItem
                key={code}
                onClick={() => setLang(code)}
                className={lang === code ? "font-semibold text-primary" : ""}
              >
                {label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button variant="ghost" size="icon" className="rounded-xl" asChild>
          <Link to="/profile">
            <User className="size-5" />
          </Link>
        </Button>
      </div>
    </header>
  );
}
