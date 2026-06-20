import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { usePwaInstall } from "@/lib/pwa-install";
import { useI18n } from "@/lib/i18n";

type Props = {
  className?: string;
  showLabel?: boolean;
};

export function InstallAppButton({ className, showLabel = true }: Props) {
  const { t } = useI18n();
  const { canShowInstall, promptInstall, isIos, isAndroid } = usePwaInstall();

  if (!canShowInstall) return null;

  return (
    <Button
      variant="outline"
      size={showLabel ? "sm" : "icon"}
      className={className ?? "rounded-xl border-primary/30 text-primary hover:bg-primary/10"}
      onClick={() => void promptInstall()}
      aria-label={t("installApp")}
      title={isIos ? t("installAppIosTitle") : isAndroid ? t("installAppAndroidTitle") : t("installAppCta")}
    >
      <Download className="size-4 shrink-0" />
      {showLabel ? <span className="ml-1.5 text-xs sm:text-sm">{t("installApp")}</span> : null}
    </Button>
  );
}
