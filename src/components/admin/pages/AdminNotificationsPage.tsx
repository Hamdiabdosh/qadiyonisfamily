import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Card, CardContent } from "@/components/ui/card";
import { getAdminNotificationsFn, markNotificationReadFn } from "@/lib/api/content.functions";

export function AdminNotificationsPage() {
  const qc = useQueryClient();
  const { data: items = [] } = useQuery({
    queryKey: ["admin", "notifications"],
    queryFn: getAdminNotificationsFn,
  });

  const markRead = async (id: number) => {
    await markNotificationReadFn({ data: { id } });
    qc.invalidateQueries({ queryKey: ["admin", "notifications"] });
  };

  if (items.length === 0) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center rounded-lg border border-dashed">
        <p className="text-sm text-muted-foreground">No admin notifications.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-w-2xl">
      {items.map((n) => (
        <Card
          key={n.id}
          variant="interactive"
          className={n.isRead ? "opacity-70" : "border-primary/40 shadow-[0_4px_20px_var(--glow-primary)]"}
          onClick={() => !n.isRead && markRead(n.id)}
        >
          <CardContent className="space-y-1 py-3">
            <div className="flex items-center gap-2">
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase">{n.type}</span>
              {!n.isRead && <span className="size-2 rounded-full bg-primary" />}
            </div>
            <p className="font-medium text-sm">{n.title}</p>
            <p className="text-xs text-muted-foreground">{n.body}</p>
            <p className="text-[10px] text-muted-foreground">{new Date(n.createdAt).toLocaleString()}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
