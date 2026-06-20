import { memo, useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import ReactFlow, {
  Background,
  Controls,
  type Edge,
  type Node,
  type NodeProps,
  type ReactFlowInstance,
} from "reactflow";
import "reactflow/dist/style.css";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, Search } from "lucide-react";
import { fetchAllMembers, fetchWives, statusOf, statusClass } from "@/lib/family";
import { computeFamilyTreeLayout } from "@/lib/tree-layout";

type AdminTreeNodeData = {
  name: string;
  highlight: boolean;
  status: keyof typeof statusClass;
};

const AdminTreeNode = memo(function AdminTreeNode({ data }: NodeProps<AdminTreeNodeData>) {
  return (
    <div
      className={`rounded-lg border px-2.5 py-1.5 text-[11px] font-medium shadow-sm ${statusClass[data.status]} ${data.highlight ? "ring-2 ring-primary" : ""}`}
    >
      {data.name}
    </div>
  );
});

const nodeTypes = { adminMember: AdminTreeNode };

export function AdminTreePage() {
  const { data: members = [], isLoading } = useQuery({
    queryKey: ["members", "approved"],
    queryFn: () => fetchAllMembers(false),
  });
  const { data: wives = [] } = useQuery({ queryKey: ["wives"], queryFn: fetchWives });
  const [showOut, setShowOut] = useState(true);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => members.filter((m) => showOut || m.is_in_kin), [members, showOut]);

  const matchIds = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return new Set<number>();
    return new Set(filtered.filter((m) => m.full_name.toLowerCase().includes(q)).map((m) => m.id));
  }, [filtered, query]);

  const layout = useMemo(
    () => computeFamilyTreeLayout(filtered, wives),
    [filtered, wives],
  );

  const flowNodes = useMemo(() => {
    const ns: Node<AdminTreeNodeData>[] = [];
    for (const m of filtered) {
      const pos = layout.positions.get(m.id);
      if (!pos) continue;
      ns.push({
        id: String(m.id),
        type: "adminMember",
        position: pos,
        data: {
          name: m.full_name,
          highlight: matchIds.has(m.id),
          status: statusOf(m),
        },
        style: { padding: 0, border: "none", background: "transparent" },
      });
    }
    return ns;
  }, [filtered, layout, matchIds]);

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
        style: { strokeWidth: 1.5, opacity: 0.45 },
      });
    }

    filtered.forEach((m) => {
      if (m.father_id && memberIds.has(m.father_id)) {
        es.push({
          id: `f-${m.father_id}-${m.id}`,
          source: String(m.father_id),
          target: String(m.id),
          type: "smoothstep",
        });
      }
      if (m.mother_id && memberIds.has(m.mother_id)) {
        es.push({
          id: `m-${m.mother_id}-${m.id}`,
          source: String(m.mother_id),
          target: String(m.id),
          type: "smoothstep",
          style: { strokeDasharray: "5 3" },
        });
      }
    });
    return es;
  }, [filtered, wives]);

  const onInit = useCallback((instance: ReactFlowInstance) => {
    void instance.fitView({ padding: 0.15, duration: 200 });
  }, []);

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading tree…</p>;

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search member…"
            className="pl-8"
          />
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowOut((v) => !v)}>
          {showOut ? <EyeOff className="size-4 mr-1" /> : <Eye className="size-4 mr-1" />}
          {showOut ? "Hide out-of-kin" : "Show out-of-kin"}
        </Button>
      </div>
      <div className="flex-1 rounded-lg border bg-muted/20">
        <ReactFlow
          key={`admin-tree-${flowNodes.length}-${wives.length}`}
          nodes={flowNodes}
          edges={flowEdges}
          nodeTypes={nodeTypes}
          onInit={onInit}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          minZoom={0.2}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
        >
          <Background />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </div>
  );
}
