import { Download } from "lucide-react";

import { InstallAppGuide } from "@/components/InstallAppGuide";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePwaInstall } from "@/lib/pwa-install";
import { useI18n } from "@/lib/i18n";

export function InstallAppDialog() {
  const { t } = useI18n();
  const {
    showInstallPopup,
    isIos,
    isAndroid,
    hasNativePrompt,
    promptInstall,
    closeInstallPopup,
    dismissInstallPopup,
  } = usePwaInstall();

  const guidePlatform = isIos ? "ios" : "android";
  const showGuide = isIos || !hasNativePrompt;

  return (
    <Dialog open={showInstallPopup} onOpenChange={(open) => !open && closeInstallPopup()}>
      <DialogContent className="max-w-sm gap-0 overflow-hidden rounded-2xl border-primary/20 p-0 sm:max-w-md">
        <div className="bg-gradient-to-br from-primary/15 via-primary/5 to-transparent px-6 pb-4 pt-6 text-center">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-background shadow-lg shadow-primary/20 ring-1 ring-primary/20">
            <img src="/icon.svg" alt="" className="size-10 rounded-xl" />
          </div>
          <DialogHeader className="space-y-2 text-center">
            <DialogTitle className="text-lg font-bold leading-snug">{t("installAppTitle")}</DialogTitle>
            <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
              {t("installAppPurpose")}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-3 px-6 pb-6 pt-4">
          {hasNativePrompt ? (
            <Button
              className="h-auto min-h-11 w-full whitespace-normal px-4 py-3 text-center text-sm font-semibold leading-snug"
              onClick={() => void promptInstall()}
            >
              <Download className="mr-2 size-4 shrink-0" />
              {t("installAppCta")}
            </Button>
          ) : null}

          {showGuide ? <InstallAppGuide platform={guidePlatform} /> : null}

          {hasNativePrompt ? (
            <p className="text-center text-xs text-muted-foreground">{t("installAppAndroidFallback")}</p>
          ) : null}

          <Button variant="ghost" className="w-full text-muted-foreground" onClick={dismissInstallPopup}>
            {t("installAppNotNow")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
