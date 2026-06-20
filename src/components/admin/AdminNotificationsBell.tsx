import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Bell, CheckCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getAdminNotificationsFn, markNotificationReadFn } from "@/lib/api/content.functions";

function alertTarget(type: string): { view: "approval" | "feedbacks" | "notifications" } {
  if (type === "approval") return { view: "approval" };
  if (type === "feedback") return { view: "feedbacks" };
  return { view: "notifications" };
}

export function AdminNotificationsBell() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { data: items = [] } = useQuery({
    queryKey: ["admin", "notifications"],
    queryFn: getAdminNotificationsFn,
    refetchInterval: 45_000,
  });

  const unread = items.filter((n) => !n.isRead);
  const recent = items.slice(0, 6);

  const openItem = async (id: number, type: string, read: boolean) => {
    if (!read) {
      await markNotificationReadFn({ data: { id } });
      qc.invalidateQueries({ queryKey: ["admin", "notifications"] });
    }
    nav({ to: "/admin", search: alertTarget(type) });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative shrink-0 rounded-xl">
          <Bell className="size-5" />
          {unread.length > 0 ? (
            <span className="absolute right-1 top-1 flex size-4 animate-pulse items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
              {unread.length > 9 ? "9+" : unread.length}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 rounded-xl">
        <DropdownMenuLabel className="flex items-center justify-between gap-2">
          <span>Notifications</span>
          {unread.length > 0 ? (
            <span className="text-xs font-normal text-muted-foreground">{unread.length} unread</span>
          ) : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {recent.length === 0 ? (
          <p className="px-2 py-3 text-xs text-muted-foreground">No approval or feedback alerts yet.</p>
        ) : (
          recent.map((n) => (
            <DropdownMenuItem
              key={n.id}
              className="flex cursor-pointer flex-col items-start gap-0.5 py-2"
              onClick={() => void openItem(n.id, n.type, n.isRead)}
            >
              <div className="flex w-full items-center gap-2">
                <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] uppercase">{n.type}</span>
                {!n.isRead ? <span className="size-1.5 rounded-full bg-primary" /> : null}
              </div>
              <span className="text-sm font-medium leading-snug">{n.title}</span>
              <span className="line-clamp-2 text-xs text-muted-foreground">{n.body}</span>
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="justify-center text-xs font-medium text-primary"
          onClick={() => nav({ to: "/admin", search: { view: "notifications" } })}
        >
          <CheckCheck className="mr-1.5 size-3.5" />
          View all notifications
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
