import { memo, useCallback, useEffect, useMemo, useRef } from "react";
import ReactFlow, {
  Background,
  Controls,
  MarkerType,
  MiniMap,
  Panel,
  type Edge,
  type Node,
  type NodeProps,
  type ReactFlowInstance,
} from "reactflow";
import "reactflow/dist/style.css";
import { Maximize2 } from "lucide-react";

import { MemberAvatar } from "@/components/MemberAvatar";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { computeFamilyTreeLayout } from "@/lib/tree-layout";
import { statusOf, statusClass, type Member } from "@/lib/family";
import type { WifeLink } from "@/lib/admin-family-units";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type GraphNodeData = {
  name: string;
  photoUrl: string | null;
  generation: number;
  status: keyof typeof statusClass;
  highlight: boolean;
  dimmed: boolean;
  motherLabel?: string;
  isRoot: boolean;
};

const GraphMemberNode = memo(function GraphMemberNode({ data }: NodeProps<GraphNodeData>) {
  const { t } = useI18n();
  return (
    <div
      className={cn(
        "flex w-[118px] flex-col items-center gap-1 rounded-2xl border px-2 pb-2 pt-2.5 text-center shadow-sm transition-[opacity,box-shadow,transform] duration-200",
        "sm:w-[132px]",
        statusClass[data.status],
        data.highlight && "z-10 scale-[1.04] shadow-md ring-2 ring-primary ring-offset-1 ring-offset-background",
        data.dimmed && "opacity-30",
        data.isRoot && "border-root/60",
      )}
    >
      <MemberAvatar
        name={data.name}
        photoUrl={data.photoUrl}
        status={data.status}
        size="md"
        className="border-2 border-background shadow-sm"
      />
      <div className="line-clamp-2 w-full text-[11px] font-semibold leading-tight sm:text-xs">
        {data.name}
      </div>
      {data.motherLabel ? (
        <div className="line-clamp-1 w-full text-[9px] leading-tight opacity-70">
          {t("childOfMother")} {data.motherLabel}
        </div>
      ) : null}
      <div className="rounded-full bg-background/35 px-1.5 py-px text-[9px] font-medium opacity-80">
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
  const { t } = useI18n();
  const isMobile = useIsMobile();
  const flowRef = useRef<ReactFlowInstance | null>(null);

  // Parent already filters; keep showOut for API compat / safety
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
  const dimOthers = hasQuery && matchIds.size > 0;

  const fathersWithMultipleWives = useMemo(() => {
    const count = new Map<number, number>();
    for (const w of wives) {
      count.set(w.husband_id, (count.get(w.husband_id) ?? 0) + 1);
    }
    return new Set([...count.entries()].filter(([, n]) => n > 1).map(([id]) => id));
  }, [wives]);

  const byId = useMemo(() => new Map(filtered.map((m) => [m.id, m])), [filtered]);

  const layout = useMemo(
    () =>
      computeFamilyTreeLayout(filtered, wives, {
        nodeWidth: isMobile ? 128 : 148,
        hGap: isMobile ? 22 : 32,
        coupleGap: isMobile ? 12 : 18,
        vGap: isMobile ? 118 : 128,
        familyGap: isMobile ? 44 : 64,
      }),
    [filtered, wives, isMobile],
  );

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
      const dimmed = dimOthers && !highlighted && highlightId !== m.id;
      ns.push({
        id: String(m.id),
        type: "member",
        position: pos,
        zIndex: highlighted ? 20 : 1,
        data: {
          name: m.full_name,
          photoUrl: m.photo_url,
          generation: m.generation_level,
          status: statusOf(m),
          highlight: highlighted,
          dimmed,
          motherLabel,
          isRoot: m.is_root,
        },
        style: { padding: 0, border: "none", background: "transparent" },
      });
    }
    return ns;
  }, [filtered, layout, matchIds, highlightId, byId, fathersWithMultipleWives, dimOthers]);

  const flowEdges = useMemo(() => {
    const memberIds = new Set(filtered.map((m) => m.id));
    const es: Edge[] = [];

    for (const w of wives) {
      if (!memberIds.has(w.husband_id) || !memberIds.has(w.wife_id)) continue;
      const related =
        !dimOthers || matchIds.has(w.husband_id) || matchIds.has(w.wife_id) || highlightId === w.husband_id || highlightId === w.wife_id;
      es.push({
        id: `marriage-${w.husband_id}-${w.wife_id}`,
        source: String(w.husband_id),
        target: String(w.wife_id),
        type: "straight",
        animated: false,
        style: {
          stroke: "var(--color-primary)",
          strokeWidth: related ? 2 : 1,
          opacity: related ? 0.55 : 0.12,
        },
      });
    }

    for (const m of filtered) {
      if (m.father_id && memberIds.has(m.father_id)) {
        const related =
          !dimOthers || matchIds.has(m.id) || matchIds.has(m.father_id) || highlightId === m.id || highlightId === m.father_id;
        es.push({
          id: `f-${m.father_id}-${m.id}`,
          source: String(m.father_id),
          target: String(m.id),
          type: "smoothstep",
          markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14 },
          style: {
            stroke: "var(--color-kin-alive)",
            strokeWidth: related ? 1.75 : 1,
            opacity: related ? 0.9 : 0.15,
          },
        });
      }
      if (m.mother_id && memberIds.has(m.mother_id)) {
        const related =
          !dimOthers || matchIds.has(m.id) || matchIds.has(m.mother_id) || highlightId === m.id || highlightId === m.mother_id;
        es.push({
          id: `m-${m.mother_id}-${m.id}`,
          source: String(m.mother_id),
          target: String(m.id),
          type: "smoothstep",
          markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14 },
          style: {
            stroke: "var(--color-out-alive)",
            strokeWidth: related ? 1.5 : 1,
            strokeDasharray: "4 4",
            opacity: related ? 0.75 : 0.12,
          },
        });
      }
    }
    return es;
  }, [filtered, wives, dimOthers, matchIds, highlightId]);

  const fitAll = useCallback(() => {
    const inst = flowRef.current;
    if (!inst) return;
    void inst.fitView({ padding: isMobile ? 0.12 : 0.18, duration: 280 });
  }, [isMobile]);

  const onInit = useCallback(
    (instance: ReactFlowInstance) => {
      flowRef.current = instance;
      void instance.fitView({ padding: isMobile ? 0.12 : 0.18, duration: 200 });
    },
    [isMobile],
  );

  const focusNode = useCallback(
    (id: number | null) => {
      const inst = flowRef.current;
      if (!inst || id == null) return;
      void inst.fitView({
        nodes: [{ id: String(id) }],
        padding: isMobile ? 0.55 : 0.75,
        duration: 320,
        maxZoom: isMobile ? 1.05 : 1.25,
      });
    },
    [isMobile],
  );

  useEffect(() => {
    if (highlightId != null) focusNode(highlightId);
  }, [highlightId, focusNode]);

  useEffect(() => {
    if (!hasQuery || matchIds.size === 0) return;
    const first = filtered.find((m) => matchIds.has(m.id))?.id ?? null;
    focusNode(first);
  }, [hasQuery, matchIds, filtered, focusNode]);

  const canvasClass = cn(
    "tree-canvas relative w-full overflow-hidden",
    isMobile ? "h-[min(62vh,520px)] min-h-[300px]" : "h-[min(68vh,640px)] min-h-[360px]",
  );

  if (flowNodes.length === 0) {
    return (
      <div className={cn(canvasClass, "flex items-center justify-center p-6 text-center text-sm text-muted-foreground")}>
        {t("noMembersToDisplay")}
      </div>
    );
  }

  return (
    <div className={canvasClass}>
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
        panOnScroll
        panOnDrag
        zoomOnPinch
        zoomOnDoubleClick={false}
        onInit={onInit}
        onNodeClick={(_e, n) => {
          const m = byId.get(Number(n.id));
          if (m) onNodeClick?.(m);
        }}
        minZoom={0.08}
        maxZoom={2.2}
        defaultEdgeOptions={{ interactionWidth: 12 }}
        proOptions={{ hideAttribution: true }}
        className="touch-pan-x touch-pan-y"
      >
        <Background gap={isMobile ? 22 : 28} size={1} color="var(--border)" />
        <Controls
          showInteractive={false}
          position="bottom-left"
          className="!mb-3 !ml-2 !overflow-hidden !rounded-xl !border !bg-card/95 !shadow-md backdrop-blur-sm [&>button]:!h-8 [&>button]:!w-8 [&>button]:!border-border"
        />
        <Panel position="bottom-left" className="!mb-3 !ml-[3.25rem]">
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="size-8 rounded-xl border bg-card/95 shadow-md backdrop-blur-sm"
            onClick={fitAll}
            title={t("fitTree")}
            aria-label={t("fitTree")}
          >
            <Maximize2 className="size-3.5" />
          </Button>
        </Panel>
        {!isMobile ? (
          <MiniMap
            className="!mb-3 !mr-2 !overflow-hidden !rounded-xl !border !bg-card/90 !shadow-md"
            nodeColor={(n) => {
              const status = (n.data as GraphNodeData | undefined)?.status;
              if (status === "root") return "var(--color-root)";
              if (status === "kinAlive") return "var(--color-kin-alive)";
              if (status === "kinDead") return "var(--color-kin-dead)";
              if (status === "outAlive") return "var(--color-out-alive)";
              return "var(--color-out-dead)";
            }}
            maskColor="color-mix(in oklch, var(--background) 72%, transparent)"
            pannable
            zoomable
          />
        ) : null}
        <Panel position="top-right" className="m-2">
          <div className="flex max-w-[11rem] flex-col gap-1 rounded-xl border bg-card/90 px-2.5 py-2 text-[10px] text-muted-foreground shadow-sm backdrop-blur-sm sm:max-w-none sm:flex-row sm:items-center sm:gap-3">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-0.5 w-3 rounded-full bg-kin-alive" />
              {t("father")}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-0.5 w-3 rounded-full border border-dashed border-out-alive bg-transparent" />
              {t("mother")}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-0.5 w-3 rounded-full bg-primary" />
              {t("spouse")}
            </span>
          </div>
        </Panel>
      </ReactFlow>
    </div>
  );
}
