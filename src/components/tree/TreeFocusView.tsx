import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import { MemberAvatar } from "@/components/MemberAvatar";
import { StatusBadge } from "@/components/StatusBadge";
import { FamilyUnitCard } from "@/components/tree/FamilyUnitCard";
import { TreeBreadcrumb } from "@/components/tree/TreeBreadcrumb";
import { Button } from "@/components/ui/button";
import { buildFamilyUnits, buildUnitLookup, type FamilyUnit, type WifeLink } from "@/lib/admin-family-units";
import { sortMembersByBirthOrder, statusOf, type Member } from "@/lib/family";
import { useI18n } from "@/lib/i18n";

type Props = {
  members: Member[];
  wives: WifeLink[];
  focusedId: number | null;
  onFocusChange: (id: number) => void;
};

const COLLAPSE_KEY = "tree-collapsed";

/** Own family unit only — do not fall back to parent unit (that blocked drill-down). */
function resolveOwnUnit(
  focusMember: Member,
  units: FamilyUnit[],
  lookup: ReturnType<typeof buildUnitLookup>,
): FamilyUnit | null {
  return (
    lookup.byFather.get(focusMember.id) ??
    lookup.byMother.get(focusMember.id) ??
    units.find((u) => u.key === `solo-${focusMember.id}`) ??
    null
  );
}

function PersonFocusPanel({
  member,
  byId,
  onFocusParent,
}: {
  member: Member;
  byId: Map<number, Member>;
  onFocusParent: (id: number) => void;
}) {
  const { t } = useI18n();
  const father = member.father_id ? byId.get(member.father_id) : null;
  const mother = member.mother_id ? byId.get(member.mother_id) : null;

  return (
    <div className="space-y-3 rounded-xl border p-4">
      <div className="flex flex-col items-center gap-2 text-center">
        <MemberAvatar
          name={member.full_name}
          photoUrl={member.photo_url}
          size="xl"
          status={statusOf(member)}
        />
        <div>
          <p className="font-semibold">{member.full_name}</p>
          <div className="mt-1 flex justify-center">
            <StatusBadge m={member} />
          </div>
        </div>
        {member.current_location ? (
          <p className="text-xs text-muted-foreground">{member.current_location}</p>
        ) : null}
      </div>

      {(father || mother) && (
        <div className="space-y-1 text-sm">
          <p className="text-xs font-medium text-muted-foreground">{t("parents")}</p>
          <div className="flex flex-wrap gap-1.5">
            {father ? (
              <button
                type="button"
                className="rounded-full border px-2 py-0.5 text-xs hover:bg-muted"
                onClick={() => onFocusParent(father.id)}
              >
                {father.full_name}
              </button>
            ) : null}
            {mother ? (
              <button
                type="button"
                className="rounded-full border px-2 py-0.5 text-xs hover:bg-muted"
                onClick={() => onFocusParent(mother.id)}
              >
                {mother.full_name}
              </button>
            ) : null}
          </div>
        </div>
      )}

      <Button asChild variant="outline" size="sm" className="w-full">
        <Link to="/add-family">{t("addFamily")}</Link>
      </Button>
    </div>
  );
}

export function TreeFocusView({ members, wives, focusedId, onFocusChange }: Props) {
  const { t } = useI18n();
  const units = useMemo(() => buildFamilyUnits(members, wives), [members, wives]);
  const byId = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);
  const unitLookup = useMemo(() => buildUnitLookup(units), [units]);

  const root = useMemo(() => members.find((m) => m.is_root) ?? null, [members]);
  const focusMember = focusedId ? byId.get(focusedId) ?? null : root;
  const ownUnit = focusMember ? resolveOwnUnit(focusMember, units, unitLookup) : null;

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
    return sortMembersByBirthOrder(members.filter((m) => m.father_id === focusMember.father_id));
  }, [members, focusMember]);

  if (!focusMember) return null;

  return (
    <div className="space-y-3">
      <TreeBreadcrumb chain={chain} onFocus={onFocusChange} />
      {ownUnit ? (
        <FamilyUnitCard
          unit={ownUnit}
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
        <PersonFocusPanel member={focusMember} byId={byId} onFocusParent={onFocusChange} />
      )}

      {siblings.length > 1 ? (
        <div className="rounded-lg border p-2">
          <p className="mb-2 text-xs font-medium text-muted-foreground">{t("otherChildrenInBranch")}</p>
          <div className="flex flex-wrap gap-1.5">
            {siblings.map((s) => (
              <button
                key={s.id}
                type="button"
                className={`rounded-full border px-2 py-0.5 text-xs hover:bg-muted ${
                  s.id === focusMember.id ? "border-primary bg-primary/10 font-medium" : ""
                }`}
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
