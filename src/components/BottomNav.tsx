import { Link, useRouterState } from "@tanstack/react-router";
import { Home, GitBranch, Compass, Users, User } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function BottomNav() {
  const { t } = useI18n();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const items = [
    { to: "/home", icon: Home, label: t("home") },
    { to: "/tree", icon: GitBranch, label: t("tree") },
    { to: "/explore", icon: Compass, label: t("explore") },
    { to: "/kin", icon: Users, label: t("kinDirectory") },
    { to: "/profile", icon: User, label: t("profile") },
  ] as const;

  return (
    <nav
      className="nav-shell fixed bottom-0 inset-x-0 z-50 px-3 pt-2 pb-3"
      style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
    >
      <div className="nav-glass mx-auto max-w-md rounded-2xl border">
        <ul className="grid grid-cols-5">
          {items.map((it) => {
            const active = path === it.to || (it.to !== "/home" && path.startsWith(it.to));
            const Icon = it.icon;
            return (
              <li key={it.to}>
                <Link
                  to={it.to}
                  className={cn(
                    "group relative flex flex-col items-center justify-center gap-1 py-2 min-h-[64px] text-[10px] transition-colors duration-200",
                    active ? "text-primary font-semibold" : "text-muted-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "relative flex size-10 items-center justify-center rounded-xl transition-all duration-200",
                      active
                        ? "bg-primary/15 shadow-[0_0_14px_var(--glow-primary)] ring-1 ring-primary/25"
                        : "bg-muted/40 group-hover:bg-muted/70 group-hover:text-foreground",
                    )}
                  >
                    <Icon
                      className={cn(
                        "size-[22px] transition-all duration-200",
                        active
                          ? "stroke-[2.25] text-primary drop-shadow-[0_0_6px_var(--glow-primary)]"
                          : "stroke-[1.75] group-hover:scale-105",
                      )}
                    />
                  </span>
                  <span className="relative truncate max-w-full px-0.5 leading-tight">{it.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
