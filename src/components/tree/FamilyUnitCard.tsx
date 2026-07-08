import { Link } from "@tanstack/react-router";

import { MemberAvatar } from "@/components/MemberAvatar";
import { MotherChildGroup } from "@/components/tree/MotherChildGroup";
import { GlobalSiblingStrip } from "@/components/tree/GlobalSiblingStrip";
import type { FamilyUnit } from "@/lib/admin-family-units";
import type { Member } from "@/lib/family";
import { statusOf } from "@/lib/family";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";

type Props = {
  unit: FamilyUnit;
  byId: Map<number, Member>;
  collapsedGroups: Set<string>;
  onToggleGroup: (groupKey: string) => void;
  onFocus: (memberId: number) => void;
};

export function FamilyUnitCard({ unit, byId, collapsedGroups, onToggleGroup, onFocus }: Props) {
  const { t } = useI18n();
  const { user } = useAuth();

  const mothersWithChildren = unit.mothers.filter((m) =>
    unit.childrenByMother.some((g) => g.mother?.id === m.id && g.children.length > 0),
  );
  const showEmptyState = mothersWithChildren.length === 0 && unit.childrenGlobal.length === 0;
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
        {!showEmptyState
          ? mothersWithChildren.map((m) => (
              <div key={m.id} className="inline-flex items-center gap-2 rounded-lg border px-2 py-1">
                <MemberAvatar name={m.full_name} photoUrl={m.photo_url} status={statusOf(m)} size="sm" />
                <span className="text-sm">{m.full_name}</span>
              </div>
            ))
          : null}
      </div>

      {showEmptyState ? (
        <div className="rounded-lg border border-dashed p-3 text-center text-sm text-muted-foreground">
          <p>{t("noSpouseOrChildrenRecorded")}</p>
          {user ? (
            <Link to="/add-family" className="mt-2 inline-block text-xs font-medium text-primary hover:underline">
              {t("addFamily")}
            </Link>
          ) : null}
        </div>
      ) : (
        <>
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
        </>
      )}
    </div>
  );
}
