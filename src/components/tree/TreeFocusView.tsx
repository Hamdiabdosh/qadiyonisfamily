import { useEffect, useMemo, useState } from "react";

import { FamilyUnitCard } from "@/components/tree/FamilyUnitCard";
import { TreeBreadcrumb } from "@/components/tree/TreeBreadcrumb";
import { buildFamilyUnits, type WifeLink } from "@/lib/admin-family-units";
import type { Member } from "@/lib/family";

type Props = {
  members: Member[];
  wives: WifeLink[];
  focusedId: number | null;
  onFocusChange: (id: number) => void;
};

const COLLAPSE_KEY = "tree-collapsed";

function resolveFocusedUnit(
  focusMember: Member,
  units: ReturnType<typeof buildFamilyUnits>,
  unitByFather: Map<number, ReturnType<typeof buildFamilyUnits>[number]>,
): ReturnType<typeof buildFamilyUnits>[number] | null {
  const ownUnit = unitByFather.get(focusMember.id);
  if (ownUnit) return ownUnit;

  const motherUnit = units.find((u) => u.motherLed && u.mothers[0]?.id === focusMember.id);
  if (motherUnit) return motherUnit;

  if (focusMember.father_id) {
    const parentUnit = unitByFather.get(focusMember.father_id);
    if (parentUnit?.memberIds.includes(focusMember.id)) return parentUnit;
  }

  if (focusMember.mother_id) {
    const parentUnit = units.find(
      (u) => u.motherLed && u.mothers[0]?.id === focusMember.mother_id && u.memberIds.includes(focusMember.id),
    );
    if (parentUnit) return parentUnit;
  }

  return units.find((u) => u.key === `solo-${focusMember.id}`) ?? null;
}

export function TreeFocusView({ members, wives, focusedId, onFocusChange }: Props) {
  const units = useMemo(() => buildFamilyUnits(members, wives), [members, wives]);
  const byId = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const unitByFather = useMemo(
    () => new Map(units.filter((u) => u.father).map((u) => [u.father!.id, u])),
    [units],
  );

  const root = useMemo(() => members.find((m) => m.is_root) ?? null, [members]);
  const focusMember = focusedId ? byId.get(focusedId) ?? null : root;
  const focusedUnit = focusMember ? resolveFocusedUnit(focusMember, units, unitByFather) : null;

  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    try {
      const raw = localStorage.getItem(COLLAPSE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as string[];
      setCollapsedGroups(new Set(parsed));
    } catch {
      // ignore malformed local storage
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(COLLAPSE_KEY, JSON.stringify([...collapsedGroups]));
  }, [collapsedGroups]);

  const chain = useMemo(() => {
    if (!focusMember) return [];
    const out: Member[] = [];
    const seen = new Set<number>();
    let cur: Member | undefined = focusMember;
    while (cur && !seen.has(cur.id)) {
      out.push(cur);
      seen.add(cur.id);
      cur = cur.father_id ? byId.get(cur.father_id) : undefined;
    }
    return out.reverse();
  }, [focusMember, byId]);

  const siblings = useMemo(() => {
    if (!focusMember?.father_id) return [];
    return members.filter((m) => m.father_id === focusMember.father_id && m.gender === "male");
  }, [members, focusMember]);

  if (!focusMember) return null;

  return (
    <div className="space-y-3">
      <TreeBreadcrumb chain={chain} onFocus={onFocusChange} />
      {focusedUnit ? (
        <FamilyUnitCard
          unit={focusedUnit}
          byId={byId}
          collapsedGroups={collapsedGroups}
          onToggleGroup={(key) =>
            setCollapsedGroups((prev) => {
              const next = new Set(prev);
              if (next.has(key)) next.delete(key);
              else next.add(key);
              return next;
            })
          }
          onFocus={onFocusChange}
        />
      ) : (
        <div className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
          No family unit found for {focusMember.full_name}
        </div>
      )}

      {siblings.length > 1 ? (
        <div className="rounded-lg border p-2">
          <p className="mb-2 text-xs font-medium text-muted-foreground">Other sons in this branch</p>
          <div className="flex flex-wrap gap-1.5">
            {siblings.map((s) => (
              <button
                key={s.id}
                type="button"
                className="rounded-full border px-2 py-0.5 text-xs hover:bg-muted"
                onClick={() => onFocusChange(s.id)}
              >
                {s.full_name}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

