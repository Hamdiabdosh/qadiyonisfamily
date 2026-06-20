import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { AdminActions, AdminData } from "../types";

type Props = {
  data: AdminData;
  actions: AdminActions;
};

export function IncompletePage({ data, actions }: Props) {
  const { incomplete } = data;

  if (incomplete.length === 0) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center rounded-lg border border-dashed">
        <p className="text-sm text-muted-foreground">All approved members have parent links.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {incomplete.map((m) => (
        <Card key={m.id}>
          <CardContent className="flex items-center justify-between gap-3 py-4">
            <div>
              <p className="font-semibold">{m.full_name}</p>
              <p className="text-xs text-muted-foreground">No father or mother linked</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => actions.remove(m.id)}>
              Remove
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
