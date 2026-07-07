import { useEffect, useState } from "react";
import { Globe } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useI18n, type Lang } from "@/lib/i18n";

const ONBOARDING_KEY = "lang_onboarding_done";

const LANG_OPTIONS: { code: Lang; label: string }[] = [
  { code: "en", label: "English" },
  { code: "am", label: "Amharic" },
];

export function LanguageOnboardingDialog() {
  const { setLang, t } = useI18n();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(ONBOARDING_KEY) === "1") return;
    if (localStorage.getItem("lang")) {
      localStorage.setItem(ONBOARDING_KEY, "1");
      return;
    }
    setOpen(true);
  }, []);

  const finish = (choice: Lang | "skip") => {
    setLang(choice === "skip" ? "en" : choice);
    localStorage.setItem(ONBOARDING_KEY, "1");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="max-w-sm gap-0 overflow-hidden rounded-2xl border-primary/20 p-0 sm:max-w-md [&>button.absolute]:hidden"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <div className="bg-gradient-to-br from-primary/15 via-primary/5 to-transparent px-6 pb-4 pt-6 text-center">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-background shadow-lg shadow-primary/20 ring-1 ring-primary/20">
            <Globe className="size-8 text-primary" />
          </div>
          <DialogHeader className="space-y-2 text-center">
            <DialogTitle className="text-lg font-bold leading-snug">{t("languageOnboardingTitle")}</DialogTitle>
            <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
              {t("languageOnboardingDesc")}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-3 px-6 pb-6 pt-4">
          <div className="grid gap-2">
            {LANG_OPTIONS.map(({ code, label }) => (
              <Button
                key={code}
                variant="outline"
                className="h-11 w-full justify-center text-sm font-semibold"
                onClick={() => finish(code)}
              >
                {label}
              </Button>
            ))}
          </div>

          <p className="text-center text-xs leading-relaxed text-muted-foreground">{t("languageOnboardingHint")}</p>

          <Button variant="ghost" className="w-full text-xs text-muted-foreground" onClick={() => finish("skip")}>
            {t("languageOnboardingSkip")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
