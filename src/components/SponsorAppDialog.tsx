import { Bot, Globe, Heart, Server } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useI18n } from "@/lib/i18n";

const DEVELOPER_TELEGRAM = "the_wadeh";
const DEVELOPER_SITE = "https://abdulfetah.site";

function sponsorTelegramUrl(message: string) {
  return `https://t.me/${DEVELOPER_TELEGRAM}?text=${encodeURIComponent(message)}`;
}

type SponsorOption = {
  key: string;
  icon: typeof Server;
  titleKey: "sponsorServerTitle" | "sponsorDomainTitle" | "sponsorAiTitle";
  descKey: "sponsorServerDesc" | "sponsorDomainDesc" | "sponsorAiDesc";
  priceKey: "sponsorServerPrice" | "sponsorDomainPrice" | "sponsorAiPrice";
  priceEtbKey: "sponsorServerPriceEtb" | "sponsorDomainPriceEtb" | "sponsorAiPriceEtb";
  messageKey: "sponsorServerMessage" | "sponsorDomainMessage" | "sponsorAiMessage";
};

const SPONSOR_OPTIONS: SponsorOption[] = [
  {
    key: "server",
    icon: Server,
    titleKey: "sponsorServerTitle",
    descKey: "sponsorServerDesc",
    priceKey: "sponsorServerPrice",
    priceEtbKey: "sponsorServerPriceEtb",
    messageKey: "sponsorServerMessage",
  },
  {
    key: "domain",
    icon: Globe,
    titleKey: "sponsorDomainTitle",
    descKey: "sponsorDomainDesc",
    priceKey: "sponsorDomainPrice",
    priceEtbKey: "sponsorDomainPriceEtb",
    messageKey: "sponsorDomainMessage",
  },
  {
    key: "ai",
    icon: Bot,
    titleKey: "sponsorAiTitle",
    descKey: "sponsorAiDesc",
    priceKey: "sponsorAiPrice",
    priceEtbKey: "sponsorAiPriceEtb",
    messageKey: "sponsorAiMessage",
  },
];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function SponsorAppDialog({ open, onOpenChange }: Props) {
  const { t } = useI18n();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm gap-0 overflow-hidden rounded-2xl border-primary/20 p-0 sm:max-w-md">
        <div className="bg-gradient-to-br from-primary/15 via-primary/5 to-transparent px-6 pb-4 pt-6">
          <DialogHeader className="space-y-2 text-center sm:text-left">
            <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary/10 sm:mx-0">
              <Heart className="size-6 text-primary" />
            </div>
            <DialogTitle className="text-lg font-bold leading-snug">{t("sponsorApp")}</DialogTitle>
            <DialogDescription className="text-sm leading-relaxed">{t("sponsorAppDesc")}</DialogDescription>
          </DialogHeader>
        </div>

        <div className="space-y-2 px-6 py-4">
          {SPONSOR_OPTIONS.map((option) => {
            const Icon = option.icon;
            return (
              <a
                key={option.key}
                href={sponsorTelegramUrl(t(option.messageKey))}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-xl border border-border/60 bg-muted/20 p-3 transition-colors hover:border-primary/30 hover:bg-primary/5"
              >
                <div className="flex items-start gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Icon className="size-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-0.5">
                      <p className="font-semibold leading-snug">{t(option.titleKey)}</p>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-medium text-primary">{t(option.priceKey)}</p>
                        <p className="text-[10px] leading-tight text-muted-foreground">{t(option.priceEtbKey)}</p>
                      </div>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t(option.descKey)}</p>
                  </div>
                </div>
              </a>
            );
          })}
        </div>

        <div className="mx-6 mb-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2.5">
          <p className="text-center text-xs leading-relaxed text-muted-foreground">{t("sponsorCharityNote")}</p>
        </div>

        <div className="space-y-2 border-t border-border/60 bg-muted/10 px-6 py-4">
          <p className="text-center text-sm leading-relaxed text-muted-foreground">{t("sponsorContactDev")}</p>
          <Button asChild className="w-full">
            <a href={sponsorTelegramUrl(t("sponsorContactMessage"))} target="_blank" rel="noopener noreferrer">
              {t("sponsorContactCta")}
            </a>
          </Button>
          <Button asChild variant="ghost" className="w-full text-muted-foreground">
            <a href={DEVELOPER_SITE} target="_blank" rel="noopener noreferrer">
              Abdulfetah Jemal
            </a>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
