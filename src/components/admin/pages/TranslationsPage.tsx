import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  getTranslationsAdminFn,
  resetTranslationFn,
  upsertTranslationFn,
} from "@/lib/api/explore.functions";
import { I18N_LANGS, type AdminTranslationRow, type I18nLang } from "@/lib/i18n-dicts";
import { cn } from "@/lib/utils";

type RowEdits = Record<I18nLang, string>;

const LANG_LABELS: Record<I18nLang, string> = {
  en: "English",
  om: "Oromo",
  am: "Amharic",
};

function editsFromRow(row: AdminTranslationRow): RowEdits {
  return { en: row.en, om: row.om, am: row.am };
}

function rowIsDirty(row: AdminTranslationRow, edits: RowEdits): boolean {
  return I18N_LANGS.some((lang) => edits[lang] !== row[lang]);
}

type TranslationFieldProps = {
  lang: I18nLang;
  value: string;
  overridden: boolean;
  dirty: boolean;
  onChange: (value: string) => void;
  stacked?: boolean;
};

function TranslationField({ lang, value, overridden, dirty, onChange, stacked }: TranslationFieldProps) {
  return (
    <div className={cn("min-w-0", stacked && "space-y-1.5")}>
      {stacked ? <Label className="text-xs text-muted-foreground">{LANG_LABELS[lang]}</Label> : null}
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={stacked ? 3 : 2}
        aria-label={stacked ? undefined : `${LANG_LABELS[lang]} translation`}
        className={cn(
          "min-h-[56px] w-full resize-y text-sm",
          overridden && "border-primary/40 bg-primary/5",
          dirty && "border-amber-500/50",
        )}
      />
    </div>
  );
}

type RowActionsProps = {
  dirty: boolean;
  hasOverrides: boolean;
  busy: boolean;
  onSave: () => void;
  onReset: () => void;
  compact?: boolean;
};

function RowActions({ dirty, hasOverrides, busy, onSave, onReset, compact }: RowActionsProps) {
  return (
    <div className={cn("flex gap-2", compact ? "flex-row" : "flex-col")}>
      <Button
        size="sm"
        disabled={busy || !dirty}
        onClick={onSave}
        className={cn(compact && "flex-1")}
      >
        <Save className="size-3.5" />
        Save
      </Button>
      <Button
        size="sm"
        variant="outline"
        disabled={busy || (!dirty && !hasOverrides)}
        onClick={onReset}
        className={cn(compact && "flex-1")}
      >
        <RotateCcw className="size-3.5" />
        Reset
      </Button>
    </div>
  );
}

type TranslationRowEditorProps = {
  row: AdminTranslationRow;
  current: RowEdits;
  dirty: boolean;
  hasOverrides: boolean;
  busy: boolean;
  onChange: (lang: I18nLang, value: string) => void;
  onSave: () => void;
  onReset: () => void;
};

function MobileTranslationCard({
  row,
  current,
  dirty,
  hasOverrides,
  busy,
  onChange,
  onSave,
  onReset,
}: TranslationRowEditorProps) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="space-y-1 border-b bg-muted/30 px-4 py-3">
        <CardTitle className="break-all font-mono text-sm leading-snug">{row.key}</CardTitle>
        {hasOverrides ? (
          <CardDescription className="text-xs">Has custom overrides</CardDescription>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4 px-4 py-4">
        {I18N_LANGS.map((lang) => (
          <TranslationField
            key={lang}
            lang={lang}
            value={current[lang]}
            overridden={row.overridden[lang]}
            dirty={current[lang] !== row[lang]}
            onChange={(value) => onChange(lang, value)}
            stacked
          />
        ))}
        <RowActions
          dirty={dirty}
          hasOverrides={hasOverrides}
          busy={busy}
          onSave={onSave}
          onReset={onReset}
          compact
        />
      </CardContent>
    </Card>
  );
}

