import { useState } from "react";
import { ChevronDown, ChevronUp, Pencil } from "lucide-react";

import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { familyLabel, formatFamilyParentName, type FamilyUnit } from "@/lib/admin-family-units";
import { sortMembersByBirthOrder, type Member, type SubmitFamilyPayload, type SubmissionMemberIds } from "@/lib/family";
import { cn } from "@/lib/utils";
import { EditFamilyDialog } from "./EditFamilyDialog";

const COLLAPSE_AT = 6;

type Props = {
  unit: FamilyUnit;
  highlighted?: boolean;
  onEditFamily: (form: SubmitFamilyPayload, memberIds: SubmissionMemberIds) => Promise<void>;
  onMemberClick?: (member: Member) => void;
};

function ChildChip({
  child,
  rank,
  onClick,
}: {
  child: Member;
  rank: number;
  onClick?: () => void;
}) {
  const className =
    "inline-flex items-center gap-1 rounded-full border bg-background px-2 py-0.5 text-xs transition-colors";
  const label = (
    <>
      {child.full_name}
      <span className="text-muted-foreground">#{rank}</span>
    </>
  );
  if (onClick) {
    return (
      <button type="button" className={cn(className, "hover:bg-muted")} onClick={onClick}>
        {label}
      </button>
    );
  }
  return <span className={className}>{label}</span>;
}

function ChildrenList({
  children,
  mothers,
  onMemberClick,
}: {
  children: Member[];
  mothers: Member[];
  onMemberClick?: (member: Member) => void;
}) {
  const rankById = new Map(
    sortMembersByBirthOrder(children).map((c, i) => [c.id, i + 1] as const),
  );

  if (mothers.length > 1) {
    return (
      <div className="space-y-2">
        {mothers.map((mother) => {
          const kids = sortMembersByBirthOrder(children.filter((c) => c.mother_id === mother.id));
          if (kids.length === 0) return null;
          return (
            <div key={mother.id}>
              <p className="mb-1 text-[10px] font-medium text-muted-foreground">
                {formatFamilyParentName(mother.full_name)}
              </p>
              <div className="flex flex-wrap gap-1">
                {kids.map((c) => (
                  <ChildChip
                    key={c.id}
                    child={c}
                    rank={rankById.get(c.id) ?? 0}
                    onClick={onMemberClick ? () => onMemberClick(c) : undefined}
                  />
                ))}
              </div>
            </div>
          );
        })}
        {children
          .filter((c) => !c.mother_id || !mothers.some((m) => m.id === c.mother_id))
          .map((c) => (
            <ChildChip
              key={c.id}
              child={c}
              rank={rankById.get(c.id) ?? 0}
              onClick={onMemberClick ? () => onMemberClick(c) : undefined}
            />
          ))}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-1">
      {sortMembersByBirthOrder(children).map((c) => (
        <ChildChip
          key={c.id}
          child={c}
          rank={rankById.get(c.id) ?? 0}
          onClick={onMemberClick ? () => onMemberClick(c) : undefined}
        />
      ))}
    </div>
  );
}

export function AdminFamilyCard({ unit, highlighted, onEditFamily, onMemberClick }: Props) {
  const childCount = unit.children.length;
  const [expanded, setExpanded] = useState(childCount <= COLLAPSE_AT);

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
            <Button size="sm" variant="outline" className="h-7 shrink-0 px-2 text-xs">
              <Pencil className="size-3 mr-1" /> Edit
            </Button>
          </EditFamilyDialog>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {unit.father && (
            <button type="button" className="inline-flex" onClick={() => onMemberClick?.(unit.father!)}>
              <StatusBadge m={unit.father} />
            </button>
          )}
          {unit.mothers.map((m) => (
            <button key={m.id} type="button" className="inline-flex" onClick={() => onMemberClick?.(m)}>
              <StatusBadge m={m} />
            </button>
          ))}
        </div>

        {childCount > 0 && (
          <Collapsible open={expanded} onOpenChange={setExpanded}>
            <div className="rounded-md bg-muted/40 px-2 py-1.5">
              <div className="mb-1 flex items-center justify-between gap-2">
                <p className="text-[10px] font-medium uppercase text-muted-foreground">
                  Children ({childCount})
                </p>
                {childCount > COLLAPSE_AT && (
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-6 px-1.5 text-[10px]">
                      {expanded ? (
                        <>
                          <ChevronUp className="size-3 mr-0.5" />
                          Collapse
                        </>
                      ) : (
                        <>
                          <ChevronDown className="size-3 mr-0.5" />
                          Show all
                        </>
                      )}
                    </Button>
                  </CollapsibleTrigger>
                )}
              </div>
              {childCount > COLLAPSE_AT && !expanded ? (
                <button
                  type="button"
                  className="w-full text-left text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => setExpanded(true)}
                >
                  {sortMembersByBirthOrder(unit.children)
                    .slice(0, 4)
                    .map((c) => c.full_name)
                    .join(", ")}
                  {childCount > 4 ? ` +${childCount - 4} more` : ""}
                </button>
              ) : (
                <CollapsibleContent className="data-[state=closed]:hidden">
                  <ChildrenList
                    children={unit.children}
                    mothers={unit.mothers}
                    onMemberClick={onMemberClick}
                  />
                </CollapsibleContent>
              )}
            </div>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
}
