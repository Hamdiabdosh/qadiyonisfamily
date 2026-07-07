import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Users, GitBranch } from "lucide-react";

import { AppHeader } from "@/components/AppHeader";
import { PageTitleRow } from "@/components/PageTitleRow";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { fetchAllMembers, type Member } from "@/lib/family";
import { buildMap, shortestRelation } from "@/lib/lineage";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { StatusBadge } from "@/components/StatusBadge";
import { LineageDialog } from "./_app.tree";

export const Route = createFileRoute("/_app/kin")({
  ssr: false,
  component: KinPage,
});

function KinPage() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { data: members = [] } = useQuery({
    queryKey: ["members", "approved"],
    queryFn: () => fetchAllMembers(false),
  });

  const byId = useMemo(() => buildMap(members), [members]);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Member | null>(null);
  const [lineageOf, setLineageOf] = useState<Member | null>(null);
  const [relateTo, setRelateTo] = useState<Member | null>(null);

  const me = members.find(m => m.full_name === user?.fullName);

  const filtered = useMemo(() => {
    const term = q.toLowerCase().trim();
    return members.filter((m) => {
      if (!term) return true;
      return (
        m.full_name.toLowerCase().includes(term) ||
        (m.current_location || "").toLowerCase().includes(term)
      );
    });
  }, [members, q]);

  return (
    <div>
      <AppHeader />
      <div className="page-content space-y-4 px-4 pb-4 pt-2">
        <PageTitleRow
          title={t("kinDirectory") || "Family Directory"}
          description="Search and explore your relatives"
        />

        <div className="relative">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name or location..."
            className="pl-10 py-6 text-base"
          />
        </div>

        <div className="flex gap-3 text-sm">
          <div className="bg-card border rounded-xl px-4 py-2.5 flex-1 text-center">
            <p className="font-semibold text-primary">{members.length}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </div>
          <div className="bg-card border rounded-xl px-4 py-2.5 flex-1 text-center">
            <p className="font-semibold text-emerald-600">
              {members.filter((m) => m.is_in_kin).length}
            </p>
            <p className="text-xs text-muted-foreground">In Kin</p>
          </div>
        </div>

        <div className="space-y-2">
          {filtered.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                No family members found
              </CardContent>
            </Card>
          ) : (
            filtered.map((member) => (
              <Card
                key={member.id}
                variant="interactive"
                className="cursor-pointer"
                onClick={() => setSelected(member)}
              >
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold truncate">{member.full_name}</p>
                    <p className="text-sm text-muted-foreground">
                      Gen {member.generation_level} • {member.current_location || "Unknown"}
                    </p>
                  </div>
                  <StatusBadge m={member} />
                </CardContent>
              </Card>
            ))
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 pt-4">
          <Button asChild variant="outline">
            <Link to="/tree">
              <GitBranch className="mr-2 size-4" />
              Full Tree
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/home">
              <Users className="mr-2 size-4" />
              My Home
            </Link>
          </Button>
        </div>
      </div>

      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-sm">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>{selected.full_name}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <StatusBadge m={selected} />
                <p><span className="text-muted-foreground">Generation:</span> {selected.generation_level}</p>
                <p><span className="text-muted-foreground">Location:</span> {selected.current_location || "—"}</p>
                <p><span className="text-muted-foreground">Father:</span> {byId.get(selected.father_id || 0)?.full_name || "—"}</p>
                <p><span className="text-muted-foreground">Mother:</span> {byId.get(selected.mother_id || 0)?.full_name || "—"}</p>

                <div className="flex gap-2 pt-4">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setLineageOf(selected)}
                  >
                    View Lineage
                  </Button>
                  {me && me.id !== selected.id && (
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => setRelateTo(selected)}
                    >
                      How Related?
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <LineageDialog person={lineageOf} byId={byId} onClose={() => setLineageOf(null)} />

      <Dialog open={!!relateTo} onOpenChange={() => setRelateTo(null)}>
        <DialogContent className="max-w-sm">
          {relateTo && me && (
            <>
              <DialogHeader>
                <DialogTitle>How are we related?</DialogTitle>
              </DialogHeader>
              <p className="text-sm">
                {shortestRelation(me.id, relateTo.id, byId)
                  ?.map(m => m.full_name)
                  .join(" → ") || "No direct relation found"}
              </p>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
