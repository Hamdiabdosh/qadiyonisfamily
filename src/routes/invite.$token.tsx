import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { MemberAvatar } from "@/components/MemberAvatar";
import { BuiltByRaafatI18n } from "@/components/brand/built-by-raafat";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { claimInviteFn, getInviteFn } from "@/lib/api/family.functions";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/invite/$token")({
  ssr: false,
  component: InvitePage,
});

function InvitePage() {
  const { token } = Route.useParams();
  const { t } = useI18n();
  const { user, loading: authLoading, setLinkedMemberId } = useAuth();
  const nav = useNavigate();
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState(false);

  const { data: invite, isLoading, isError } = useQuery({
    queryKey: ["invite", token],
    queryFn: () => getInviteFn({ data: { token } }),
    enabled: !!token,
  });

  useEffect(() => {
    if (authLoading || !user || !invite || claimed || claiming) return;
    let cancelled = false;
    (async () => {
      setClaiming(true);
      try {
        const result = await claimInviteFn({ data: { token } });
        if (cancelled) return;
        setLinkedMemberId(result.memberId);
        setClaimed(true);
        toast.success(t("inviteClaimed"));
        nav({ to: "/add-family" });
      } catch (err) {
        if (cancelled) return;
        toast.error(err instanceof Error ? err.message : t("inviteClaimFailed"));
        setClaiming(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, user, invite, claimed, claiming, token, nav, t, setLinkedMemberId]);

  const redirectPath = `/invite/${token}`;

  return (
    <div className="app-shell relative flex min-h-screen flex-col items-center justify-center px-4 py-8">
      <div className="app-mesh" aria-hidden />
      <div className="relative z-10 w-full max-w-sm page-content space-y-4">
        <div className="text-center">
          <h1 className="text-xl font-bold tracking-tight">{t("appName")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("inviteTitle")}</p>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("inviteFor")}</CardTitle>
            <CardDescription>{t("inviteDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="flex justify-center py-6">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            ) : isError || !invite ? (
              <p className="text-sm text-muted-foreground">{t("inviteInvalid")}</p>
            ) : (
              <>
                <div className="flex flex-col items-center gap-2 py-2">
                  <MemberAvatar name={invite.fullName} photoUrl={invite.photoUrl} size="xl" />
                  <p className="font-semibold">{invite.fullName}</p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {invite.gender === "male" ? t("male") : t("female")}
                    {!invite.isAlive ? ` · ${t("deceased")}` : ""}
                  </p>
                </div>

                {authLoading || claiming ? (
                  <div className="flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    {claiming ? t("inviteLinking") : t("loading")}
                  </div>
                ) : user ? (
                  <p className="text-center text-sm text-muted-foreground">{t("inviteLinking")}</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    <Button asChild>
                      <Link to="/auth" search={{ redirect: redirectPath, mode: "signin" } as never}>
                        {t("signIn")}
                      </Link>
                    </Button>
                    <Button asChild variant="outline">
                      <Link to="/auth" search={{ redirect: redirectPath, mode: "register" } as never}>
                        {t("signUp")}
                      </Link>
                    </Button>
                    <p className="text-center text-xs text-muted-foreground">{t("inviteAuthHint")}</p>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <BuiltByRaafatI18n className="text-center" />
      </div>
    </div>
  );
}
