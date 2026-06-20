import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { AdminActions, AdminData } from "../types";

type Props = {
  data: AdminData;
  actions: AdminActions;
};

export function DuplicatesPage({ data, actions }: Props) {
  const { duplicates } = data;

  if (duplicates.length === 0) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center rounded-lg border border-dashed">
        <p className="text-sm text-muted-foreground">No duplicate names detected.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {duplicates.map((group, i) => (
        <Card key={i}>
          <CardContent className="space-y-2 pt-4">
            <p className="font-semibold">{group[0].full_name}</p>
            <p className="text-xs text-muted-foreground">{group.length} matching records</p>
            <div className="space-y-1">
              {group.map((m) => (
                <div key={m.id} className="flex items-center justify-between rounded-md border px-3 py-2 text-xs">
                  <span>
                    #{m.id} • {m.is_approved ? "approved" : "pending"} • Gen {m.generation_level}
                  </span>
                  <Button size="sm" variant="outline" onClick={() => actions.remove(m.id)}>
                    Delete
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
