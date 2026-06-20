export type KinPageTab = "lineage" | "location" | "generation";

export type KinPageConfig = {
  pageTitle: string;
  pageDescription: string;
  defaultTab: KinPageTab;
  showSearch: boolean;
  showFilters: boolean;
  showLineageTab: boolean;
  showLocationTab: boolean;
  showGenerationTab: boolean;
};

export const DEFAULT_KIN_PAGE_CONFIG: KinPageConfig = {
  pageTitle: "",
  pageDescription: "",
  defaultTab: "lineage",
  showSearch: true,
  showFilters: true,
  showLineageTab: true,
  showLocationTab: true,
  showGenerationTab: true,
};

export function parseKinPageConfig(raw: string | undefined): KinPageConfig {
  if (!raw?.trim()) return { ...DEFAULT_KIN_PAGE_CONFIG };
  try {
    const parsed = JSON.parse(raw) as Partial<KinPageConfig>;
    const tab = parsed.defaultTab;
    const defaultTab: KinPageTab =
      tab === "location" || tab === "generation" ? tab : "lineage";
    return {
      pageTitle: String(parsed.pageTitle ?? "").trim(),
      pageDescription: String(parsed.pageDescription ?? "").trim(),
      defaultTab,
      showSearch: parsed.showSearch !== false,
      showFilters: parsed.showFilters !== false,
      showLineageTab: parsed.showLineageTab !== false,
      showLocationTab: parsed.showLocationTab !== false,
      showGenerationTab: parsed.showGenerationTab !== false,
    };
  } catch {
    return { ...DEFAULT_KIN_PAGE_CONFIG };
  }
}

export function serializeKinPageConfig(config: KinPageConfig): string {
  return JSON.stringify(normalizeKinPageConfig(config));
}

export function enabledKinTabs(config: KinPageConfig): KinPageTab[] {
  const tabs: KinPageTab[] = [];
  if (config.showLineageTab) tabs.push("lineage");
  if (config.showLocationTab) tabs.push("location");
  if (config.showGenerationTab) tabs.push("generation");
  return tabs;
}

export function resolveKinDefaultTab(config: KinPageConfig): KinPageTab {
  const tabs = enabledKinTabs(config);
  if (tabs.length === 0) return "lineage";
  if (tabs.includes(config.defaultTab)) return config.defaultTab;
  return tabs[0];
}

/** Ensure at least one tab is enabled and default tab points to a visible tab. */
export function normalizeKinPageConfig(config: KinPageConfig): KinPageConfig {
  let next = { ...config };
  if (!next.showLineageTab && !next.showLocationTab && !next.showGenerationTab) {
    next.showLineageTab = true;
  }
  next.defaultTab = resolveKinDefaultTab(next);
  return next;
}
