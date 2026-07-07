import { memo, useCallback, useEffect, useMemo, useRef } from "react";
import ReactFlow, {
  Background,
  Controls,
  MarkerType,
  MiniMap,
  type Edge,
  type Node,
  type NodeProps,
  type ReactFlowInstance,
} from "reactflow";
import "reactflow/dist/style.css";

import { MemberAvatar } from "@/components/MemberAvatar";
import { computeFamilyTreeLayout } from "@/lib/tree-layout";
import { statusOf, statusClass, type Member } from "@/lib/family";
import type { WifeLink } from "@/lib/admin-family-units";
import { useI18n } from "@/lib/i18n";

type GraphNodeData = {
  name: string;
  photoUrl: string | null;
  generation: number;
  status: keyof typeof statusClass;
  highlight: boolean;
  motherLabel?: string;
};

const GraphMemberNode = memo(function GraphMemberNode({ data }: NodeProps<GraphNodeData>) {
  const { t } = useI18n();
  return (
    <div
      className={`flex min-w-[96px] max-w-[120px] flex-col items-center gap-1 rounded-xl border px-1.5 pb-1.5 pt-2 text-center text-[10px] font-medium shadow-md ${statusClass[data.status]} ${data.highlight ? "ring-2 ring-primary" : ""}`}
    >
      <MemberAvatar
        name={data.name}
        photoUrl={data.photoUrl}
        status={data.status}
        size="sm"
        className="border border-background"
      />
      <div className="w-full truncate">{data.name}</div>
      {data.motherLabel ? (
        <div className="w-full truncate text-[8px] opacity-75">
          {t("childOfMother")} {data.motherLabel}
        </div>
      ) : null}
      <div className="text-[9px] opacity-80">
        {t("gen")} {data.generation}
      </div>
    </div>
  );
});

const nodeTypes = { member: GraphMemberNode };

type Props = {
  members: Member[];
  wives: WifeLink[];
  showOut: boolean;
  highlightId?: number | null;
  searchQuery?: string;
  onNodeClick?: (member: Member) => void;
};

export function TreeGraphView({
  members,
  wives,
  showOut,
  highlightId,
  searchQuery = "",
  onNodeClick,
}: Props) {
  const flowRef = useRef<ReactFlowInstance | null>(null);

  const filtered = useMemo(
    () => members.filter((m) => showOut || m.is_in_kin),
    [members, showOut],
  );

  const trimmedQuery = searchQuery.trim().toLowerCase();
  const matchIds = useMemo(() => {
    if (!trimmedQuery) return new Set<number>();
    return new Set(
      filtered.filter((m) => m.full_name.toLowerCase().includes(trimmedQuery)).map((m) => m.id),
    );
  }, [filtered, trimmedQuery]);

  const hasQuery = trimmedQuery.length > 0;

  const fathersWithMultipleWives = useMemo(() => {
    const count = new Map<number, number>();
    for (const w of wives) {
      count.set(w.husband_id, (count.get(w.husband_id) ?? 0) + 1);
    }
    return new Set([...count.entries()].filter(([, n]) => n > 1).map(([id]) => id));
  }, [wives]);

  const byId = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);

  const layout = useMemo(() => computeFamilyTreeLayout(filtered, wives), [filtered, wives]);

  const flowNodes = useMemo(() => {
    const ns: Node<GraphNodeData>[] = [];
    for (const m of filtered) {
      const pos = layout.positions.get(m.id);
      if (!pos) continue;
      const motherLabel =
        m.father_id && m.mother_id && fathersWithMultipleWives.has(m.father_id)
          ? byId.get(m.mother_id)?.full_name
          : undefined;
      const highlighted = highlightId === m.id || matchIds.has(m.id);
      ns.push({
        id: String(m.id),
        type: "member",
        position: pos,
        zIndex: highlighted ? 10 : 1,
        data: {
          name: m.full_name,
          photoUrl: m.photo_url,
          generation: m.generation_level,
          status: statusOf(m),
          highlight: highlighted,
          motherLabel,
        },
        style: { padding: 0, border: "none", background: "transparent" },
      });
    }
    return ns;
  }, [filtered, layout, matchIds, highlightId, byId, fathersWithMultipleWives]);

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

    for (const m of filtered) {
      if (m.father_id && memberIds.has(m.father_id)) {
        es.push({
          id: `f-${m.father_id}-${m.id}`,
          source: String(m.father_id),
          target: String(m.id),
          type: "smoothstep",
          markerEnd: { type: MarkerType.ArrowClosed },
          style: {
            stroke: "var(--color-kin-alive)",
            strokeWidth: 1.5,
            opacity: dimEdges && !matchIds.has(m.id) && !matchIds.has(m.father_id) ? 0.2 : 1,
          },
        });
      }
      if (m.mother_id && memberIds.has(m.mother_id)) {
        es.push({
          id: `m-${m.mother_id}-${m.id}`,
          source: String(m.mother_id),
          target: String(m.id),
          type: "smoothstep",
          markerEnd: { type: MarkerType.ArrowClosed },
          style: {
            stroke: "var(--color-out-alive)",
            strokeWidth: 1.5,
            strokeDasharray: "5 3",
            opacity: dimEdges && !matchIds.has(m.id) && !matchIds.has(m.mother_id) ? 0.2 : 1,
          },
        });
      }
    }
    return es;
  }, [filtered, wives, hasQuery, matchIds]);

  const onInit = useCallback((instance: ReactFlowInstance) => {
    flowRef.current = instance;
    void instance.fitView({ padding: 0.15, duration: 200 });
  }, []);

  const focusNode = useCallback((id: number | null) => {
    const inst = flowRef.current;
    if (!inst || id == null) return;
    void inst.fitView({ nodes: [{ id: String(id) }], padding: 0.9, duration: 350, maxZoom: 1.2 });
  }, []);

  useEffect(() => {
    if (highlightId != null) focusNode(highlightId);
  }, [highlightId, focusNode]);

  useEffect(() => {
    if (!hasQuery || matchIds.size === 0) return;
    const first = filtered.find((m) => matchIds.has(m.id))?.id ?? null;
    focusNode(first);
  }, [hasQuery, matchIds, filtered, focusNode]);

  if (flowNodes.length === 0) {
    return (
      <div className="tree-canvas flex h-[58vh] min-h-[280px] items-center justify-center p-6 text-center text-sm text-muted-foreground">
        No members to display
      </div>
    );
  }

  return (
    <div className="tree-canvas relative h-[58vh] min-h-[280px]">
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
        panOnScroll
        onInit={onInit}
        onNodeClick={(_e, n) => {
          const m = members.find((x) => String(x.id) === n.id);
          if (m) onNodeClick?.(m);
        }}
        minZoom={0.1}
        maxZoom={2.5}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={28} size={1} color="var(--border)" />
        <Controls showInteractive={false} className="!rounded-xl !border !shadow-md" />
        <MiniMap
          className="!rounded-lg !border !shadow-md"
          nodeColor={(n) => {
            const status = (n.data as GraphNodeData | undefined)?.status;
            if (status === "root") return "var(--color-root)";
            if (status === "kinAlive") return "var(--color-kin-alive)";
            if (status === "kinDead") return "var(--color-kin-dead)";
            if (status === "outAlive") return "var(--color-out-alive)";
            return "var(--color-out-dead)";
          }}
          maskColor="color-mix(in oklch, var(--background) 75%, transparent)"
          pannable
          zoomable
        />
      </ReactFlow>
    </div>
  );
}
