import { ChevronDown, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { MemberChip } from "@/components/tree/MemberChip";
import type { Member } from "@/lib/family";
import type { MotherChildGroup as MotherGroup } from "@/lib/sibling-order";

type Props = {
  group: MotherGroup;
  byId: Map<number, Member>;
  collapsed: boolean;
  onToggle: () => void;
  onFocus: (id: number) => void;
};

export function MotherChildGroup({ group, byId, collapsed, onToggle, onFocus }: Props) {
  return (
    <div className="space-y-2 rounded-lg border bg-muted/20 p-2">
      <Button type="button" variant="ghost" className="h-8 w-full justify-between px-2" onClick={onToggle}>
        <span className="text-xs font-medium">{group.motherLabel} · {group.children.length}</span>
        {collapsed ? <ChevronRight className="size-4" /> : <ChevronDown className="size-4" />}
      </Button>
      {!collapsed ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {group.children.map((child) => (
            <MemberChip key={child.id} member={child} byId={byId} onOpen={onFocus} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