export function TranslationsPage() {
  const qc = useQueryClient();
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin", "translations"],
    queryFn: getTranslationsAdminFn,
  });
  const [filter, setFilter] = useState("");
  const [edits, setEdits] = useState<Record<string, RowEdits>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  useEffect(() => {
    setEdits(Object.fromEntries(rows.map((row) => [row.key, editsFromRow(row)])));
  }, [rows]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => {
      const current = edits[row.key] ?? editsFromRow(row);
      return (
        row.key.toLowerCase().includes(q) ||
        I18N_LANGS.some((lang) => current[lang].toLowerCase().includes(q))
      );
    });
  }, [rows, filter, edits]);

  const overrideCount = useMemo(
    () => rows.reduce((sum, row) => sum + I18N_LANGS.filter((lang) => row.overridden[lang]).length, 0),
    [rows],
  );

  const updateCell = (key: string, lang: I18nLang, value: string) => {
    setEdits((prev) => ({
      ...prev,
      [key]: { ...(prev[key] ?? { en: "", om: "", am: "" }), [lang]: value },
    }));
  };

  const saveRow = async (row: AdminTranslationRow) => {
    const current = edits[row.key] ?? editsFromRow(row);
    if (!I18N_LANGS.every((lang) => current[lang].trim())) {
      toast.error("All three languages need a value");
      return;
    }

    setSavingKey(row.key);
    try {
      await Promise.all(
        I18N_LANGS.map((lang) =>
          upsertTranslationFn({
            data: { key: row.key, lang, value: current[lang].trim() },
          }),
        ),
      );
      toast.success(`Saved "${row.key}"`);
      await qc.invalidateQueries({ queryKey: ["admin", "translations"] });
      await qc.invalidateQueries({ queryKey: ["translations"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save translation");
    } finally {
      setSavingKey(null);
    }
  };

  const resetRow = async (row: AdminTranslationRow) => {
    const langsToReset = I18N_LANGS.filter((lang) => row.overridden[lang]);
    if (langsToReset.length === 0) {
      setEdits((prev) => ({ ...prev, [row.key]: row.defaults }));
      return;
    }

    setSavingKey(row.key);
    try {
      await Promise.all(
        langsToReset.map((lang) => resetTranslationFn({ data: { key: row.key, lang } })),
      );
      toast.success(`Reset "${row.key}" to defaults`);
      await qc.invalidateQueries({ queryKey: ["admin", "translations"] });
      await qc.invalidateQueries({ queryKey: ["translations"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not reset translation");
    } finally {
      setSavingKey(null);
    }
  };

  const emptyState = (
    <p className="py-8 text-center text-sm text-muted-foreground">
      {isLoading ? "Loading translations…" : "No translations match your search."}
    </p>
  );

  return (
    <div className="min-w-0 space-y-4">
      <Card>
        <CardHeader className="px-4 pb-3 pt-4 sm:px-6">
          <CardTitle className="text-base">App translations</CardTitle>
          <CardDescription className="text-pretty">
            Edit every UI string in English, Oromo, and Amharic. {rows.length} keys total
            {overrideCount > 0 ? ` · ${overrideCount} custom override${overrideCount === 1 ? "" : "s"}` : ""}.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4 pb-4 sm:px-6">
          <div className="space-y-1.5">
            <Label htmlFor="translation-filter">Search keys or text</Label>
            <Input
              id="translation-filter"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="e.g. addFamily, Biyya Alaa, feedback…"
              className="w-full"
            />
          </div>
        </CardContent>
      </Card>

      {/* Mobile: stacked cards */}
      <div className="space-y-3 md:hidden">
        {filtered.length === 0
          ? emptyState
          : filtered.map((row) => {
              const current = edits[row.key] ?? editsFromRow(row);
              const dirty = rowIsDirty(row, current);
              const hasOverrides = I18N_LANGS.some((lang) => row.overridden[lang]);
              const busy = savingKey === row.key;

              return (
                <MobileTranslationCard
                  key={row.key}
                  row={row}
                  current={current}
                  dirty={dirty}
                  hasOverrides={hasOverrides}
                  busy={busy}
                  onChange={(lang, value) => updateCell(row.key, lang, value)}
                  onSave={() => void saveRow(row)}
                  onReset={() => void resetRow(row)}
                />
              );
            })}
      </div>

      {/* Desktop: wide table */}
      <Card className="hidden min-w-0 md:block">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 z-10 w-[180px] bg-background">Key</TableHead>
                  {I18N_LANGS.map((lang) => (
                    <TableHead key={lang} className="min-w-[220px]">
                      {LANG_LABELS[lang]}
                    </TableHead>
                  ))}
                  <TableHead className="w-[120px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5}>{emptyState}</TableCell>
                  </TableRow>
                ) : (
                  filtered.map((row) => {
                    const current = edits[row.key] ?? editsFromRow(row);
                    const dirty = rowIsDirty(row, current);
                    const hasOverrides = I18N_LANGS.some((lang) => row.overridden[lang]);
                    const busy = savingKey === row.key;

                    return (
                      <TableRow key={row.key}>
                        <TableCell className="sticky left-0 z-10 bg-background align-top">
                          <p className="break-all font-mono text-xs leading-snug">{row.key}</p>
                        </TableCell>
                        {I18N_LANGS.map((lang) => (
                          <TableCell key={lang} className="align-top">
                            <TranslationField
                              lang={lang}
                              value={current[lang]}
                              overridden={row.overridden[lang]}
                              dirty={current[lang] !== row[lang]}
                              onChange={(value) => updateCell(row.key, lang, value)}
                            />
                          </TableCell>
                        ))}
                        <TableCell className="align-top text-right">
                          <RowActions
                            dirty={dirty}
                            hasOverrides={hasOverrides}
                            busy={busy}
                            onSave={() => void saveRow(row)}
                            onReset={() => void resetRow(row)}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
