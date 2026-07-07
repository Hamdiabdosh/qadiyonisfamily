import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { GitBranch, LayoutGrid, Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fetchAllMembers, fetchWives } from "@/lib/family";
import { TreeFocusView } from "@/components/tree/TreeFocusView";
import { TreeGraphView } from "@/components/tree/TreeGraphView";

const VIEW_MODE_KEY = "admin-tree-view-mode";
type TreeViewMode = "focus" | "graph";

export function AdminTreePage() {
  const { data: members = [], isLoading } = useQuery({
    queryKey: ["members", "approved"],
    queryFn: () => fetchAllMembers(false),
  });
  const { data: wives = [] } = useQuery({ queryKey: ["wives"], queryFn: fetchWives });
  const [focusId, setFocusId] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [viewMode, setViewMode] = useState<TreeViewMode>(() => {
    try {
      return localStorage.getItem(VIEW_MODE_KEY) === "graph" ? "graph" : "focus";
    } catch {
      return "focus";
    }
  });
  const [showOut, setShowOut] = useState(true);

  useEffect(() => {
    localStorage.setItem(VIEW_MODE_KEY, viewMode);
  }, [viewMode]);
  const displayMembers = useMemo(
    () => (showOut ? members : members.filter((m) => m.is_in_kin)),
    [members, showOut],
  );
  const results = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return [];
    return displayMembers.filter((m) => m.full_name.toLowerCase().includes(term)).slice(0, 12);
  }, [displayMembers, query]);

  if (isLoading) return <p className="text-sm text-muted-foreground">Loading tree…</p>;

  const root = members.find((m) => m.is_root) ?? null;

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col gap-3 overflow-auto">
      <div className="flex flex-wrap items-center gap-2">
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as TreeViewMode)}>
          <TabsList>
            <TabsTrigger value="focus" className="gap-1.5">
              <LayoutGrid className="size-3.5" />
              Focus
            </TabsTrigger>
            <TabsTrigger value="graph" className="gap-1.5">
              <GitBranch className="size-3.5" />
              Graph
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <Button type="button" variant="outline" size="sm" onClick={() => setShowOut((v) => !v)}>
          {showOut ? "Hide out of kin" : "Show out of kin"}
        </Button>
        {root ? (
          <Button type="button" variant="outline" size="sm" onClick={() => setFocusId(root.id)}>
            Go to root
          </Button>
        ) : null}
      </div>
      <div className="relative min-w-[200px] flex-1">
        <Search className="absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search member…"
          className="pl-8"
        />
      </div>
      {results.length > 0 ? (
        <div className="max-h-52 space-y-1 overflow-auto rounded-lg border p-1.5">
          {results.map((m) => (
            <button
              key={m.id}
              type="button"
              className="w-full rounded-md px-2 py-1 text-left text-sm hover:bg-muted"
              onClick={() => setFocusId(m.id)}
            >
              {m.full_name}
            </button>
          ))}
        </div>
      ) : null}
      {viewMode === "focus" ? (
        <TreeFocusView members={displayMembers} wives={wives} focusedId={focusId} onFocusChange={setFocusId} />
      ) : (
        <TreeGraphView
          members={displayMembers}
          wives={wives}
          showOut={showOut}
          highlightId={focusId}
          searchQuery={query}
          onNodeClick={(m) => setFocusId(m.id)}
        />
      )}
    </div>
  );
}
