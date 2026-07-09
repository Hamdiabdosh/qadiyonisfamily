import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { AdminFamilyCard } from "@/components/admin/family/AdminFamilyCard";
import { DeleteMemberDialog } from "@/components/admin/family/DeleteMemberDialog";
import { FamilyAttentionBanners } from "@/components/admin/family/FamilyAttentionBanners";
import { FamilyGettingStartedCard } from "@/components/admin/family/FamilyGettingStartedCard";
import { FamilyPageToolbar, type FamilyBrowseTab } from "@/components/admin/family/FamilyPageToolbar";
import { MemberDetailSheet } from "@/components/admin/family/MemberDetailSheet";
import { MemberPhotoDialog } from "@/components/admin/family/MemberPhotoDialog";
import { MembersTable } from "@/components/admin/family/MembersTable";
import {
  buildFamilyUnits,
  computeFamilyAnalytics,
  filterAndSortFamilies,
  groupFamiliesByGeneration,
  type FamilySort,
} from "@/lib/admin-family-units";
import { filterAndSortMembers, type MemberStatusFilter } from "@/lib/admin-member-list";
import { fetchWives, type Member } from "@/lib/family";
import type { AdminActions, AdminData } from "../types";

const TAB_KEY = "admin-family-tab";

type Props = {
  data: AdminData;
  actions: AdminActions;
};

function readStoredTab(): FamilyBrowseTab {
  try {
    return localStorage.getItem(TAB_KEY) === "families" ? "families" : "members";
  } catch {
    return "members";
  }
}

export function MembersPage({ data, actions }: Props) {
  const [tab, setTab] = useState<FamilyBrowseTab>(readStoredTab);
  const [q, setQ] = useState("");
  const [generation, setGeneration] = useState("all");
  const [status, setStatus] = useState<MemberStatusFilter>("all");
  const [sort, setSort] = useState<FamilySort>("name-asc");
  const [guideOpen, setGuideOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [photoMember, setPhotoMember] = useState<Member | null>(null);
  const [deleteMember, setDeleteMember] = useState<Member | null>(null);
  const [highlightUnitKey, setHighlightUnitKey] = useState<string | null>(null);

  const { data: wives = [] } = useQuery({ queryKey: ["wives"], queryFn: fetchWives });

  useEffect(() => {
    localStorage.setItem(TAB_KEY, tab);
    setSort(tab === "members" ? "name-asc" : "generation-asc");
  }, [tab]);

  useEffect(() => {
    if (!highlightUnitKey) return;
    const el = document.getElementById(`family-unit-${highlightUnitKey}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    const t = window.setTimeout(() => setHighlightUnitKey(null), 3000);
    return () => window.clearTimeout(t);
  }, [highlightUnitKey]);

  const units = useMemo(() => buildFamilyUnits(data.approved, wives), [data.approved, wives]);
  const analytics = useMemo(() => computeFamilyAnalytics(data.approved, units), [data.approved, units]);

  const generationOptions = useMemo(
    () => [...new Set(data.approved.map((m) => m.generation_level))].sort((a, b) => a - b),
    [data.approved],
  );

  const filteredMembers = useMemo(
    () =>
      filterAndSortMembers(data.approved, {
        query: q,
        generation: generation === "all" ? "all" : Number(generation),
        status,
        sort,
      }),
    [data.approved, q, generation, status, sort],
  );

  const filteredFamilies = useMemo(
    () =>
      filterAndSortFamilies(units, {
        query: q,
        generation: generation === "all" ? "all" : Number(generation),
        status,
        sort,
      }),
    [units, q, generation, status, sort],
  );

  const groupedFamilies = useMemo(() => groupFamiliesByGeneration(filteredFamilies), [filteredFamilies]);
  const rootName = data.approved.find((m) => m.is_root)?.full_name ?? "Qadi Yonis";

  const openMember = (member: Member) => {
    setSelectedMember(member);
    setSheetOpen(true);
  };

  const requestDelete = (member: Member) => {
    if (member.is_root) return;
    setSheetOpen(false);
    setDeleteMember(member);
  };

  const confirmDelete = async (id: number) => {
    await actions.remove(id);
    setDeleteMember(null);
    setSelectedMember(null);
  };

  const editInFamily = (unitKey: string) => {
    setSheetOpen(false);
    setTab("families");
    setHighlightUnitKey(unitKey);
  };

  return (
    <div className="space-y-4">
      <FamilyAttentionBanners data={data} />

      <p className="text-sm text-muted-foreground">
        {analytics.total} members · {analytics.generations} generations · {analytics.families} families
      </p>

      <FamilyGettingStartedCard
        rootName={rootName}
        memberCount={data.approved.length}
        forceOpen={guideOpen}
        onForceOpenHandled={() => setGuideOpen(false)}
      />

      <FamilyPageToolbar
        tab={tab}
        onTabChange={setTab}
        q={q}
        onQChange={setQ}
        generation={generation}
        onGenerationChange={setGeneration}
        status={status}
        onStatusChange={setStatus}
        sort={sort}
        onSortChange={setSort}
        generationOptions={generationOptions}
        onShowGuide={() => setGuideOpen(true)}
      />

      <p className="text-sm text-muted-foreground">
        {tab === "members"
          ? `${filteredMembers.length} member${filteredMembers.length === 1 ? "" : "s"}`
          : `${filteredFamilies.length} famil${filteredFamilies.length === 1 ? "y" : "ies"}`}
        {" · "}
        {data.approved.length} registered total
      </p>

      {tab === "members" ? (
        <MembersTable
          members={filteredMembers}
          allMembers={data.approved}
          onRowClick={openMember}
          onPhoto={setPhotoMember}
          onSetAlive={actions.setAlive}
          onDelete={requestDelete}
        />
      ) : filteredFamilies.length === 0 ? (
        <div className="flex min-h-[30vh] items-center justify-center rounded-lg border border-dashed">
          <p className="text-sm text-muted-foreground">No families match your filters.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {[...groupedFamilies.entries()]
            .sort((a, b) => (sort === "generation-desc" ? b[0] - a[0] : a[0] - b[0]))
            .map(([gen, genUnits]) => (
              <section key={gen} className="space-y-3">
                <h3 className="sticky top-[4.5rem] z-10 rounded-md border bg-background/95 px-3 py-1.5 text-sm font-semibold backdrop-blur">
                  Generation {gen}
                  <span className="ml-2 font-normal text-muted-foreground">({genUnits.length})</span>
                </h3>
                <div className="grid gap-3 lg:grid-cols-2">
                  {genUnits.map((unit) => (
                    <AdminFamilyCard
                      key={unit.key}
                      unit={unit}
                      highlighted={highlightUnitKey === unit.key}
                      onEditFamily={actions.editFamilyUnit}
                      onMemberClick={openMember}
                    />
                  ))}
                </div>
              </section>
            ))}
        </div>
      )}

      <MemberDetailSheet
        member={selectedMember}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        allMembers={data.approved}
        units={units}
        onSetAlive={actions.setAlive}
        onDelete={requestDelete}
        onEditInFamily={editInFamily}
      />

      {photoMember && (
        <MemberPhotoDialog
          member={photoMember}
          open={!!photoMember}
          onOpenChange={(open) => !open && setPhotoMember(null)}
        >
          <span className="hidden" />
        </MemberPhotoDialog>
      )}

      <DeleteMemberDialog
        member={deleteMember}
        open={!!deleteMember}
        onOpenChange={(open) => !open && setDeleteMember(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

export { MembersPage as FamilyPage };
