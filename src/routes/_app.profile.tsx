import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { Moon, Sun, Bell, Phone, LogOut, Shield, ChevronRight, Send } from "lucide-react";

import { AppHeader } from "@/components/AppHeader";
import { SponsorAppDialog } from "@/components/SponsorAppDialog";
import { PageTitleRow } from "@/components/PageTitleRow";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useI18n, type Lang } from "@/lib/i18n";
import { useSettings } from "@/lib/settings";
import { useAuth } from "@/lib/auth";
import { getPublicSettingsFn } from "@/lib/api/content.functions";
import { DEFAULT_CONTACT_ADMINS, telegramUrl, type ContactAdmin } from "@/lib/contact-admins";

export const Route = createFileRoute("/_app/profile")({
  ssr: false,
  validateSearch: z.object({ sponsor: z.coerce.boolean().optional() }),
  component: ProfilePage,
});

function ProfileLinkCard({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="block">
      <Card variant="interactive" className={className}>
        <CardContent className="flex items-center gap-3 p-4">
          {children}
          <ChevronRight className="ml-auto size-5 shrink-0 text-muted-foreground" aria-hidden />
        </CardContent>
      </Card>
    </a>
  );
}

function ContactAdminCard({ admin, telegramLabel }: { admin: ContactAdmin; telegramLabel: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/20 p-3 space-y-2 text-sm">
      {admin.label ? <p className="font-medium">{admin.label}</p> : null}
      {admin.phone ? (
        <a href={`tel:${admin.phone}`} className="flex items-center gap-2 text-foreground hover:text-primary">
          <Phone className="size-4 shrink-0 text-muted-foreground" />
          <span>{admin.phone}</span>
        </a>
      ) : null}
      {admin.telegram ? (
        <a
          href={telegramUrl(admin.telegram)}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-foreground hover:text-primary"
        >
          <Send className="size-4 shrink-0 text-muted-foreground" />
          <span>
            {telegramLabel}: @{admin.telegram.replace(/^@/, "")}
          </span>
        </a>
      ) : null}
    </div>
  );
}

function ProfilePage() {
  const { sponsor: openSponsor } = Route.useSearch();
  const [sponsorOpen, setSponsorOpen] = useState(false);
  const { t, lang, setLang } = useI18n();

  useEffect(() => {
    if (openSponsor) setSponsorOpen(true);
  }, [openSponsor]);
  const { dark, toggleDark, notifications, setNotifications } = useSettings();
  const { user, isAdmin, loading, signOut } = useAuth();
  const { data: settings } = useQuery({ queryKey: ["public-settings"], queryFn: getPublicSettingsFn });

  const contactAdmins = settings?.contact_admins ?? DEFAULT_CONTACT_ADMINS;

  const profileName = user?.fullName ?? "—";
  const profileContact = user?.phone ?? user?.email ?? "—";

  return (
    <div>
      <AppHeader />
      <div className="page-content stagger-children space-y-4 px-4 pb-4 pt-2">
        <PageTitleRow title={t("profile")} />

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">{t("yourProfile")}</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {loading ? (
              <p className="text-muted-foreground">{t("loading")}</p>
            ) : user ? (
              <div className="space-y-1">
                {isAdmin ? (
                  <p className="text-xs font-medium uppercase tracking-wide text-primary">{t("admin")}</p>
                ) : null}
                <p className="font-semibold">{profileName}</p>
                <p className="text-muted-foreground">{profileContact}</p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-muted-foreground">{t("profileLoginPrompt")}</p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button asChild className="flex-1">
                    <Link to="/auth" search={{ redirect: "/profile" } as never}>{t("signIn")}</Link>
                  </Button>
                  <Button asChild variant="outline" className="flex-1">
                    <Link to="/auth" search={{ mode: "register", redirect: "/profile" } as never}>{t("signUp")}</Link>
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">{t("appSettings")}</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm flex items-center gap-2">{dark ? <Moon className="size-4" /> : <Sun className="size-4" />}{t("darkMode")}</span>
              <Switch checked={dark} onCheckedChange={toggleDark} />
            </div>
            <div className="space-y-1.5">
              <span className="text-sm">{t("language")}</span>
              <Select value={lang} onValueChange={(v) => setLang(v as Lang)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="am">አማርኛ</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {user ? (
              <div className="flex items-center justify-between">
                <span className="text-sm flex items-center gap-2"><Bell className="size-4" />{t("notifications")}</span>
                <Switch checked={notifications} onCheckedChange={async (v) => {
                  if (v && "Notification" in window) {
                    const p = await Notification.requestPermission();
                    if (p !== "granted") return;
                  }
                  setNotifications(v);
                }} />
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-base">{t("contactAdmin")}</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {contactAdmins.map((admin, index) => (
                <ContactAdminCard key={`${admin.phone}-${admin.telegram}-${index}`} admin={admin} telegramLabel={t("telegram")} />
              ))}
            </div>
          </CardContent>
        </Card>

        <ProfileLinkCard href="https://t.me/hamdiabdosh43" className="overflow-hidden border-primary/15">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-full border-2 border-primary/20 bg-primary/10 text-lg font-semibold text-primary shadow-sm">
            ATA
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">{t("foundedAndDevelopedBy")}</p>
            <p className="font-semibold">Abdulhamid Teweleda Abdosh</p>
          </div>
        </ProfileLinkCard>

        <button type="button" className="block w-full text-left" onClick={() => setSponsorOpen(true)}>
          <Card variant="interactive" className="border-dashed border-primary/30 bg-primary/5">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{t("sponsorApp")}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{t("sponsorAppDesc")}</p>
              </div>
              <ChevronRight className="ml-auto size-5 shrink-0 text-muted-foreground" aria-hidden />
            </CardContent>
          </Card>
        </button>

        <SponsorAppDialog open={sponsorOpen} onOpenChange={setSponsorOpen} />

        {user ? (
          <div className="flex flex-col gap-2 pt-1">
            {isAdmin ? (
              <Link to="/admin" className="block">
                <Button variant="secondary" className="w-full">
                  <Shield className="size-4 mr-2" />
                  {t("adminDashboard")}
                </Button>
              </Link>
            ) : null}
            <Button
              variant="outline"
              className="w-full"
              onClick={async () => {
                await signOut();
                window.location.href = "/auth";
              }}
            >
              <LogOut className="size-4 mr-2" />
              {t("signOut")}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
