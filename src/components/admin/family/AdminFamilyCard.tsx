import { Pencil } from "lucide-react";

import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { familyLabel, type FamilyUnit } from "@/lib/admin-family-units";
import type { Member, SubmitFamilyPayload, SubmissionMemberIds } from "@/lib/family";
import { cn } from "@/lib/utils";
import { EditFamilyDialog } from "./EditFamilyDialog";

type Props = {
  unit: FamilyUnit;
  highlighted?: boolean;
  onEditFamily: (form: SubmitFamilyPayload, memberIds: SubmissionMemberIds) => Promise<void>;
  onMemberClick?: (member: Member) => void;
};

function ChildChip({ child, onClick }: { child: Member; onClick?: () => void }) {
  const className =
    "inline-flex items-center gap-1 rounded-full border bg-background px-2 py-0.5 text-xs transition-colors";
  if (onClick) {
    return (
      <button type="button" className={cn(className, "hover:bg-muted")} onClick={onClick}>
        {child.full_name}
        <span className="text-muted-foreground">#{child.birth_order ?? "?"}</span>
      </button>
    );
  }
  return (
    <span className={className}>
      {child.full_name}
      <span className="text-muted-foreground">#{child.birth_order ?? "?"}</span>
    </span>
  );
}

export function AdminFamilyCard({ unit, highlighted, onEditFamily, onMemberClick }: Props) {
  return (
    <Card
      id={`family-unit-${unit.key}`}
      className={cn(highlighted && "ring-2 ring-primary ring-offset-2")}
    >
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
          {unit.father && (
            <button
              type="button"
              className="inline-flex"
              onClick={() => onMemberClick?.(unit.father!)}
            >
              <StatusBadge m={unit.father} />
            </button>
          )}
          {unit.mothers.map((m) => (
            <button key={m.id} type="button" className="inline-flex" onClick={() => onMemberClick?.(m)}>
              <StatusBadge m={m} />
            </button>
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
                          <ChildChip key={c.id} child={c} onClick={onMemberClick ? () => onMemberClick(c) : undefined} />
                        ))}
                      </div>
                    </div>
                  );
                })}
                {unit.children
                  .filter((c) => !c.mother_id || !unit.mothers.some((m) => m.id === c.mother_id))
                  .map((c) => (
                    <ChildChip key={c.id} child={c} onClick={onMemberClick ? () => onMemberClick(c) : undefined} />
                  ))}
              </div>
            ) : (
              <div className="flex flex-wrap gap-1">
                {unit.children.map((c) => (
                  <ChildChip key={c.id} child={c} onClick={onMemberClick ? () => onMemberClick(c) : undefined} />
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
