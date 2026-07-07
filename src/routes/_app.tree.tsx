import { createFileRoute, Link } from "@tanstack/react-router";
import { memo, useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import ReactFlow, {
  Background,
  Controls,
  MarkerType,
  type Edge,
  type Node,
  type NodeProps,
  type ReactFlowInstance,
} from "reactflow";
import "reactflow/dist/style.css";
import { useQuery } from "@tanstack/react-query";
import { Search, Home as HomeIcon, Eye, EyeOff, X, Maximize2, User, Users, GitBranch } from "lucide-react";

import { AppHeader } from "@/components/AppHeader";
import { PageTitleRow } from "@/components/PageTitleRow";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

import { fetchAllMembers, fetchWives, statusOf, statusClass, type Member } from "@/lib/family";
import { buildMap, fatherChain, motherChain, chainReachesRoot } from "@/lib/lineage";
import { computeFamilyTreeLayout } from "@/lib/tree-layout";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { StatusBadge } from "@/components/StatusBadge";

export const Route = createFileRoute("/_app/tree")({ ssr: false, component: TreePage });

type MemberNodeData = {
  name: string;
  generation: number;
  status: keyof typeof statusClass;
  highlight: boolean;
  dimmed: boolean;
  selected: boolean;
  motherLabel?: string;
};

const LEGEND_ITEMS: { status: keyof typeof statusClass; labelKey: string }[] = [
  { status: "root", labelKey: "rootPerson" },
  { status: "kinAlive", labelKey: "kin" },
  { status: "kinDead", labelKey: "dead" },
  { status: "outAlive", labelKey: "outOfKin" },
];

const MemberNode = memo(function MemberNode({ data }: NodeProps<MemberNodeData>) {
  const { t } = useI18n();
  return (
    <div
      className={`min-w-[120px] cursor-pointer rounded-xl border px-2 py-1.5 text-center text-xs font-medium shadow-md transition-all duration-200 hover:scale-105 hover:shadow-lg ${statusClass[data.status]} ${data.dimmed ? "opacity-25 saturate-50" : ""} ${data.highlight ? "ring-4 ring-primary shadow-[0_0_20px_var(--glow-primary)]" : ""} ${data.selected ? "ring-4 ring-foreground/40" : ""}`}
    >
      <div className="truncate">{data.name}</div>
      {data.motherLabel ? (
        <div className="truncate text-[9px] font-normal opacity-75">
          {t("childOfMother")} {data.motherLabel}
        </div>
      ) : null}
      <div className="text-[10px] opacity-80">
        {t("gen")} {data.generation}
      </div>
    </div>
  );
});

const nodeTypes = { member: MemberNode };

function TreeLegend() {
  const { t } = useI18n();
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
      {LEGEND_ITEMS.map(({ status, labelKey }) => (
        <span key={status} className="inline-flex items-center gap-1">
          <span className={`size-2.5 rounded-full border ${statusClass[status]}`} />
          {t(labelKey)}
        </span>
      ))}
    </div>
  );
}

