import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { GitBranch, LayoutGrid, Search } from "lucide-react";

import { AppHeader } from "@/components/AppHeader";
import { PageTitleRow } from "@/components/PageTitleRow";
import { TreeFocusView } from "@/components/tree/TreeFocusView";
import { TreeGraphView } from "@/components/tree/TreeGraphView";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fetchAllMembers, fetchWives, type Member } from "@/lib/family";
import { buildMap, fatherChain, motherChain, chainReachesRoot } from "@/lib/lineage";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { MemberAvatar } from "@/components/MemberAvatar";
import { StatusBadge } from "@/components/StatusBadge";
import { disambiguatorLabel } from "@/lib/member-disambiguator";

const VIEW_MODE_KEY = "tree-view-mode";
const SHOW_OUT_KEY = "tree-show-out";
type TreeViewMode = "focus" | "graph";

export const Route = createFileRoute("/_app/tree")({
  ssr: false,
  validateSearch: z.object({ focus: z.coerce.number().optional() }),
  component: TreePage,
});

function TreePage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const navigate = Route.useNavigate();
  const { focus } = Route.useSearch();
  const { data: members = [] } = useQuery({
    queryKey: ["members", "approved"],
    queryFn: () => fetchAllMembers(false),
  });
  const { data: wives = [] } = useQuery({ queryKey: ["wives"], queryFn: fetchWives });
  const byId = useMemo(() => buildMap(members), [members]);

  const me = useMemo(
    () => members.find((m) => (user?.memberId ? m.id === user.memberId : m.full_name === user?.fullName)),
    [members, user?.memberId, user?.fullName],
  );

  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Member | null>(null);
  const [lineageOf, setLineageOf] = useState<Member | null>(null);
  const [viewMode, setViewMode] = useState<TreeViewMode>(() => {
    try {
      const stored = localStorage.getItem(VIEW_MODE_KEY);
      return stored === "graph" ? "graph" : "focus";
    } catch {
      return "focus";
    }
  });
  const [showOut, setShowOut] = useState(() => {
    try {
      return localStorage.getItem(SHOW_OUT_KEY) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    localStorage.setItem(VIEW_MODE_KEY, viewMode);
  }, [viewMode]);

  useEffect(() => {
    localStorage.setItem(SHOW_OUT_KEY, showOut ? "1" : "0");
  }, [showOut]);

  const root = members.find((m) => m.is_root) ?? null;
  const focusId = focus ?? me?.id ?? root?.id ?? null;

  const setFocus = (id: number) => {
    void navigate({ search: (prev) => ({ ...prev, focus: id }) });
  };
  const displayMembers = useMemo(
    () => (showOut ? members : members.filter((m) => m.is_in_kin)),
    [members, showOut],
  );

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [];
    return displayMembers.filter((m) => m.full_name.toLowerCase().includes(term)).slice(0, 12);
  }, [displayMembers, q]);

  return (
    <div>
      <AppHeader />
      <div className="page-content space-y-4 px-4 pb-4 pt-2">
        <PageTitleRow
          title={t("tree")}
          description={viewMode === "graph" ? t("treeDescriptionGraph") : t("treeDescriptionFocus")}
        />

        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as TreeViewMode)}>
              <TabsList className="h-9">
                <TabsTrigger value="focus" className="gap-1.5 px-3 text-xs sm:text-sm">
                  <LayoutGrid className="size-3.5" />
                  {t("treeViewFocus")}
                </TabsTrigger>
                <TabsTrigger value="graph" className="gap-1.5 px-3 text-xs sm:text-sm">
                  <GitBranch className="size-3.5" />
                  {t("treeViewGraph")}
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="flex flex-wrap gap-1.5 sm:ml-auto">
              <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => setShowOut((v) => !v)}>
                {showOut ? t("hideOutOfKin") : t("showOutOfKin")}
              </Button>
              {root ? (
                <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => setFocus(root.id)}>
                  {t("goToRoot")}
                </Button>
              ) : null}
              {me ? (
                <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => setFocus(me.id)}>
                  {t("focusOnMe")}
                </Button>
              ) : null}
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("treeSearchPlaceholder")}
              className="h-9 pl-10"
            />
          </div>

          {results.length > 0 ? (
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-xl border bg-card/60 p-1.5 shadow-sm">
              {results.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-muted"
                  onClick={() => {
                    setSelected(m);
                    setFocus(m.id);
                    setQ("");
                  }}
                >
                  <MemberAvatar name={m.full_name} photoUrl={m.photo_url} size="sm" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{m.full_name}</span>
                    <span className="block truncate text-[10px] text-muted-foreground">
                      {disambiguatorLabel(m, byId)}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {viewMode === "focus" ? (
          <TreeFocusView members={displayMembers} wives={wives} focusedId={focusId} onFocusChange={setFocus} />
        ) : (
          <TreeGraphView
            members={displayMembers}
            wives={wives}
            showOut={showOut}
            highlightId={focusId}
            searchQuery={q}
            onNodeClick={(m) => {
              setFocus(m.id);
              setSelected(m);
            }}
          />
        )}

        <Dialog open={!!selected} onOpenChange={(o) => (!o ? setSelected(null) : null)}>
          <DialogContent className="max-w-sm">
            {selected ? (
              <>
                <DialogHeader className="items-center text-center">
                  <MemberAvatar name={selected.full_name} photoUrl={selected.photo_url} size="xl" />
                  <DialogTitle>{selected.full_name}</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-center">
                    <StatusBadge m={selected} />
                  </div>
                  <p className="text-xs text-muted-foreground">{disambiguatorLabel(selected, byId)}</p>
                  {!selected.is_root ? (
                    <Button
                      className="w-full"
                      variant="outline"
                      onClick={() => {
                        setLineageOf(selected);
                        setSelected(null);
                      }}
                    >
                      {t("viewLineage")}
                    </Button>
                  ) : null}
                </div>
              </>
            ) : null}
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
