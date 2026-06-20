import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { Bell, Eye, EyeOff } from "lucide-react";
import { ChatbotWidget } from "@/components/chatbot/ChatbotWidget";
import { SectionAudioPlayer, type SectionAudioHandle } from "@/components/SectionAudioPlayer";
import { useAuth } from "@/lib/auth";
import { getPublicSettingsFn } from "@/lib/api/content.functions";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { PageTitleRow } from "@/components/PageTitleRow";

const searchSchema = z.object({
  redirect: z.string().optional(),
  mode: z.enum(["signin"]).optional(),
});

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: searchSchema,
  component: AuthPage,
});

function AuthPage() {
  const { signIn, register, user, isAdmin } = useAuth();
  const { t } = useI18n();
  const nav = useNavigate();
  const search = useSearch({ from: "/auth" });
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const registerAudioRef = useRef<SectionAudioHandle>(null);
  const { data: publicSettings = {} } = useQuery({
    queryKey: ["public-settings"],
    queryFn: getPublicSettingsFn,
  });
  const registerAudioUrl = String(publicSettings["register_audio_url"] ?? "");

  useEffect(() => {
    if (!user) return;
    const target = search.redirect ?? (isAdmin ? "/admin" : "/home");
    if (target.startsWith("/admin")) {
      nav({ to: "/admin", search: { view: "dashboard" } });
    } else {
      nav({ to: target as "/home" });
    }
  }, [user, isAdmin, nav, search.redirect]);

  const submitLogin = async () => {
    setLoading(true);
    const { error } = await signIn(identifier, password);
    setLoading(false);
    if (error) toast.error(error);
  };

  const submitRegister = async () => {
    if (!fullName.trim() || !phone.trim() || regPassword.length < 6) {
      toast.error(t("registerRequired"));
      return;
    }
    setLoading(true);
    const { error } = await register(fullName.trim(), phone.trim(), regPassword);
    setLoading(false);
    if (error) toast.error(error);
    else toast.success(t("registerPending"));
  };

  return (
    <div className="app-shell relative flex min-h-screen flex-col items-center justify-center px-4">
      <div className="app-mesh" aria-hidden />
      <div className="relative z-10 w-full max-w-sm page-content">
        <div className="mb-6 text-center">
          <div className="avatar-glow mb-4 inline-flex size-20 items-center justify-center rounded-full bg-gradient-to-br from-root to-root/80 text-3xl font-bold text-root-foreground">
            ሼ
          </div>
          <PageTitleRow
            title={t("appName")}
            className="[&_.page-title]:text-2xl [&_.page-title]:font-bold [&_.page-title]:tracking-tight [&_span.page-title-accent]:mx-auto [&_span.page-title-accent]:mt-3"
            description={<p className="mt-1 text-sm text-muted-foreground">{t("tagline")}</p>}
          />
        </div>
        <Card className="mb-4 border-primary/25 bg-primary/5">
          <CardContent className="flex flex-col items-center gap-3 pt-5 text-center">
            <Bell className="size-8 text-primary/70" />
            <p className="text-sm leading-relaxed text-muted-foreground">{t("authNotificationsCta")}</p>
          </CardContent>
        </Card>

        <Card variant="default" className="overflow-hidden">
          <Tabs defaultValue={search.mode === "signin" ? "signin" : "register"}>
            <CardHeader className="pb-3">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="register">{t("signUp")}</TabsTrigger>
                <TabsTrigger value="signin">{t("signIn")}</TabsTrigger>
              </TabsList>
            </CardHeader>
            <CardContent>
              <TabsContent value="signin" className="mt-0 space-y-3">
                <CardDescription>{t("signInDesc")}</CardDescription>
                <div className="space-y-1.5">
                  <Label>{t("emailOrPhone")}</Label>
                  <Input
                    placeholder={t("emailOrPhonePlaceholder")}
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("password")}</Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder={t("passwordPlaceholder")}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>
                <Button disabled={loading} onClick={submitLogin} className="w-full">
                  {t("signIn")}
                </Button>
              </TabsContent>
              <TabsContent value="register" className="mt-0 space-y-3">
                <p className="text-xs leading-snug text-muted-foreground">{t("registerKinHint")}</p>
                {registerAudioUrl ? (
                  <SectionAudioPlayer
                    ref={registerAudioRef}
                    src={registerAudioUrl}
                    label={t("audioGuideRegister")}
                  />
                ) : null}
                <div className="space-y-1.5">
                  <Label>{t("fullName")}</Label>
                  <Input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    onFocus={() => registerAudioRef.current?.start()}
                    placeholder={t("fullName")}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("phone")}</Label>
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+251…" />
                </div>
                <div className="space-y-1.5">
                  <Label>{t("password")}</Label>
                  <Input
                    type="password"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder={t("passwordPlaceholder")}
                  />
                </div>
                <Button disabled={loading} onClick={submitRegister} className="w-full">
                  {t("requestAccount")}
                </Button>
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>

        <p className="mt-4 text-center">
          <Link
            to="/home"
            className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            {t("authSkip")}
          </Link>
        </p>
      </div>
      <ChatbotWidget placement="auth" />
    </div>
  );
}
