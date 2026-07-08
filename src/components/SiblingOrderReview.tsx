import { ChevronDown, ChevronUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  assignSequentialBirthOrder,
  assignSequentialDraftBirthOrder,
  buildOrderedChildDrafts,
  motherLabelForIndex,
  siblingItemIdentity,
  type OrderedSiblingItem,
} from "@/lib/sibling-order";
import type { SubmitFamilyChild } from "@/lib/family";
import { useI18n } from "@/lib/i18n";

type Props = {
  children: SubmitFamilyChild[];
  motherNames: string[];
  ordered: OrderedSiblingItem[];
  onChange: (ordered: OrderedSiblingItem[]) => void;
};

function itemLabel(item: OrderedSiblingItem, motherNames: string[], t: (key: string) => string) {
  if (item.kind === "existing") {
    return {
      name: item.name,
      subtitle: `${item.gender === "male" ? t("son") : t("daughter")}`,
      saved: true,
    };
  }

  return {
    name: item.draft.name,
    subtitle: `${item.draft.gender === "male" ? t("son") : t("daughter")} · ${motherLabelForIndex(motherNames, item.draft.motherIndex)}`,
    saved: false,
  };
}

export function SiblingOrderReview({ children, motherNames, ordered, onChange }: Props) {
  const { t } = useI18n();
  const named = children.filter((c) => c.name.trim());

  if (ordered.length < 2) return null;

  function move(index: number, dir: -1 | 1) {
    const next = [...ordered];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(assignSequentialDraftBirthOrder(next));
  }

  function resetOrder() {
    const existingItems = ordered.filter((item) => item.kind === "existing");
    const drafts = buildOrderedChildDrafts(assignSequentialBirthOrder(named));
    onChange([
      ...existingItems,
      ...drafts.map((draft) => ({ kind: "draft" as const, draft })),
    ]);
  }

  return (
    <div className="space-y-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
      <div>
        <Label className="text-sm font-medium">{t("siblingOrderTitle")}</Label>
        <p className="mt-1 text-xs text-muted-foreground">{t("siblingOrderHint")}</p>
      </div>
      <ol className="space-y-2">
        {ordered.map((item, index) => {
          const { name, subtitle, saved } = itemLabel(item, motherNames, t);
          return (
            <li
              key={siblingItemIdentity(item)}
              className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 text-sm ${
                saved ? "border-muted bg-muted/40" : "bg-background"
              }`}
            >
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-medium">{name}</p>
                  {saved ? (
                    <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      {t("siblingAlreadySaved")}
                    </span>
                  ) : null}
                </div>
                <p className="truncate text-[10px] text-muted-foreground">{subtitle}</p>
              </div>
              <div className="flex shrink-0 flex-col gap-0.5">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="size-7"
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                  aria-label={t("moveUp")}
                >
                  <ChevronUp className="size-4" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="size-7"
                  disabled={index === ordered.length - 1}
                  onClick={() => move(index, 1)}
                  aria-label={t("moveDown")}
                >
                  <ChevronDown className="size-4" />
                </Button>
              </div>
            </li>
          );
        })}
      </ol>
      <Button type="button" size="sm" variant="outline" onClick={resetOrder}>
        {t("siblingOrderReset")}
      </Button>
    </div>
  );
}