function TreePage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { data: members = [], isLoading } = useQuery({
    queryKey: ["members", "approved"],
    queryFn: () => fetchAllMembers(false),
  });
  const { data: wives = [] } = useQuery({ queryKey: ["wives"], queryFn: fetchWives });
  const byId = useMemo(() => buildMap(members), [members]);
  const flowRef = useRef<ReactFlowInstance | null>(null);

  const [showOut, setShowOut] = useState(true);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Member | null>(null);
  const [lineageOf, setLineageOf] = useState<Member | null>(null);

  const root = useMemo(() => members.find((m) => m.is_root), [members]);
  const me = useMemo(
    () => members.find((m) => m.full_name === user?.fullName),
    [members, user?.fullName],
  );

  const filtered = useMemo(() => members.filter((m) => showOut || m.is_in_kin), [members, showOut]);
  const stats = useMemo(
    () => ({
      total: members.length,
      kin: members.filter((m) => m.is_in_kin).length,
    }),
    [members],
  );

  const trimmedQuery = query.trim();
  const hasQuery = trimmedQuery.length > 0;

  const matchIds = useMemo(() => {
    const q = trimmedQuery.toLowerCase();
    if (!q) return new Set<number>();
    return new Set(filtered.filter((m) => m.full_name.toLowerCase().includes(q)).map((m) => m.id));
  }, [filtered, trimmedQuery]);

  const firstMatchId = useMemo(() => {
    if (matchIds.size === 0) return null;
    return filtered.find((m) => matchIds.has(m.id))?.id ?? null;
  }, [filtered, matchIds]);

  const layout = useMemo(
    () => computeFamilyTreeLayout(filtered, wives),
    [filtered, wives],
  );

  const fathersWithMultipleWives = useMemo(() => {
    const count = new Map<number, number>();
    for (const w of wives) {
      count.set(w.husband_id, (count.get(w.husband_id) ?? 0) + 1);
    }
    return new Set([...count.entries()].filter(([, n]) => n > 1).map(([id]) => id));
  }, [wives]);

  const flowNodes = useMemo(() => {
    const ns: Node<MemberNodeData>[] = [];
    for (const m of filtered) {
      const pos = layout.positions.get(m.id);
      if (!pos) continue;
      const motherLabel =
        m.father_id &&
        m.mother_id &&
        fathersWithMultipleWives.has(m.father_id)
          ? byId.get(m.mother_id)?.full_name
          : undefined;
      ns.push({
        id: String(m.id),
        type: "member",
        position: pos,
        data: {
          name: m.full_name,
          generation: m.generation_level,
          status: statusOf(m),
          highlight: matchIds.has(m.id),
          dimmed: hasQuery && !matchIds.has(m.id),
          selected: selected?.id === m.id,
          motherLabel,
        },
        style: { padding: 0, border: "none", background: "transparent" },
      });
    }
    return ns;
  }, [filtered, layout, matchIds, hasQuery, selected, byId, fathersWithMultipleWives]);

  const flowEdges = useMemo(() => {
    const memberIds = new Set(filtered.map((m) => m.id));
    const es: Edge[] = [];
    const dimEdges = hasQuery && matchIds.size > 0;

    for (const w of wives) {
      if (!memberIds.has(w.husband_id) || !memberIds.has(w.wife_id)) continue;
      es.push({
        id: `marriage-${w.husband_id}-${w.wife_id}`,
        source: String(w.husband_id),
        target: String(w.wife_id),
        type: "straight",
        style: { stroke: "var(--color-primary)", strokeWidth: 1.5, opacity: dimEdges ? 0.15 : 0.45 },
      });
    }

    filtered.forEach((m) => {
      if (m.father_id && memberIds.has(m.father_id)) {
        es.push({
          id: `f-${m.father_id}-${m.id}`,
          source: String(m.father_id),
          target: String(m.id),
          type: "smoothstep",
          markerEnd: { type: MarkerType.ArrowClosed },
          style: { stroke: "var(--color-kin-alive)", strokeWidth: 1.5, opacity: dimEdges && !matchIds.has(m.id) && !matchIds.has(m.father_id) ? 0.2 : 1 },
        });
      }
      if (m.mother_id && memberIds.has(m.mother_id)) {
        es.push({
          id: `m-${m.mother_id}-${m.id}`,
          source: String(m.mother_id),
          target: String(m.id),
          type: "smoothstep",
          markerEnd: { type: MarkerType.ArrowClosed },
          style: { stroke: "var(--color-out-alive)", strokeWidth: 1.5, strokeDasharray: "5 3", opacity: dimEdges && !matchIds.has(m.id) && !matchIds.has(m.mother_id) ? 0.2 : 1 },
        });
      }
    });
    return es;
  }, [filtered, wives, hasQuery, matchIds]);

  const focusNode = useCallback((id: number | null) => {
    const inst = flowRef.current;
    if (!inst || id == null) return;
    void inst.fitView({ nodes: [{ id: String(id) }], padding: 0.9, duration: 350, maxZoom: 1.2 });
  }, []);

  const fitAll = useCallback(() => {
    void flowRef.current?.fitView({ padding: 0.15, duration: 250 });
  }, []);

  const onInit = useCallback((instance: ReactFlowInstance) => {
    flowRef.current = instance;
    void instance.fitView({ padding: 0.15, duration: 200 });
  }, []);

  useEffect(() => {
    if (!hasQuery) return;
    focusNode(firstMatchId);
  }, [hasQuery, firstMatchId, focusNode]);

  const onNodeClick = useCallback(
    (_e: MouseEvent, n: Node<MemberNodeData>) => {
      const m = members.find((x) => String(x.id) === n.id);
      if (m) setSelected(m);
    },
    [members],
  );

  const goToRoot = useCallback(() => {
    if (root) {
      setQuery(root.full_name);
      focusNode(root.id);
    }
  }, [root, focusNode]);

  const goToMe = useCallback(() => {
    if (me) {
      setQuery(me.full_name);
      focusNode(me.id);
    }
  }, [me, focusNode]);

  return (
    <div>
      <AppHeader />
      <div className="page-content space-y-4 px-4 pb-4 pt-2">
        <PageTitleRow title={t("tree")} description={t("treeDescription")} />

        <div className="flex gap-3 text-sm">
          <div className="bg-card flex-1 rounded-xl border px-4 py-2.5 text-center">
            <p className="font-semibold text-primary">{stats.total}</p>
            <p className="text-xs text-muted-foreground">{t("totalMembers")}</p>
          </div>
          <div className="bg-card flex-1 rounded-xl border px-4 py-2.5 text-center">
            <p className="font-semibold text-emerald-600">{stats.kin}</p>
            <p className="text-xs text-muted-foreground">{t("kin")}</p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("treeSearchPlaceholder")}
              className="py-6 pl-10 pr-10 text-base"
            />
            {hasQuery ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={t("search")}
              >
                <X className="size-4" />
              </button>
            ) : null}
          </div>

          {hasQuery ? (
            <p className="text-xs text-muted-foreground">
              {matchIds.size > 0
                ? `${matchIds.size} ${t("treeResults")}`
                : t("noResults")}
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            {root ? (
              <Button variant="outline" size="sm" onClick={goToRoot} title={t("goToRoot")}>
                <HomeIcon className="size-4 sm:mr-1.5" />
                <span className="hidden sm:inline">{t("goToRoot")}</span>
              </Button>
            ) : null}
            {me ? (
              <Button variant="outline" size="sm" onClick={goToMe} title={t("focusOnMe")}>
                <User className="size-4 sm:mr-1.5" />
                <span className="hidden sm:inline">{t("focusOnMe")}</span>
              </Button>
            ) : null}
            <Button variant="outline" size="sm" onClick={fitAll} title={t("fitTree")}>
              <Maximize2 className="size-4 sm:mr-1.5" />
              <span className="hidden sm:inline">{t("fitTree")}</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowOut((v) => !v)}
              title={showOut ? t("hideOutOfKin") : t("showOutOfKin")}
            >
              {showOut ? <Eye className="size-4 sm:mr-1.5" /> : <EyeOff className="size-4 sm:mr-1.5" />}
              <span className="hidden sm:inline">{showOut ? t("hideOutOfKin") : t("showOutOfKin")}</span>
            </Button>
          </div>

          <TreeLegend />
        </div>

        <div className="tree-canvas relative h-[58vh] min-h-[300px]">
          {isLoading ? (
            <div className="flex h-full flex-col gap-3 p-4">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="flex-1 rounded-lg" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
              {t("noResults")}
            </div>
          ) : (
            <>
              <ReactFlow
                nodes={flowNodes}
                edges={flowEdges}
                nodeTypes={nodeTypes}
                nodesDraggable={false}
                nodesConnectable={false}
                elementsSelectable
                onInit={onInit}
                onNodeClick={onNodeClick}
                minZoom={0.12}
                maxZoom={2}
                proOptions={{ hideAttribution: true }}
              >
                <Background gap={24} />
                <Controls showInteractive={false} className="!shadow-md" />
              </ReactFlow>
              {hasQuery && matchIds.size === 0 ? (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/60 p-6 text-center text-sm text-muted-foreground backdrop-blur-[1px]">
                  {t("noResults")}
                </div>
              ) : null}
            </>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Button asChild variant="outline">
            <Link to="/kin">
              <Users className="mr-2 size-4" />
              {t("kinDirectory")}
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/home">
              <HomeIcon className="mr-2 size-4" />
              {t("home")}
            </Link>
          </Button>
        </div>

        <Dialog open={!!selected} onOpenChange={(o) => { if (!o) setSelected(null); }}>
          <DialogContent className="max-w-sm">
            {selected && (
              <>
                <DialogHeader>
                  <DialogTitle>{selected.full_name}</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 text-sm">
                  <StatusBadge m={selected} />
                  <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2">
                    <dt className="text-muted-foreground">{t("generation")}</dt>
                    <dd>{selected.generation_level}</dd>
                    <dt className="text-muted-foreground">{t("location")}</dt>
                    <dd>{selected.current_location || "—"}</dd>
                    <dt className="text-muted-foreground">{t("father")}</dt>
                    <dd>{selected.father_id ? (byId.get(selected.father_id)?.full_name ?? "—") : "—"}</dd>
                    <dt className="text-muted-foreground">{t("mother")}</dt>
                    <dd>{selected.mother_id ? (byId.get(selected.mother_id)?.full_name ?? "—") : "—"}</dd>
                  </dl>
                  {!selected.is_root && (
                    <Button
                      className="w-full"
                      variant="outline"
                      onClick={() => {
                        setLineageOf(selected);
                        setSelected(null);
                      }}
                    >
                      <GitBranch className="mr-2 size-4" />
                      {t("viewLineage")}
                    </Button>
                  )}
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        <LineageDialog person={lineageOf} byId={byId} onClose={() => setLineageOf(null)} />
      </div>
    </div>
  );
}

function LineageChain({ chain, valid }: { chain: Member[]; valid: boolean }) {
  const { t } = useI18n();
  if (!valid) return <p className="text-xs text-muted-foreground">{t("noLink")}</p>;
  return (
    <ol className="space-y-1">
      {chain.map((m, i) => (
        <li key={m.id} className="flex items-baseline gap-2 text-xs">
          <span className="w-4 shrink-0 text-muted-foreground">{i + 1}.</span>
          <span className={m.is_root ? "font-semibold text-primary" : ""}>{m.full_name}</span>
        </li>
      ))}
    </ol>
  );
}

export function LineageDialog({
  person,
  byId,
  onClose,
}: {
  person: Member | null;
  byId: Map<number, Member>;
  onClose: () => void;
}) {
  const { t } = useI18n();
  if (!person) return null;
  const fChain = fatherChain(person.id, byId).reverse();
  const mChain = motherChain(person.id, byId).reverse();
  const fValid = chainReachesRoot([...fChain].reverse());
  const mValid = chainReachesRoot([...mChain].reverse());
  return (
    <Dialog open={!!person} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {t("viewLineage")}: {person.full_name}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <Card>
            <CardContent className="pt-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-semibold">{t("fatherLineage")}</span>
                <span className={fValid ? "text-xs font-bold text-kin-alive" : "text-xs font-bold text-destructive"}>
                  {fValid ? `✅ ${t("valid")}` : `❌ ${t("invalid")}`}
                </span>
              </div>
              <LineageChain chain={fChain} valid={fValid} />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-semibold">{t("motherLineage")}</span>
                <span className={mValid ? "text-xs font-bold text-kin-alive" : "text-xs font-bold text-destructive"}>
                  {mValid ? `✅ ${t("valid")}` : `❌ ${t("invalid")}`}
                </span>
              </div>
              <LineageChain chain={mChain} valid={mValid} />
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
