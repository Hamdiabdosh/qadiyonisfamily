import type { ReactNode } from "react";
import { MoreVertical, PlusSquare, Share, Smartphone } from "lucide-react";

import { useI18n } from "@/lib/i18n";
import type { PwaPlatform } from "@/lib/pwa-platform";

type Props = {
  platform: PwaPlatform;
};

function Step({ n, icon, text }: { n: number; icon: ReactNode; text: string }) {
  return (
    <li className="flex gap-3 text-sm text-muted-foreground">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
        {n}
      </span>
      <span className="flex min-w-0 items-start gap-2 pt-0.5">
        <span className="shrink-0 text-primary">{icon}</span>
        <span className="leading-relaxed">{text}</span>
      </span>
    </li>
  );
}

export function InstallAppGuide({ platform }: Props) {
  const { t } = useI18n();
  const isIos = platform === "ios";

  return (
    <div className="rounded-xl border border-border/60 bg-muted/30 px-4 py-3 text-left">
      <p className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
        <Smartphone className="size-4 shrink-0 text-primary" />
        {isIos ? t("installAppIosTitle") : t("installAppAndroidTitle")}
      </p>
      <ol className="space-y-3">
        {isIos ? (
          <>
            <Step n={1} icon={<Share className="size-4" />} text={t("installAppIosStep1")} />
            <Step n={2} icon={<PlusSquare className="size-4" />} text={t("installAppIosStep2")} />
            <Step n={3} icon={<Smartphone className="size-4" />} text={t("installAppIosStep3")} />
          </>
        ) : (
          <>
            <Step n={1} icon={<MoreVertical className="size-4" />} text={t("installAppAndroidStep1")} />
            <Step n={2} icon={<PlusSquare className="size-4" />} text={t("installAppAndroidStep2")} />
            <Step n={3} icon={<Smartphone className="size-4" />} text={t("installAppAndroidStep3")} />
          </>
        )}
      </ol>
    </div>
  );
}
