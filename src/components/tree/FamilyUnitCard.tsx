import { MemberAvatar } from "@/components/MemberAvatar";
import { MotherChildGroup } from "@/components/tree/MotherChildGroup";
import { GlobalSiblingStrip } from "@/components/tree/GlobalSiblingStrip";
import type { FamilyUnit } from "@/lib/admin-family-units";
import type { Member } from "@/lib/family";
import { statusOf } from "@/lib/family";

type Props = {
  unit: FamilyUnit;
  byId: Map<number, Member>;
  collapsedGroups: Set<string>;
  onToggleGroup: (groupKey: string) => void;
  onFocus: (memberId: number) => void;
};

export function FamilyUnitCard({ unit, byId, collapsedGroups, onToggleGroup, onFocus }: Props) {
  const motherNameById = new Map(unit.mothers.map((m) => [m.id, m.full_name]));
  return (
    <div className="space-y-3 rounded-xl border bg-card p-3">
      <div className="flex flex-wrap items-center gap-2">
        {unit.father ? (
          <div className="inline-flex items-center gap-2 rounded-lg border px-2 py-1">
            <MemberAvatar
              name={unit.father.full_name}
              photoUrl={unit.father.photo_url}
              status={statusOf(unit.father)}
              size="sm"
            />
            <span className="text-sm font-semibold">{unit.father.full_name}</span>
          </div>
        ) : null}
        {unit.mothers.map((m) => (
          <div key={m.id} className="inline-flex items-center gap-2 rounded-lg border px-2 py-1">
            <MemberAvatar name={m.full_name} photoUrl={m.photo_url} status={statusOf(m)} size="sm" />
            <span className="text-sm">{m.full_name}</span>
          </div>
        ))}
      </div>

      <GlobalSiblingStrip children={unit.childrenGlobal} motherNameById={motherNameById} />

      <div className="space-y-2">
        {unit.childrenByMother.map((group) => {
          const groupKey = `${unit.key}-${group.mother?.id ?? "unknown"}`;
          const collapsed = collapsedGroups.has(groupKey);
          return (
            <MotherChildGroup
              key={groupKey}
              group={group}
              byId={byId}
              collapsed={collapsed}
              onToggle={() => onToggleGroup(groupKey)}
              onFocus={onFocus}
            />
          );
        })}
      </div>
    </div>
  );
}

