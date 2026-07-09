import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { Bell, Eye, EyeOff, Loader2 } from "lucide-react";

import { ChatbotWidget } from "@/components/chatbot/ChatbotWidget";
import { InstallAppButton } from "@/components/InstallAppButton";
import { SectionAudioPlayer, type SectionAudioHandle } from "@/components/SectionAudioPlayer";
import { BuiltByRaafatI18n } from "@/components/brand/built-by-raafat";
import { useAuth } from "@/lib/auth";
import { getPublicSettingsFn } from "@/lib/api/content.functions";
import { useI18n, type Lang } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const searchSchema = z.object({
  redirect: z.string().optional(),
  mode: z.enum(["signin", "register"]).optional(),
});

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: searchSchema,
  component: AuthPage,
});

function PasswordField({
  id,
  value,
  onChange,
  placeholder,
  show,
  onToggle,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  show: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="relative">
      <Input
        id={id}
        type={show ? "text" : "password"}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pr-10"
        autoComplete={id.includes("reg") ? "new-password" : "current-password"}
      />
      <button
        type="button"
        onClick={onToggle}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        aria-label={show ? "Hide password" : "Show password"}
      >
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

function AuthPage() {
  const { signIn, register, user, isAdmin } = useAuth();
  const { t, lang, setLang } = useI18n();
  const nav = useNavigate();
  const search = useSearch({ from: "/auth" });
  const [tab, setTab] = useState<"signin" | "register">(
    search.mode === "signin" ? "signin" : "register",
  );
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [showSignInPassword, setShowSignInPassword] = useState(false);
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const registerAudioRef = useRef<SectionAudioHandle>(null);
  const { data: publicSettings = {} } = useQuery({
    queryKey: ["public-settings"],
    queryFn: getPublicSettingsFn,
  });
  const registerAudioUrl = String(publicSettings["register_audio_url"] ?? "");

  useEffect(() => {
    setTab(search.mode === "signin" ? "signin" : "register");
  }, [search.mode]);

  useEffect(() => {
    if (!user) return;
    const target = search.redirect ?? (isAdmin ? "/admin" : "/home");
    if (target.startsWith("/admin")) {
      nav({ to: "/admin", search: { view: "dashboard" } });
    } else if (target.startsWith("/invite/")) {
      window.location.assign(target);
    } else {
      nav({ to: target as "/home" });
    }
  }, [user, isAdmin, nav, search.redirect]);

  const submitLogin = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!identifier.trim() || !password) {
      toast.error(t("signInRequired"));
      return;
    }
    setLoading(true);
    const { error } = await signIn(identifier, password);
    setLoading(false);
    if (error) toast.error(error);
  };

  const submitRegister = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!fullName.trim() || !phone.trim() || regPassword.length < 6) {
      toast.error(t("registerRequired"));
      return;
    }
    setLoading(true);
    const trimmedPhone = phone.trim();
    const { error } = await register(fullName.trim(), trimmedPhone, regPassword);
    setLoading(false);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success(t("registerPending"));
    setTab("signin");
    setIdentifier(trimmedPhone);
    setPassword("");
    setFullName("");
    setPhone("");
    setRegPassword("");
  };

  return (
    <div className="app-shell relative flex min-h-screen flex-col items-center justify-center px-4 py-8">
      <div className="app-mesh" aria-hidden />
      <div className="relative z-10 w-full max-w-sm page-content">
        <div className="mb-6 text-center">
          <img
            src="/icon-192.png"
            alt=""
            width={80}
            height={80}
            className="avatar-glow mx-auto mb-4 size-20 rounded-full object-cover"
          />
          <h1 className="text-2xl font-bold tracking-tight">{t("appName")}</h1>
          <span className="page-title-accent mx-auto mt-2" />
          <p className="mt-2 text-sm text-muted-foreground">{t("tagline")}</p>
        </div>

        <div className="mb-4 flex items-center justify-center gap-2">
          <Select value={lang} onValueChange={(v) => setLang(v as Lang)}>
            <SelectTrigger className="h-9 w-[140px] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="am">አማርኛ</SelectItem>
            </SelectContent>
          </Select>
          <InstallAppButton />
        </div>

        <Card className="mb-4 border-primary/20 bg-primary/5">
          <CardContent className="flex items-start gap-3 pt-4">
            <Bell className="mt-0.5 size-5 shrink-0 text-primary/80" />
            <p className="text-xs leading-relaxed text-muted-foreground">{t("authNotificationsCta")}</p>
          </CardContent>
        </Card>

        <Card variant="default" className="overflow-hidden">
          <Tabs value={tab} onValueChange={(v) => setTab(v as "signin" | "register")}>
            <CardHeader className="pb-3">
              <TabsList className="grid h-11 w-full grid-cols-2">
                <TabsTrigger value="register">{t("signUp")}</TabsTrigger>
                <TabsTrigger value="signin">{t("signIn")}</TabsTrigger>
              </TabsList>
            </CardHeader>
            <CardContent>
              <TabsContent value="signin" className="mt-0">
                <form className="space-y-4" onSubmit={submitLogin}>
                  <CardDescription>{t("signInDesc")}</CardDescription>
                  <div className="space-y-1.5">
                    <Label htmlFor="signin-identifier">{t("emailOrPhone")}</Label>
                    <Input
                      id="signin-identifier"
                      placeholder={t("emailOrPhonePlaceholder")}
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      autoComplete="username"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="signin-password">{t("password")}</Label>
                    <PasswordField
                      id="signin-password"
                      value={password}
                      onChange={setPassword}
                      placeholder={t("passwordPlaceholder")}
                      show={showSignInPassword}
                      onToggle={() => setShowSignInPassword((v) => !v)}
                    />
                  </div>
                  <Button disabled={loading} type="submit" className="w-full">
                    {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                    {loading ? t("signingIn") : t("signIn")}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="register" className="mt-0">
                <form className="space-y-4" onSubmit={submitRegister}>
                  <CardDescription>{t("registerDesc")}</CardDescription>
                  <p className="text-xs leading-snug text-muted-foreground">{t("registerKinHint")}</p>
                  {registerAudioUrl ? (
                    <SectionAudioPlayer
                      ref={registerAudioRef}
                      src={registerAudioUrl}
                      label={t("audioGuideRegister")}
                    />
                  ) : null}
                  <div className="space-y-1.5">
                    <Label htmlFor="register-name">{t("fullName")}</Label>
                    <Input
                      id="register-name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      onFocus={() => registerAudioRef.current?.start()}
                      placeholder={t("fullName")}
                      autoComplete="name"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="register-phone">{t("phone")}</Label>
                    <Input
                      id="register-phone"
                      type="tel"
                      inputMode="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+251…"
                      autoComplete="tel"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="register-password">{t("password")}</Label>
                    <PasswordField
                      id="register-password"
                      value={regPassword}
                      onChange={setRegPassword}
                      placeholder={t("passwordPlaceholder")}
                      show={showRegPassword}
                      onToggle={() => setShowRegPassword((v) => !v)}
                    />
                    <p className="text-[11px] text-muted-foreground">{t("passwordMinHint")}</p>
                  </div>
                  <Button disabled={loading} type="submit" className="w-full">
                    {loading ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                    {loading ? t("requestingAccount") : t("requestAccount")}
                  </Button>
                </form>
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
        <div className="mt-6 text-center">
          <BuiltByRaafatI18n />
        </div>
      </div>
      <ChatbotWidget placement="auth" />
    </div>
  );
}
