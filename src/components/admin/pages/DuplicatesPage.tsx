import { useMemo } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MemberAvatar } from "@/components/MemberAvatar";
import { buildMap } from "@/lib/lineage";
import { statusOf } from "@/lib/family";
import { disambiguatorLabel } from "@/lib/member-disambiguator";
import { duplicateGroupKey } from "../utils";
import type { AdminActions, AdminData } from "../types";

type Props = {
  data: AdminData;
  actions: AdminActions;
};

function memberContext(member: AdminData["duplicates"][number][number], byId: Map<number, typeof member>) {
  const bits = [disambiguatorLabel(member, byId)];
  if (member.birth_year) bits.push(`b. ${member.birth_year}`);
  if (member.current_location) bits.push(member.current_location);
  return bits.join(" · ");
}

export function DuplicatesPage({ data, actions }: Props) {
  const { duplicates } = data;
  const byId = useMemo(() => buildMap(data.all), [data.all]);

  if (duplicates.length === 0) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center rounded-lg border border-dashed">
        <p className="text-sm text-muted-foreground">No duplicate names detected.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {duplicates.map((group) => {
        const groupKey = duplicateGroupKey(group);
        return (
          <Card key={groupKey}>
            <CardContent className="space-y-2 pt-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{group[0].full_name}</p>
                  <p className="text-xs text-muted-foreground">{group.length} matching records</p>
                </div>
                <Button size="sm" variant="secondary" onClick={() => actions.dismissDuplicateGroup(groupKey)}>
                  Not a duplicate — dismiss
                </Button>
              </div>
              <div className="space-y-1">
                {group.map((m) => (
                  <div key={m.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-xs">
                    <div className="flex min-w-0 items-center gap-2">
                      <MemberAvatar name={m.full_name} photoUrl={m.photo_url} status={statusOf(m)} size="sm" />
                      <div className="min-w-0">
                        <p className="truncate font-medium">#{m.id} • {m.is_approved ? "approved" : "pending"}</p>
                        <p className="truncate text-muted-foreground">{memberContext(m, byId)}</p>
                      </div>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => actions.remove(m.id)}>
                      Delete
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
