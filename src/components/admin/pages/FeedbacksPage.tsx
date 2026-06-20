import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getFeedbacksFn, markFeedbackReadFn } from "@/lib/api/content.functions";

export function FeedbacksPage() {
  const qc = useQueryClient();
  const { data: items = [] } = useQuery({ queryKey: ["admin", "feedbacks"], queryFn: getFeedbacksFn });

  const markRead = async (id: number) => {
    await markFeedbackReadFn({ data: { id } });
    qc.invalidateQueries({ queryKey: ["admin", "feedbacks"] });
  };

  if (items.length === 0) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center rounded-lg border border-dashed">
        <p className="text-sm text-muted-foreground">No feedback submitted yet.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      {items.map((f) => (
        <Card key={f.id} variant="interactive" className={f.isRead ? "opacity-70" : "border-primary/40 shadow-[0_4px_20px_var(--glow-primary)]"}>
          <CardContent className="space-y-2 pt-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 space-y-0.5">
                <p className="text-sm font-medium">{f.submitterName ?? "Unknown"}</p>
                {f.submitterPhone ? (
                  <p className="text-xs text-muted-foreground">{f.submitterPhone}</p>
                ) : null}
              </div>
              {!f.isRead && (
                <Button size="sm" variant="outline" onClick={() => markRead(f.id)}>Mark read</Button>
              )}
            </div>
            <p className="text-sm">{f.message}</p>
            <p className="text-xs text-muted-foreground">
              {new Date(f.createdAt).toLocaleString()}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
