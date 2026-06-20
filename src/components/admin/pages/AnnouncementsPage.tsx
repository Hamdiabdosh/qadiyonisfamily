import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { createAnnouncementFn, getAnnouncementsFn } from "@/lib/api/content.functions";

export function AnnouncementsPage() {
  const qc = useQueryClient();
  const { data: items = [] } = useQuery({ queryKey: ["admin", "announcements"], queryFn: getAnnouncementsFn });
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  const publish = async () => {
    if (!title.trim() || !body.trim()) {
      toast.error("Title and body required");
      return;
    }
    setSending(true);
    try {
      await createAnnouncementFn({ data: { title: title.trim(), body: body.trim() } });
      toast.success("Announcement published — members will be notified");
      setTitle("");
      setBody("");
      qc.invalidateQueries({ queryKey: ["admin"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-base">New announcement</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Announcement title" />
          </div>
          <div className="space-y-1.5">
            <Label>Message</Label>
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} placeholder="Write your announcement…" />
          </div>
          <Button onClick={publish} disabled={sending}>Publish & notify members</Button>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Past announcements</h3>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">No announcements yet.</p>
        ) : (
          items.map((a) => (
            <Card key={a.id}>
              <CardContent className="space-y-1 pt-4">
                <p className="font-medium">{a.title}</p>
                <p className="text-sm text-muted-foreground">{a.body}</p>
                <p className="text-xs text-muted-foreground">{new Date(a.publishedAt).toLocaleString()}</p>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
