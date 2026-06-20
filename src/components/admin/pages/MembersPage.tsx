import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Skull, Trash2, UserCheck, Pencil } from "lucide-react";

import { AddFamilyForm } from "@/components/AddFamilyForm";
import { FamilyAnalyticsGrid } from "@/components/admin/FamilyAnalyticsGrid";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/StatusBadge";
import {
  buildFamilyUnits,
  computeFamilyAnalytics,
  familyLabel,
  filterAndSortFamilies,
  groupFamiliesByGeneration,
  type FamilySort,
  type FamilyUnit,
} from "@/lib/admin-family-units";
import { fetchWives } from "@/lib/family";
import type { AdminActions, AdminData } from "../types";

type Props = {
  data: AdminData;
  actions: AdminActions;
};

function EditFamilyDialog({
  unit,
  onSave,
  children,
}: {
  unit: FamilyUnit;
  onSave: (form: any, memberIds: any) => Promise<void>;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader><DialogTitle>Edit Family</DialogTitle></DialogHeader>
        <AddFamilyForm
          initialFamilyUnit={unit}
          onEditUnit={async (form, memberIds) => {
            await onSave(form, memberIds);
            setOpen(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function FamilyUnitCard({
  unit,
  onRemove,
  onSetAlive,
  onEditFamily,
}: {
  unit: FamilyUnit;
  onRemove: (id: number) => void;
  onSetAlive: (id: number, isAlive: boolean) => void;
  onEditFamily: (form: any, memberIds: any) => Promise<void>;
}) {
  const members = [unit.father, ...unit.mothers, ...unit.children].filter(Boolean);

  return (
    <Card>
      <CardContent className="space-y-2 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold">{familyLabel(unit)}</p>
            <p className="text-xs text-muted-foreground">
              Gen {unit.generation} • {unit.location ?? "—"} • {unit.memberIds.length} member
              {unit.memberIds.length === 1 ? "" : "s"}
            </p>
          </div>
          <EditFamilyDialog unit={unit} onSave={onEditFamily}>
            <Button size="sm" variant="outline" className="h-7 px-2 text-xs">
              <Pencil className="size-3 mr-1" /> Edit Family
            </Button>
          </EditFamilyDialog>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {unit.father && <StatusBadge m={unit.father} />}
          {unit.mothers.map((m) => (
            <StatusBadge key={m.id} m={m} />
          ))}
        </div>

        {unit.children.length > 0 && (
          <div className="rounded-md bg-muted/40 px-2 py-1.5">
            <p className="mb-1 text-[10px] font-medium uppercase text-muted-foreground">Children</p>
            {unit.mothers.length > 1 ? (
              <div className="space-y-2">
                {unit.mothers.map((mother) => {
                  const kids = unit.children.filter((c) => c.mother_id === mother.id);
                  if (kids.length === 0) return null;
                  return (
                    <div key={mother.id}>
                      <p className="mb-1 text-[10px] font-medium text-muted-foreground">{mother.full_name}</p>
                      <div className="flex flex-wrap gap-1">
                        {kids.map((c) => (
                          <span
                            key={c.id}
                            className="inline-flex items-center gap-1 rounded-full border bg-background px-2 py-0.5 text-xs"
                          >
                            {c.full_name}
                            <span className="text-muted-foreground">#{c.birth_order ?? "?"}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
                {unit.children
                  .filter((c) => !c.mother_id || !unit.mothers.some((m) => m.id === c.mother_id))
                  .map((c) => (
                    <span
                      key={c.id}
                      className="inline-flex items-center gap-1 rounded-full border bg-background px-2 py-0.5 text-xs"
                    >
                      {c.full_name}
                      <span className="text-muted-foreground">#{c.birth_order ?? "?"}</span>
                    </span>
                  ))}
              </div>
            ) : (
              <div className="flex flex-wrap gap-1">
                {unit.children.map((c) => (
                  <span
                    key={c.id}
                    className="inline-flex items-center gap-1 rounded-full border bg-background px-2 py-0.5 text-xs"
                  >
                    {c.full_name}
                    <span className="text-muted-foreground">#{c.birth_order ?? "?"}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-1 border-t pt-2">
          {members.map((m) => (
            <div key={m!.id} className="flex items-center gap-0.5">
              {!m!.is_root && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-1.5 text-xs"
                  title={m!.is_alive ? "Mark as deceased" : "Mark as alive"}
                  onClick={() => onSetAlive(m!.id, !m!.is_alive)}
                >
                  {m!.is_alive ? <Skull className="size-3" /> : <UserCheck className="size-3" />}
                </Button>
              )}
              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => onRemove(m!.id)}>
                <Trash2 className="size-3 mr-1" />
                {m!.full_name}
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function MembersPage({ data, actions }: Props) {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [generation, setGeneration] = useState<string>("all");
  const [status, setStatus] = useState<"all" | "alive" | "dead" | "in-kin" | "out-kin">("all");
  const [sort, setSort] = useState<FamilySort>("generation-asc");
  const [addOpen, setAddOpen] = useState(false);

  const { data: wives = [] } = useQuery({ queryKey: ["wives"], queryFn: fetchWives });

  const units = useMemo(() => buildFamilyUnits(data.approved, wives), [data.approved, wives]);
  const analytics = useMemo(() => computeFamilyAnalytics(data.approved, units), [data.approved, units]);

  const generationOptions = useMemo(
    () => [...new Set(data.approved.map((m) => m.generation_level))].sort((a, b) => a - b),
    [data.approved],
  );

  const filtered = useMemo(
    () =>
      filterAndSortFamilies(units, {
        query: q,
        generation: generation === "all" ? "all" : Number(generation),
        status,
        sort,
      }),
    [units, q, generation, status, sort],
  );

  const grouped = useMemo(() => groupFamiliesByGeneration(filtered), [filtered]);

  const rootName = data.approved.find((m) => m.is_root)?.full_name ?? "Qadi Yonis";

  return (
    <div className="space-y-4">
      <FamilyAnalyticsGrid analytics={analytics} />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Build early generations</CardTitle>
          <CardDescription>
            Add {rootName}&apos;s wives, children, and grandchildren so members can pick them when filling the form and
            their lineage path auto-fills. Use <strong>Add family</strong> below — pick existing members from autocomplete
            to link under the tree.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Wives only:</strong> set father to {rootName} (autocomplete), add wife names, leave children blank.
            </li>
            <li>
              <strong>Children:</strong> father = {rootName}, mother = his wife, add sons/daughters in birth order.
            </li>
            <li>
              <strong>Grandchildren:</strong> father = an existing son of {rootName}, mother = his wife, add children.
            </li>
            <li>
              <strong>Alive or deceased:</strong> set status per person in the form, or use the skull / person icon on each
              member in the family list below after adding.
            </li>
          </ul>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-end gap-3">
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="size-4 mr-1" />
              Add family
            </Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add family</DialogTitle>
            </DialogHeader>
            <AddFamilyForm
              autoApprove
              onSubmitted={() => {
                setAddOpen(false);
                qc.invalidateQueries({ queryKey: ["admin"] });
                qc.invalidateQueries({ queryKey: ["members"] });
                qc.invalidateQueries({ queryKey: ["wives"] });
              }}
            />
          </DialogContent>
        </Dialog>

        <div className="relative min-w-[200px] flex-1 max-w-md">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search families, names, location…"
            className="pl-9"
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Generation</Label>
          <Select value={generation} onValueChange={setGeneration}>
            <SelectTrigger className="h-9 w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {generationOptions.map((g) => (
                <SelectItem key={g} value={String(g)}>
                  Gen {g}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Filter</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
            <SelectTrigger className="h-9 w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="alive">Has alive</SelectItem>
              <SelectItem value="dead">Has deceased</SelectItem>
              <SelectItem value="in-kin">In kin</SelectItem>
              <SelectItem value="out-kin">Out of kin</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Sort</Label>
          <Select value={sort} onValueChange={(v) => setSort(v as FamilySort)}>
            <SelectTrigger className="h-9 w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="generation-asc">Generation ↑</SelectItem>
              <SelectItem value="generation-desc">Generation ↓</SelectItem>
              <SelectItem value="name-asc">Name A–Z</SelectItem>
              <SelectItem value="size-desc">Largest first</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <p className="text-sm text-muted-foreground">
        {filtered.length} famil{filtered.length === 1 ? "y" : "ies"} • {data.approved.length} registered members
      </p>

      {filtered.length === 0 ? (
        <div className="flex min-h-[30vh] items-center justify-center rounded-lg border border-dashed">
          <p className="text-sm text-muted-foreground">No families match your filters.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {[...grouped.entries()]
            .sort((a, b) => (sort === "generation-desc" ? b[0] - a[0] : a[0] - b[0]))
            .map(([gen, genUnits]) => (
              <section key={gen} className="space-y-3">
                <h3 className="sticky top-0 z-10 rounded-md border bg-background/95 px-3 py-1.5 text-sm font-semibold backdrop-blur">
                  Generation {gen}
                  <span className="ml-2 font-normal text-muted-foreground">({genUnits.length})</span>
                </h3>
                <div className="grid gap-3 lg:grid-cols-2">
                  {genUnits.map((unit) => (
                    <FamilyUnitCard
                      key={unit.key}
                      unit={unit}
                      onRemove={actions.remove}
                      onSetAlive={actions.setAlive}
                      onEditFamily={actions.editFamilyUnit}
                    />
                  ))}
                </div>
              </section>
            ))}
        </div>
      )}
    </div>
  );
}
