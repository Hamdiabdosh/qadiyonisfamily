import { useState } from "react";

import { DeleteMemberDialog } from "@/components/admin/family/DeleteMemberDialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Member } from "@/lib/family";
import type { AdminActions, AdminData } from "../types";

type Props = {
  data: AdminData;
  actions: AdminActions;
};

export function IncompletePage({ data, actions }: Props) {
  const { incomplete } = data;
  const [deleteTarget, setDeleteTarget] = useState<Member | null>(null);

  if (incomplete.length === 0) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center rounded-lg border border-dashed">
        <p className="text-sm text-muted-foreground">No members need parent links.</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-3 lg:grid-cols-2">
        {incomplete.map((m) => (
          <Card key={m.id}>
            <CardContent className="flex items-center justify-between gap-3 py-4">
              <div>
                <p className="font-semibold">{m.full_name}</p>
                <p className="text-xs text-muted-foreground">
                  No parent links and not linked by marriage
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => setDeleteTarget(m)}>
                Remove
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <DeleteMemberDialog
        member={deleteTarget}
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        onConfirm={async (id) => {
          await actions.remove(id);
          setDeleteTarget(null);
        }}
      />
    </>
  );
}
