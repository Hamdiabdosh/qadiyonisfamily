import { Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  emptyChildrenBucket,
  nextBucketBirthOrder,
  type ChildrenBucket,
  type FormChildEntry,
} from "@/lib/children-by-mother";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type AliveChoice = "alive" | "dead" | null;

function hasAliveChosen(alive: AliveChoice): alive is "alive" | "dead" {
  return alive === "alive" || alive === "dead";
}

const compactNameClass = "h-8 text-xs px-2 py-1 rounded-lg";
const addMoreBtnClass =
  "w-full border-0 bg-none bg-out-alive font-semibold text-out-alive-foreground shadow-md shadow-out-alive/25 hover:bg-out-alive/90 hover:brightness-105";

function BirthOrderInput({
  value,
  onChange,
  id,
  label,
}: {
  value: number;
  onChange: (n: number) => void;
  id: string;
  label: string;
}) {
  return (
    <input
      id={id}
      type="number"
      min={1}
      max={99}
      required
      inputMode="numeric"
      aria-label={label}
      value={value > 0 ? value : ""}
      onChange={(e) => {
        const parsed = parseInt(e.target.value, 10);
        onChange(Number.isFinite(parsed) && parsed > 0 ? parsed : 0);
      }}
      className="size-7 shrink-0 rounded-full border-2 border-primary/50 bg-background text-center text-xs font-bold text-primary shadow-sm [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
    />
  );
}

function AliveToggle({
  value,
  onChange,
  idPrefix,
  highlight,
}: {
  value: AliveChoice;
  onChange: (v: "alive" | "dead") => void;
  idPrefix: string;
  highlight?: boolean;
}) {
  const { t } = useI18n();
  const btnBase =
    "w-full rounded-lg border px-4 py-1 text-sm font-medium transition-all duration-200 text-center";
  const toggle = (
    <div className="flex w-full items-start gap-2">
      <button
        type="button"
        id={`${idPrefix}-alive`}
        onClick={() => onChange("alive")}
        className={cn(
          btnBase,
          "flex-1",
          value === "alive"
            ? "border-kin-alive/60 bg-kin-alive text-kin-alive-foreground shadow-sm"
            : "border-border/60 bg-transparent text-muted-foreground hover:border-border hover:text-foreground",
        )}
      >
        {t("alive")}
      </button>
      <div className="flex flex-1 flex-col items-stretch">
        <button
          type="button"
          id={`${idPrefix}-dead`}
          onClick={() => onChange("dead")}
          className={cn(
            btnBase,
            value === "dead"
              ? "border-destructive/60 bg-destructive text-destructive-foreground shadow-sm"
              : "border-border/60 bg-transparent text-muted-foreground hover:border-border hover:text-foreground",
          )}
        >
          {t("dead")}
        </button>
      </div>
    </div>
  );

  if (!highlight) return toggle;
  return <div className="alive-required-glow p-0.5">{toggle}</div>;
}

type Props = {
  namedMothers: { name: string }[];
  childrenByMother: Record<number, ChildrenBucket>;
  setChildrenByMother: React.Dispatch<React.SetStateAction<Record<number, ChildrenBucket>>>;
  activeMotherTab: string;
  onActiveMotherTabChange: (tab: string) => void;
  idPrefix?: string;
  /** Compact admin layout for pending submission card */
  variant?: "form" | "admin";
};

