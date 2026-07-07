import { ChevronDown, ChevronUp } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  assignSequentialBirthOrder,
  buildOrderedChildDrafts,
  motherLabelForIndex,
  type OrderedChildDraft,
} from "@/lib/sibling-order";
import type { SubmitFamilyChild } from "@/lib/family";
import { useI18n } from "@/lib/i18n";

type Props = {
  children: SubmitFamilyChild[];
  motherNames: string[];
  ordered: OrderedChildDraft[];
  onChange: (ordered: OrderedChildDraft[]) => void;
};

export function SiblingOrderReview({ children, motherNames, ordered, onChange }: Props) {
  const { t } = useI18n();
  const named = children.filter((c) => c.name.trim());

  if (named.length < 2) return null;

  function move(index: number, dir: -1 | 1) {
    const next = [...ordered];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(assignSequentialBirthOrder(next));
  }

  function resetOrder() {
    onChange(buildOrderedChildDrafts(assignSequentialBirthOrder(named)));
  }

  return (
    <div className="space-y-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
      <div>
        <Label className="text-sm font-medium">{t("siblingOrderTitle")}</Label>
        <p className="mt-1 text-xs text-muted-foreground">{t("siblingOrderHint")}</p>
      </div>
      <ol className="space-y-2">
        {ordered.map((child, index) => (
          <li
            key={child.key}
            className="flex items-center gap-2 rounded-lg border bg-background px-2 py-1.5 text-sm"
          >
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
              {index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{child.name}</p>
              <p className="truncate text-[10px] text-muted-foreground">
                {child.gender === "male" ? t("son") : t("daughter")} ·{" "}
                {motherLabelForIndex(motherNames, child.motherIndex)}
              </p>
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
        ))}
      </ol>
      <Button type="button" size="sm" variant="outline" onClick={resetOrder}>
        {t("siblingOrderReset")}
      </Button>
    </div>
  );
}
