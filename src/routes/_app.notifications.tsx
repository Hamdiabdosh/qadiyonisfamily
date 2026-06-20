import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";

import { AppHeader } from "@/components/AppHeader";
import { PageTitleRow } from "@/components/PageTitleRow";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { getUserNotificationsFn, markNotificationReadFn } from "@/lib/api/content.functions";

export const Route = createFileRoute("/_app/notifications")({
  ssr: false,
  component: NotificationsPage,
});

function NotificationsPage() {
  const { t } = useI18n();
  const { user, loading } = useAuth();
  const qc = useQueryClient();
  const { data: items = [] } = useQuery({
    queryKey: ["notifications", "user"],
    queryFn: getUserNotificationsFn,
    enabled: !!user,
  });

  const markRead = async (id: number) => {
    await markNotificationReadFn({ data: { id } });
    qc.invalidateQueries({ queryKey: ["notifications"] });
  };

  return (
    <div>
      <AppHeader />
      <div className="page-content space-y-3 px-4 pb-4 pt-2">
        <PageTitleRow title={t("notifications")} />

        {loading ? (
          <p className="text-sm text-muted-foreground">{t("loading")}</p>
        ) : !user ? (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
              <Bell className="size-12 text-primary/50" />
              <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
                {t("notificationsLoginCta")}
              </p>
              <div className="flex w-full max-w-xs flex-col gap-2">
                <Button asChild className="w-full">
                  <Link to="/auth" search={{ redirect: "/notifications" } as never}>{t("signIn")}</Link>
                </Button>
                <Button asChild variant="outline" className="w-full">
                  <Link to="/auth" search={{ mode: "register", redirect: "/notifications" } as never}>
                    {t("signUp")}
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : items.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
              <Bell className="size-10 text-muted-foreground opacity-40" />
              <p className="text-sm text-muted-foreground">{t("noNotificationsLoggedIn")}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="stagger-children space-y-3">
            {items.map((n) => (
              <Card
                key={n.id}
                variant="interactive"
                className={n.isRead ? "opacity-70" : "border-primary/40 shadow-[0_4px_24px_var(--glow-primary)]"}
                onClick={() => !n.isRead && markRead(n.id)}
              >
                <CardContent className="space-y-1 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-sm">{n.title}</p>
                    {!n.isRead && <span className="size-2 shrink-0 rounded-full bg-primary mt-1.5" />}
                  </div>
                  <p className="text-xs text-muted-foreground">{n.body}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(n.createdAt).toLocaleString()}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