export function ChildrenByMotherSection({
  namedMothers,
  childrenByMother,
  setChildrenByMother,
  activeMotherTab,
  onActiveMotherTabChange,
  idPrefix = "child",
  variant = "form",
}: Props) {
  const { t } = useI18n();
  const showMotherTabs = namedMothers.length > 1;
  const tab = Number(activeMotherTab);
  const bucket = childrenByMother[tab] ?? emptyChildrenBucket();
  const sons = bucket.sons;
  const daughters = bucket.daughters;

  const updateBucket = (updater: (b: ChildrenBucket) => ChildrenBucket) => {
    setChildrenByMother((prev) => ({
      ...prev,
      [tab]: updater(prev[tab] ?? emptyChildrenBucket()),
    }));
  };

  const setSons = (updater: FormChildEntry[] | ((prev: FormChildEntry[]) => FormChildEntry[])) => {
    updateBucket((b) => ({
      ...b,
      sons: typeof updater === "function" ? updater(b.sons) : updater,
    }));
  };

  const setDaughters = (updater: FormChildEntry[] | ((prev: FormChildEntry[]) => FormChildEntry[])) => {
    updateBucket((b) => ({
      ...b,
      daughters: typeof updater === "function" ? updater(b.daughters) : updater,
    }));
  };

  const aliveToggle = (
    value: AliveChoice,
    onChange: (v: "alive" | "dead") => void,
    childId: string,
    named: boolean,
  ) => {
    if (variant === "admin") {
      return (
        <label className="flex items-center gap-1 text-[10px]">
          <input
            type="checkbox"
            checked={value === "alive"}
            onChange={(e) => onChange(e.target.checked ? "alive" : "dead")}
          />
          Alive
        </label>
      );
    }
    return (
      <AliveToggle
        value={value}
        onChange={onChange}
        idPrefix={childId}
        highlight={named && !hasAliveChosen(value)}
      />
    );
  };

  if (variant === "admin") {
    return (
      <div className="space-y-3">
        {showMotherTabs ? (
          <>
            <p className="text-xs font-medium text-primary">{t("childrenMotherTabHint")}</p>
            <Tabs value={activeMotherTab} onValueChange={onActiveMotherTabChange}>
              <TabsList className="flex h-auto min-h-10 w-full flex-wrap justify-start gap-1">
                {namedMothers.map((m, i) => (
                  <TabsTrigger key={i} value={String(i)} className="max-w-[140px] truncate text-xs">
                    {m.name.trim()}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </>
        ) : null}
        <div className="space-y-2">
          {sons.map((s, i) => (
            <div key={`s-${i}`} className="grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-2 rounded-lg border p-2">
              <Input
                type="number"
                min={1}
                className="w-14"
                value={s.birthOrder}
                onChange={(e) => {
                  const n = parseInt(e.target.value, 10);
                  setSons((p) => p.map((x, ix) => (ix === i ? { ...x, birthOrder: Number.isFinite(n) && n > 0 ? n : 1 } : x)));
                }}
              />
              <Input
                value={s.name}
                placeholder="Name"
                onChange={(e) => setSons((p) => p.map((x, ix) => (ix === i ? { ...x, name: e.target.value } : x)))}
              />
              <span className="text-[10px] text-muted-foreground">Son</span>
              {aliveToggle(s.alive, (v) => setSons((p) => p.map((x, ix) => (ix === i ? { ...x, alive: v } : x))), `son-${i}`, Boolean(s.name.trim()))}
              <button type="button" onClick={() => setSons((p) => p.filter((_, ix) => ix !== i))}>
                <X className="size-4 text-muted-foreground" />
              </button>
            </div>
          ))}
          {daughters.map((d, i) => (
            <div key={`d-${i}`} className="grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-2 rounded-lg border p-2">
              <Input
                type="number"
                min={1}
                className="w-14"
                value={d.birthOrder}
                onChange={(e) => {
                  const n = parseInt(e.target.value, 10);
                  setDaughters((p) => p.map((x, ix) => (ix === i ? { ...x, birthOrder: Number.isFinite(n) && n > 0 ? n : 1 } : x)));
                }}
              />
              <Input
                value={d.name}
                placeholder="Name"
                onChange={(e) => setDaughters((p) => p.map((x, ix) => (ix === i ? { ...x, name: e.target.value } : x)))}
              />
              <span className="text-[10px] text-muted-foreground">Daughter</span>
              {aliveToggle(d.alive, (v) => setDaughters((p) => p.map((x, ix) => (ix === i ? { ...x, alive: v } : x))), `dau-${i}`, Boolean(d.name.trim()))}
              <button type="button" onClick={() => setDaughters((p) => p.filter((_, ix) => ix !== i))}>
                <X className="size-4 text-muted-foreground" />
              </button>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              setSons((p) => [
                ...p,
                { name: "", alive: "alive", gender: "male", birthOrder: nextBucketBirthOrder(bucket) },
              ])
            }
          >
            <Plus className="size-3 mr-1" /> Add son
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              setDaughters((p) => [
                ...p,
                { name: "", alive: "alive", gender: "female", birthOrder: nextBucketBirthOrder(bucket) },
              ])
            }
          >
            <Plus className="size-3 mr-1" /> Add daughter
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      {showMotherTabs ? (
        <p className="mb-3 text-xs font-medium text-primary">{t("childrenMotherTabHint")}</p>
      ) : null}
      {showMotherTabs ? (
        <Tabs value={activeMotherTab} onValueChange={onActiveMotherTabChange} className="mb-3">
          <TabsList className="flex h-auto min-h-10 w-full flex-wrap justify-start gap-1">
            {namedMothers.map((m, i) => (
              <TabsTrigger key={i} value={String(i)} className="max-w-[140px] truncate text-xs">
                {m.name.trim()}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      ) : null}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-3">
          <Label className="text-xs">👦 {t("sons")}</Label>
          {sons.map((s, i) => (
            <div key={i} className="space-y-1.5">
              <div className="flex items-start gap-1.5">
                <BirthOrderInput
                  id={`${idPrefix}-son-order-${tab}-${i}`}
                  label={t("birthOrder")}
                  value={s.birthOrder}
                  onChange={(n) => setSons((p) => p.map((x, ix) => (ix === i ? { ...x, birthOrder: n } : x)))}
                />
                <Input
                  className={cn("min-w-0 flex-1", compactNameClass)}
                  value={s.name}
                  placeholder={t("son")}
                  onChange={(e) => setSons((p) => p.map((x, ix) => (ix === i ? { ...x, name: e.target.value } : x)))}
                />
                {sons.length > 1 && (
                  <button type="button" onClick={() => setSons((p) => p.filter((_, ix) => ix !== i))}>
                    <X className="size-4 text-muted-foreground" />
                  </button>
                )}
              </div>
              {aliveToggle(
                s.alive,
                (v) => setSons((p) => p.map((x, ix) => (ix === i ? { ...x, alive: v } : x))),
                `${idPrefix}-son-${tab}-${i}`,
                Boolean(s.name.trim()),
              )}
            </div>
          ))}
          <Button
            type="button"
            size="sm"
            className={addMoreBtnClass}
            onClick={() =>
              setSons((p) => [
                ...p,
                { name: "", alive: null, gender: "male", birthOrder: nextBucketBirthOrder(bucket) },
              ])
            }
          >
            {t("addAnotherSon")}
          </Button>
        </div>
        <div className="space-y-3">
          <Label className="text-xs">👧 {t("daughters")}</Label>
          {daughters.map((d, i) => (
            <div key={i} className="space-y-1.5">
              <div className="flex items-start gap-1.5">
                <BirthOrderInput
                  id={`${idPrefix}-daughter-order-${tab}-${i}`}
                  label={t("birthOrder")}
                  value={d.birthOrder}
                  onChange={(n) => setDaughters((p) => p.map((x, ix) => (ix === i ? { ...x, birthOrder: n } : x)))}
                />
                <Input
                  className={cn("min-w-0 flex-1", compactNameClass)}
                  value={d.name}
                  placeholder={t("daughter")}
                  onChange={(e) => setDaughters((p) => p.map((x, ix) => (ix === i ? { ...x, name: e.target.value } : x)))}
                />
                {daughters.length > 1 && (
                  <button type="button" onClick={() => setDaughters((p) => p.filter((_, ix) => ix !== i))}>
                    <X className="size-4 text-muted-foreground" />
                  </button>
                )}
              </div>
              {aliveToggle(
                d.alive,
                (v) => setDaughters((p) => p.map((x, ix) => (ix === i ? { ...x, alive: v } : x))),
                `${idPrefix}-dau-${tab}-${i}`,
                Boolean(d.name.trim()),
              )}
            </div>
          ))}
          <Button
            type="button"
            size="sm"
            className={addMoreBtnClass}
            onClick={() =>
              setDaughters((p) => [
                ...p,
                { name: "", alive: null, gender: "female", birthOrder: nextBucketBirthOrder(bucket) },
              ])
            }
          >
            {t("addAnotherDaughter")}
          </Button>
        </div>
      </div>
    </>
  );
}
