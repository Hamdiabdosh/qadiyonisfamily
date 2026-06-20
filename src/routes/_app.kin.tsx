import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, ChevronRight, ChevronDown, MapPin, GitBranch, Users } from "lucide-react";

import { AppHeader } from "@/components/AppHeader";
import { PageTitleRow } from "@/components/PageTitleRow";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { getPublicSettingsFn } from "@/lib/api/content.functions";
import { fetchAllMembers, sortMembersByBirthOrder, type Member } from "@/lib/family";
import { DEFAULT_KIN_PAGE_CONFIG, resolveKinDefaultTab } from "@/lib/kin-page-config";
import { buildMap, shortestRelation } from "@/lib/lineage";
import { useI18n } from "@/lib/i18n";
import { StatusBadge } from "@/components/StatusBadge";
import { LineageDialog } from "./_app.tree";

export const Route = createFileRoute("/_app/kin")({ ssr: false, component: KinPage });

type Filter = "all" | "kin" | "out" | "alive";

function KinPage() {
  const { t } = useI18n();
  const { data: members = [] } = useQuery({ queryKey: ["members", "approved"], queryFn: () => fetchAllMembers(false) });
  const { data: settings } = useQuery({ queryKey: ["public-settings"], queryFn: getPublicSettingsFn });
  const kinConfig = settings?.kin_page_config ?? DEFAULT_KIN_PAGE_CONFIG;
  const activeTab = useMemo(() => resolveKinDefaultTab(kinConfig), [kinConfig]);
  const byId = useMemo(() => buildMap(members), [members]);

  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<Member | null>(null);
  const [lineageOf, setLineageOf] = useState<Member | null>(null);
  const [relateTo, setRelateTo] = useState<Member | null>(null);

  const me = members.find((m) => m.full_name === "Current User");

  const filtered = useMemo(() => members.filter((m) => {
    if (q && !(m.full_name.toLowerCase().includes(q.toLowerCase())
      || (m.current_location ?? "").toLowerCase().includes(q.toLowerCase()))) return false;
    if (filter === "kin") return m.is_in_kin;
    if (filter === "out") return !m.is_in_kin;
    if (filter === "alive") return m.is_alive;
    return true;
  }), [members, q, filter]);

  return (
    <div>
      <AppHeader />
      <div className="page-content space-y-3 px-4 pb-4 pt-2">
        <PageTitleRow
          title={kinConfig.pageTitle || t("kinDirectory")}
          description={
            kinConfig.pageDescription ? (
              <p className="mt-2 text-sm text-muted-foreground">{kinConfig.pageDescription}</p>
            ) : null
          }
        />

        {kinConfig.showSearch ? (
          <div className="relative">
            <Search className="size-4 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`${t("search")} (${t("fullName")}, ${t("location")})`} className="pl-8" />
          </div>
        ) : null}

        {kinConfig.showFilters ? (
          <div className="flex gap-1 overflow-x-auto pb-1">
            {(["all", "kin", "out", "alive"] as Filter[]).map((f) => (
              <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)}>
                {f === "all" ? t("all") : f === "kin" ? t("kinOnly") : f === "out" ? t("outOnly") : t("aliveOnly")}
              </Button>
            ))}
          </div>
        ) : null}

        <Tabs key={activeTab} defaultValue={activeTab}>
          <TabsList
            className="grid w-full"
            style={{
              gridTemplateColumns: `repeat(${
                [kinConfig.showLineageTab, kinConfig.showLocationTab, kinConfig.showGenerationTab].filter(Boolean).length || 1
              }, minmax(0, 1fr))`,
            }}
          >
            {kinConfig.showLineageTab ? (
              <TabsTrigger value="lineage"><GitBranch className="size-3 mr-1" />{t("byLineage")}</TabsTrigger>
            ) : null}
            {kinConfig.showLocationTab ? (
              <TabsTrigger value="location"><MapPin className="size-3 mr-1" />{t("byLocation")}</TabsTrigger>
            ) : null}
            {kinConfig.showGenerationTab ? (
              <TabsTrigger value="generation"><Users className="size-3 mr-1" />{t("byGeneration")}</TabsTrigger>
            ) : null}
          </TabsList>

          {kinConfig.showLineageTab ? (
            <TabsContent value="lineage" className="mt-3">
              <LineageView members={filtered} byId={byId} onPick={setSelected} />
            </TabsContent>
          ) : null}
          {kinConfig.showLocationTab ? (
            <TabsContent value="location" className="mt-3">
              <LocationView members={filtered} onPick={setSelected} />
            </TabsContent>
          ) : null}
          {kinConfig.showGenerationTab ? (
            <TabsContent value="generation" className="mt-3">
              <GenerationView members={filtered} onPick={setSelected} />
            </TabsContent>
          ) : null}
        </Tabs>

        <Dialog open={!!selected} onOpenChange={(o) => { if (!o) setSelected(null); }}>
          <DialogContent className="max-w-sm">
            {selected && (
              <>
                <DialogHeader><DialogTitle>{selected.full_name}</DialogTitle></DialogHeader>
                <div className="space-y-2 text-sm">
                  <StatusBadge m={selected} />
                  <p><span className="text-muted-foreground">{t("generation")}:</span> {selected.generation_level}</p>
                  <p><span className="text-muted-foreground">{t("location")}:</span> {selected.current_location || "—"}</p>
                  <p><span className="text-muted-foreground">{t("father")}/{t("mother")}:</span> {(selected.father_id && byId.get(selected.father_id)?.full_name) || "—"} / {(selected.mother_id && byId.get(selected.mother_id)?.full_name) || "—"}</p>
                  {selected.notes ? <p className="text-xs italic text-muted-foreground">"{selected.notes}"</p> : null}
                  <div className="grid grid-cols-1 gap-2 pt-2">
                    <Link to="/tree"><Button size="sm" variant="outline" className="w-full">{t("viewInTree")}</Button></Link>
                  </div>
                  {!selected.is_root && (
                    <Button size="sm" variant="secondary" className="w-full" onClick={() => setLineageOf(selected)}>{t("viewLineage")}</Button>
                  )}
                  {me && me.id !== selected.id && (
                    <Button size="sm" variant="secondary" className="w-full" onClick={() => setRelateTo(selected)}>{t("howAmIRelated")}</Button>
                  )}
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        <LineageDialog person={lineageOf} byId={byId} onClose={() => setLineageOf(null)} />

        <Dialog open={!!relateTo} onOpenChange={(o) => { if (!o) setRelateTo(null); }}>
          <DialogContent className="max-w-sm">
            {relateTo && me && (() => {
              const path = shortestRelation(me.id, relateTo.id, byId);
              return (
                <>
                  <DialogHeader><DialogTitle>{t("howAmIRelated")}</DialogTitle></DialogHeader>
                  {path ? (
                    <p className="text-sm">{path.map((m) => m.full_name).join(" → ")}</p>
                  ) : <p className="text-sm text-muted-foreground">{t("noLink")}</p>}
                </>
              );
            })()}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

function PersonRow({ m, onPick, depth = 0 }: { m: Member; onPick: (m: Member) => void; depth?: number }) {
  const { t } = useI18n();
  return (
    <button onClick={() => onPick(m)}
      className="person-row w-full text-left flex items-center gap-2 py-1.5 px-2"
      style={{ paddingLeft: 8 + depth * 12 }}>
      <span className="text-sm flex-1 truncate">{m.full_name}</span>
      <span className="text-[10px] text-muted-foreground">{t("gen")} {m.generation_level}</span>
      <StatusBadge m={m} />
    </button>
  );
}

function LineageView({ members, byId, onPick }: { members: Member[]; byId: Map<number, Member>; onPick: (m: Member) => void }) {
  const childrenOf = useMemo(() => {
    const map = new Map<number, Member[]>();
    members.forEach((m) => {
      const p = m.father_id ?? m.mother_id;
      if (p == null) return;
      if (!map.has(p)) map.set(p, []);
      map.get(p)!.push(m);
    });
    return map;
  }, [members]);
  const root = members.find((m) => m.is_root);
  if (!root) return null;
  return (
    <Card><CardContent className="pt-3"><Node m={root} children={childrenOf} all={byId} onPick={onPick} depth={0} /></CardContent></Card>
  );
}

function Node({ m, children, all, onPick, depth }: { m: Member; children: Map<number, Member[]>; all: Map<number, Member>; onPick: (m: Member) => void; depth: number }) {
  const [open, setOpen] = useState(depth < 2);
  const kids = sortMembersByBirthOrder(children.get(m.id) ?? []);
  return (
    <div>
      <div className="flex items-center gap-1">
        {kids.length > 0 ? (
          <button onClick={() => setOpen((v) => !v)} className="text-muted-foreground">
            {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
          </button>
        ) : <span className="w-4" />}
        <div className="flex-1"><PersonRow m={m} onPick={onPick} depth={depth} /></div>
      </div>
      {open && kids.map((k) => <Node key={k.id} m={k} children={children} all={all} onPick={onPick} depth={depth + 1} />)}
    </div>
  );
}

function LocationView({ members, onPick }: { members: Member[]; onPick: (m: Member) => void }) {
  const byLoc = useMemo(() => {
    const map = new Map<string, Member[]>();
    members.forEach((m) => {
      const k = m.current_location?.trim() || "Unknown";
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(m);
    });
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [members]);
  const [open, setOpen] = useState<Set<string>>(new Set());
  return (
    <div className="space-y-2">
      {byLoc.map(([loc, list]) => (
        <Card key={loc}>
          <CardContent className="pt-3">
            <button className="flex items-center gap-2 w-full" onClick={() => setOpen((s) => { const n = new Set(s); n.has(loc) ? n.delete(loc) : n.add(loc); return n; })}>
              {open.has(loc) ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
              <MapPin className="size-4 text-out-alive" />
              <span className="font-medium text-sm flex-1 text-left">{loc}</span>
              <span className="text-xs text-muted-foreground">{list.length}</span>
            </button>
            {open.has(loc) && <div className="mt-2 space-y-1">{list.map((m) => <PersonRow key={m.id} m={m} onPick={onPick} />)}</div>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function GenerationView({ members, onPick }: { members: Member[]; onPick: (m: Member) => void }) {
  const { t } = useI18n();
  const byGen = useMemo(() => {
    const map = new Map<number, Member[]>();
    members.forEach((m) => {
      const g = m.generation_level || 1;
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(m);
    });
    return [...map.entries()].sort((a, b) => a[0] - b[0]);
  }, [members]);
  const [open, setOpen] = useState<Set<number>>(new Set([1, 2]));
  return (
    <div className="space-y-2">
      {byGen.map(([g, list]) => (
        <Card key={g}><CardContent className="pt-3">
          <button className="flex items-center gap-2 w-full" onClick={() => setOpen((s) => { const n = new Set(s); n.has(g) ? n.delete(g) : n.add(g); return n; })}>
            {open.has(g) ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
            <span className="font-medium text-sm flex-1 text-left">{t("gen")} {g}</span>
            <span className="text-xs text-muted-foreground">{list.length}</span>
          </button>
          {open.has(g) && <div className="mt-2 space-y-1">{list.map((m) => <PersonRow key={m.id} m={m} onPick={onPick} />)}</div>}
        </CardContent></Card>
      ))}
    </div>
  );
}
