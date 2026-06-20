import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, MessageSquare } from "lucide-react";
import { toast } from "sonner";

import { AppHeader } from "@/components/AppHeader";
import { PageTitleRow } from "@/components/PageTitleRow";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n";
import { getPublicSettingsFn, submitFeedbackFn } from "@/lib/api/content.functions";
import { youtubeEmbedUrl } from "@/lib/youtube";

export const Route = createFileRoute("/_app/home")({
  ssr: false,
  component: HomePage,
});

function HomePage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const { data: settings = {} } = useQuery({ queryKey: ["public-settings"], queryFn: getPublicSettingsFn });
  const embedUrl = youtubeEmbedUrl(settings.youtube_video_url);

  const [submitterName, setSubmitterName] = useState("");
  const [submitterPhone, setSubmitterPhone] = useState("");
  const [feedbackMsg, setFeedbackMsg] = useState("");
  const [sending, setSending] = useState(false);

  const isFormValid =
    submitterName.trim().length > 0 &&
    submitterPhone.trim().length > 0 &&
    feedbackMsg.trim().length > 0;

  const submitFeedback = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!isFormValid) {
      toast.error(t("feedbackAllRequired"));
      return;
    }
    setSending(true);
    try {
      await submitFeedbackFn({
        data: {
          submitterName: submitterName.trim(),
          submitterPhone: submitterPhone.trim(),
          message: feedbackMsg.trim(),
        },
      });
      toast.success(t("feedbackSent"));
      setSubmitterName("");
      setSubmitterPhone("");
      setFeedbackMsg("");
      qc.invalidateQueries({ queryKey: ["admin"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("errorOccurred"));
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <AppHeader />
      <div className="page-content stagger-children space-y-4 px-4 pb-4 pt-2">
        <PageTitleRow title={t("home")} />
        <Card className="overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("howToRegister")}</CardTitle>
            <CardDescription>{t("howToRegisterDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="p-0 pb-4 px-4">
            {embedUrl ? (
              <div className="aspect-video w-full overflow-hidden rounded-xl bg-muted shadow-inner ring-1 ring-primary/10">
                <iframe
                  src={embedUrl}
                  title="How to register family members"
                  className="h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            ) : (
              <div className="flex aspect-video items-center justify-center rounded-lg bg-muted text-sm text-muted-foreground">
                {t("videoComingSoon")}
              </div>
            )}
          </CardContent>
        </Card>

        <Card variant="cta">
          <CardContent className="space-y-4 pt-6 text-center">
            <p className="text-lg font-semibold leading-snug">{t("ctaQuestion")}</p>
            <p className="text-sm text-muted-foreground">{t("ctaDescription")}</p>
            <Button size="lg" className="w-full text-base font-bold" asChild>
              <Link to="/add-family">
                <Plus className="size-5 mr-2" />
                {t("addFamily")}
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <MessageSquare className="size-5 text-primary" />
              <CardTitle className="text-base">{t("feedbackTitle")}</CardTitle>
            </div>
            <CardDescription>{t("feedbackDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-3" onSubmit={submitFeedback} noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="feedback-name">
                  {t("fullName")} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="feedback-name"
                  value={submitterName}
                  onChange={(e) => setSubmitterName(e.target.value)}
                  placeholder={t("fullName")}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="feedback-phone">
                  {t("phone")} <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="feedback-phone"
                  type="tel"
                  value={submitterPhone}
                  onChange={(e) => setSubmitterPhone(e.target.value)}
                  placeholder="+251…"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="feedback-message">
                  {t("feedbackMessage")} <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="feedback-message"
                  value={feedbackMsg}
                  onChange={(e) => setFeedbackMsg(e.target.value)}
                  placeholder={t("feedbackPlaceholder")}
                  rows={4}
                  required
                />
              </div>
              <Button className="w-full" type="submit" disabled={sending || !isFormValid}>
                {t("sendFeedback")}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
