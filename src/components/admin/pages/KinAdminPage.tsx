import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ExternalLink, Search } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/StatusBadge";
import { getSettingsFn, updateSettingsFn } from "@/lib/api/content.functions";
import {
  DEFAULT_KIN_PAGE_CONFIG,
  enabledKinTabs,
  normalizeKinPageConfig,
  parseKinPageConfig,
  resolveKinDefaultTab,
  serializeKinPageConfig,
  type KinPageConfig,
  type KinPageTab,
} from "@/lib/kin-page-config";
import type { AdminData } from "../types";

type Props = {
  data: AdminData;
};

export function KinAdminPage({ data }: Props) {
  const qc = useQueryClient();
  const { data: settings = {} } = useQuery({ queryKey: ["admin", "settings"], queryFn: getSettingsFn });
  const [config, setConfig] = useState<KinPageConfig>(DEFAULT_KIN_PAGE_CONFIG);
  const [saving, setSaving] = useState(false);
  const [memberQuery, setMemberQuery] = useState("");

  const approved = data.approved;

  useEffect(() => {
    setConfig(parseKinPageConfig(settings.kin_page_config));
  }, [settings.kin_page_config]);

  const stats = useMemo(
    () => ({
      total: approved.length,
      kin: approved.filter((m) => m.is_in_kin).length,
      out: approved.filter((m) => !m.is_in_kin).length,
      alive: approved.filter((m) => m.is_alive).length,
    }),
    [approved],
  );

  const visibleTabs = enabledKinTabs(config);

  const directoryMembers = useMemo(() => {
    const q = memberQuery.trim().toLowerCase();
    return approved
      .filter((m) => {
        if (!q) return true;
        return (
          m.full_name.toLowerCase().includes(q) ||
          (m.current_location ?? "").toLowerCase().includes(q)
        );
      })
      .slice(0, 40);
  }, [approved, memberQuery]);

  const save = async () => {
    const normalized = normalizeKinPageConfig(config);
    setSaving(true);
    try {
      await updateSettingsFn({ data: { kin_page_config: serializeKinPageConfig(normalized) } });
      setConfig(normalized);
      toast.success("Kin page settings saved");
      qc.invalidateQueries({ queryKey: ["admin", "settings"] });
      qc.invalidateQueries({ queryKey: ["public-settings"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  };

  const setTab = (defaultTab: KinPageTab) => setConfig((c) => ({ ...c, defaultTab }));

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="grid gap-3 sm:grid-cols-4">
        {[
          { label: "Listed members", value: stats.total },
          { label: "In kin", value: stats.kin },
          { label: "Out of kin", value: stats.out },
          { label: "Alive", value: stats.alive },
        ].map((item) => (
          <Card key={item.label} variant="stat">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-primary">{item.value}</p>
              <p className="text-[10px] text-muted-foreground">{item.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Kin directory page</CardTitle>
          <CardDescription>
            Control the public Kin page layout. Member records are approved and edited under Family
            and Approval.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Page title override</Label>
            <Input
              value={config.pageTitle}
              onChange={(e) => setConfig((c) => ({ ...c, pageTitle: e.target.value }))}
              placeholder="Leave empty to use default translation"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Page description</Label>
            <Textarea
              value={config.pageDescription}
              onChange={(e) => setConfig((c) => ({ ...c, pageDescription: e.target.value }))}
              placeholder="Optional intro shown below the title"
              rows={3}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Default tab</Label>
            <Select
              value={resolveKinDefaultTab(config)}
              onValueChange={(v) => setTab(v as KinPageTab)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {visibleTabs.map((tab) => (
                  <SelectItem key={tab} value={tab}>
                    {tab === "lineage" ? "By lineage" : tab === "location" ? "By location" : "By generation"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {visibleTabs.length === 0 ? (
              <p className="text-xs text-destructive">Enable at least one tab below.</p>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                ["showSearch", "Search bar"],
                ["showFilters", "Filter chips (all / kin / out / alive)"],
                ["showLineageTab", "By lineage tab"],
                ["showLocationTab", "By location tab"],
                ["showGenerationTab", "By generation tab"],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="flex items-center justify-between rounded-lg border p-3">
                <span className="text-sm">{label}</span>
                <Switch
                  checked={config[key]}
                  onCheckedChange={(checked) =>
                    setConfig((c) => normalizeKinPageConfig({ ...c, [key]: checked }))
                  }
                />
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={save} disabled={saving || visibleTabs.length === 0}>
              Save Kin page settings
            </Button>
            <Button asChild variant="outline">
              <a href="/kin" target="_blank" rel="noopener noreferrer">
                <ExternalLink className="size-4 mr-2" />
                Preview Kin page
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Directory members</CardTitle>
          <CardDescription>
            Approved members shown on the Kin page ({stats.total} total). Edit kin status, location,
            and lineage from Family management.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={memberQuery}
              onChange={(e) => setMemberQuery(e.target.value)}
              placeholder="Search by name or location"
              className="pl-8"
            />
          </div>

          {directoryMembers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No approved members match this search.</p>
          ) : (
            <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
              {directoryMembers.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-border/60 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{m.full_name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      Gen {m.generation_level} • {m.current_location || "—"}
                    </p>
                  </div>
                  <StatusBadge m={m} />
                </div>
              ))}
            </div>
          )}

          {approved.length > directoryMembers.length && memberQuery.trim() === "" ? (
            <p className="text-xs text-muted-foreground">
              Showing first {directoryMembers.length} of {approved.length} members.
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2 border-t pt-3">
            <Button asChild variant="outline" size="sm">
              <Link to="/admin" search={{ view: "approval" }}>
                Pending approvals
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/admin" search={{ view: "family" }}>
                Manage family
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link to="/admin" search={{ view: "tree" }}>
                Family tree
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
