import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";

import { getTranslationsFn } from "@/lib/api/explore.functions";
import { BASE_DICTS, BASE_EN, buildMergedDict, type TranslationKey } from "@/lib/i18n-dicts";

export type Lang = "en" | "am";

function normalizeLang(stored: string | null): Lang {
  if (stored === "am") return "am";
  return "en";
}

type Ctx = { lang: Lang; t: (k: TranslationKey) => string; setLang: (l: Lang) => void };
const I18nCtx = createContext<Ctx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    if (typeof window === "undefined") return "en";
    return normalizeLang(localStorage.getItem("lang"));
  });

  const { data: overrides = {} } = useQuery({
    queryKey: ["translations"],
    queryFn: getTranslationsFn,
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem("lang", lang);
    if (typeof document !== "undefined") document.documentElement.lang = lang;
  }, [lang]);

  const dict = useMemo(() => buildMergedDict(lang, overrides), [lang, overrides]);

  const t = useMemo(
    () => (k: TranslationKey) => dict[k] ?? BASE_DICTS[lang][k] ?? BASE_EN[k] ?? String(k),
    [dict, lang],
  );

  const value = useMemo(() => ({ lang, setLang: setLangState, t }), [lang, t]);

  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nCtx);
  if (!ctx) throw new Error("useI18n outside I18nProvider");
  return ctx;
}
