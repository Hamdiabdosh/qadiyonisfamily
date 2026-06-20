import { createFileRoute } from "@tanstack/react-router";
import { memo, useCallback, useMemo, useState, type MouseEvent } from "react";
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
import { Search, Home as HomeIcon, Eye, EyeOff } from "lucide-react";

import { AppHeader } from "@/components/AppHeader";
import { PageTitleRow } from "@/components/PageTitleRow";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { fetchAllMembers, fetchWives, statusOf, statusClass, type Member } from "@/lib/family";
import { buildMap, fatherChain, motherChain, chainReachesRoot } from "@/lib/lineage";
import { computeFamilyTreeLayout } from "@/lib/tree-layout";
import { useI18n } from "@/lib/i18n";
import { StatusBadge } from "@/components/StatusBadge";

export const Route = createFileRoute("/_app/tree")({ ssr: false, component: TreePage });

type MemberNodeData = {
  name: string;
  generation: number;
  status: keyof typeof statusClass;
  highlight: boolean;
  motherLabel?: string;
};

const MemberNode = memo(function MemberNode({ data }: NodeProps<MemberNodeData>) {
  const { t } = useI18n();
  return (
    <div
      className={`min-w-[120px] cursor-pointer rounded-xl border px-2 py-1.5 text-center text-xs font-medium shadow-md transition-all duration-200 hover:scale-105 hover:shadow-lg ${statusClass[data.status]} ${data.highlight ? "ring-4 ring-primary shadow-[0_0_20px_var(--glow-primary)]" : ""}`}
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

function TreePage() {
  const { t } = useI18n();
  const { data: members = [], isLoading } = useQuery({
    queryKey: ["members", "approved"],
    queryFn: () => fetchAllMembers(false),
  });
  const { data: wives = [] } = useQuery({ queryKey: ["wives"], queryFn: fetchWives });
  const byId = useMemo(() => buildMap(members), [members]);

  const [showOut, setShowOut] = useState(true);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Member | null>(null);
  const [lineageOf, setLineageOf] = useState<Member | null>(null);

  const filtered = useMemo(() => members.filter((m) => showOut || m.is_in_kin), [members, showOut]);
  const stats = useMemo(
    () => ({
      total: members.length,
      kin: members.filter((m) => m.is_in_kin).length,
      generations: new Set(members.map((m) => m.generation_level)).size,
      alive: members.filter((m) => m.is_alive).length,
    }),
    [members],
  );

  const matchIds = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return new Set<number>();
    return new Set(filtered.filter((m) => m.full_name.toLowerCase().includes(q)).map((m) => m.id));
  }, [filtered, query]);

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
          motherLabel,
        },
        style: { padding: 0, border: "none", background: "transparent" },
      });
    }
    return ns;
  }, [filtered, layout, matchIds, byId, fathersWithMultipleWives]);

  const flowEdges = useMemo(() => {
    const memberIds = new Set(filtered.map((m) => m.id));
    const es: Edge[] = [];

    for (const w of wives) {
      if (!memberIds.has(w.husband_id) || !memberIds.has(w.wife_id)) continue;
      es.push({
        id: `marriage-${w.husband_id}-${w.wife_id}`,
        source: String(w.husband_id),
        target: String(w.wife_id),
        type: "straight",
        style: { stroke: "var(--color-primary)", strokeWidth: 1.5, opacity: 0.45 },
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
          style: { stroke: "var(--color-kin-alive)", strokeWidth: 1.5 },
        });
      }
      if (m.mother_id && memberIds.has(m.mother_id)) {
        es.push({
          id: `m-${m.mother_id}-${m.id}`,
          source: String(m.mother_id),
          target: String(m.id),
          type: "smoothstep",
          markerEnd: { type: MarkerType.ArrowClosed },
          style: { stroke: "var(--color-out-alive)", strokeWidth: 1.5, strokeDasharray: "5 3" },
        });
      }
    });
    return es;
  }, [filtered, wives]);

  const onInit = useCallback((instance: ReactFlowInstance) => {
    void instance.fitView({ padding: 0.15, duration: 200 });
  }, []);

  const onNodeClick = useCallback(
    (_e: MouseEvent, n: Node<MemberNodeData>) => {
      const m = members.find((x) => String(x.id) === n.id);
      if (m) setSelected(m);
    },
    [members],
  );

  return (
    <div>
      <AppHeader />
      <div className="page-content space-y-3 px-3 pb-3 pt-2">
        <PageTitleRow title={t("tree")} />
        <div className="stagger-children grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: t("totalMembers"), value: stats.total },
            { label: t("kin"), value: stats.kin },
            { label: t("generation"), value: stats.generations },
            { label: t("alive"), value: stats.alive },
          ].map((s) => (
            <Card key={s.label} variant="stat">
              <CardContent className="p-3 text-center">
                <p className="text-lg font-bold text-primary">{s.value}</p>
                <p className="text-[10px] text-muted-foreground">{s.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("search")} className="pl-8" />
          </div>
          <Button variant="outline" size="icon" onClick={() => setQuery("Qadi Yonis")}>
            <HomeIcon className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setShowOut((v) => !v)}
            title={showOut ? t("hideOutOfKin") : t("showOutOfKin")}
          >
            {showOut ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
          </Button>
        </div>

        <div className="tree-canvas h-[52vh] min-h-[280px]">
          {isLoading ? (
            <div className="p-4 text-sm text-muted-foreground">{t("loading")}</div>
          ) : (
            <ReactFlow
              key={`tree-${flowNodes.length}-${wives.length}`}
              nodes={flowNodes}
              edges={flowEdges}
              nodeTypes={nodeTypes}
              nodesDraggable={false}
              nodesConnectable={false}
              elementsSelectable
              onInit={onInit}
              onNodeClick={onNodeClick}
              minZoom={0.15}
              maxZoom={2}
              proOptions={{ hideAttribution: true }}
            >
              <Background gap={24} />
              <Controls showInteractive={false} />
            </ReactFlow>
          )}
        </div>

        <Dialog open={!!selected} onOpenChange={(o) => { if (!o) setSelected(null); }}>
          <DialogContent className="max-w-sm">
            {selected && (
              <>
                <DialogHeader>
                  <DialogTitle>{selected.full_name}</DialogTitle>
                </DialogHeader>
                <div className="space-y-2 text-sm">
                  <StatusBadge m={selected} />
                  <p>
                    <span className="text-muted-foreground">{t("generation")}:</span> {selected.generation_level}
                  </p>
                  <p>
                    <span className="text-muted-foreground">{t("location")}:</span> {selected.current_location || "—"}
                  </p>
                  <p>
                    <span className="text-muted-foreground">{t("father")}:</span>{" "}
                    {selected.father_id ? (byId.get(selected.father_id)?.full_name ?? "—") : "—"}
                  </p>
                  <p>
                    <span className="text-muted-foreground">{t("mother")}:</span>{" "}
                    {selected.mother_id ? (byId.get(selected.mother_id)?.full_name ?? "—") : "—"}
                  </p>
                  {!selected.is_root && (
                    <Button className="mt-2 w-full" variant="outline" onClick={() => setLineageOf(selected)}>
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
                <span className={fValid ? "font-bold text-kin-alive" : "font-bold text-destructive"}>
                  {fValid ? `✅ ${t("valid")}` : `❌ ${t("invalid")}`}
                </span>
              </div>
              {fValid ? (
                <p className="text-xs">{fChain.map((m) => m.full_name).join(" → ")}</p>
              ) : (
                <p className="text-xs text-muted-foreground">{t("noLink")}</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-semibold">{t("motherLineage")}</span>
                <span className={mValid ? "font-bold text-kin-alive" : "font-bold text-destructive"}>
                  {mValid ? `✅ ${t("valid")}` : `❌ ${t("invalid")}`}
                </span>
              </div>
              {mValid ? (
                <p className="text-xs">{mChain.map((m) => m.full_name).join(" → ")}</p>
              ) : (
                <p className="text-xs text-muted-foreground">{t("noLink")}</p>
              )}
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
