import { useNavigate } from "@tanstack/react-router";
import { AlertTriangle, Clock, Copy, GitBranch, Users } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { AdminData } from "../types";

type Props = {
  data: AdminData;
};

export function OverviewPage({ data }: Props) {
  const nav = useNavigate();
  const { pendingSubmissions, approved, duplicates, incomplete } = data;
  const pendingCount = pendingSubmissions.length;

  const stats = [
    {
      label: "Pending",
      value: pendingCount,
      icon: Clock,
      view: "approval" as const,
      tone: pendingCount > 0 ? "text-out-alive" : "text-muted-foreground",
    },
    {
      label: "Members",
      value: approved.length,
      icon: Users,
      view: "members" as const,
      tone: "text-kin-alive",
    },
    {
      label: "Duplicates",
      value: duplicates.length,
      icon: Copy,
      view: "duplicates" as const,
      tone: duplicates.length > 0 ? "text-out-alive" : "text-muted-foreground",
    },
    {
      label: "Incomplete",
      value: incomplete.length,
      icon: GitBranch,
      view: "incomplete" as const,
      tone: incomplete.length > 0 ? "text-out-alive" : "text-muted-foreground",
    },
  ];

  const kinAlive = approved.filter((m) => m.is_in_kin && m.is_alive).length;
  const kinDead = approved.filter((m) => m.is_in_kin && !m.is_alive).length;
  const outKin = approved.filter((m) => !m.is_in_kin).length;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, view, tone }) => (
          <Card
            key={label}
            className="cursor-pointer transition-colors hover:bg-muted/40"
            onClick={() => nav({ to: "/admin", search: { view } })}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
              <Icon className={`size-4 ${tone}`} />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Kin breakdown</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-lg bg-kin-alive/10 p-3">
              <p className="text-2xl font-bold text-kin-alive">{kinAlive}</p>
              <p className="text-xs text-muted-foreground">In-kin alive</p>
            </div>
            <div className="rounded-lg bg-kin-dead/10 p-3">
              <p className="text-2xl font-bold text-kin-dead">{kinDead}</p>
              <p className="text-xs text-muted-foreground">In-kin deceased</p>
            </div>
            <div className="rounded-lg bg-out-alive/10 p-3">
              <p className="text-2xl font-bold text-out-alive">{outKin}</p>
              <p className="text-xs text-muted-foreground">Out of kin</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Needs attention</CardTitle>
            {(pendingCount > 0 || duplicates.length > 0 || incomplete.length > 0) && (
              <AlertTriangle className="size-4 text-out-alive" />
            )}
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {pendingCount === 0 && duplicates.length === 0 && incomplete.length === 0 ? (
              <p className="text-muted-foreground">Everything looks good — no issues flagged.</p>
            ) : (
              <>
                {pendingCount > 0 && (
                  <button
                    className="flex w-full items-center justify-between rounded-md border px-3 py-2 text-left hover:bg-muted/50"
                    onClick={() => nav({ to: "/admin", search: { view: "approval" } })}
                  >
                    <span>{pendingCount} family submission(s) awaiting approval</span>
                    <Clock className="size-4 text-out-alive" />
                  </button>
                )}
                {duplicates.length > 0 && (
                  <button
                    className="flex w-full items-center justify-between rounded-md border px-3 py-2 text-left hover:bg-muted/50"
                    onClick={() => nav({ to: "/admin", search: { view: "duplicates" } })}
                  >
                    <span>{duplicates.length} duplicate name group(s)</span>
                    <Copy className="size-4 text-out-alive" />
                  </button>
                )}
                {incomplete.length > 0 && (
                  <button
                    className="flex w-full items-center justify-between rounded-md border px-3 py-2 text-left hover:bg-muted/50"
                    onClick={() => nav({ to: "/admin", search: { view: "incomplete" } })}
                  >
                    <span>{incomplete.length} member(s) without parents</span>
                    <GitBranch className="size-4 text-out-alive" />
                  </button>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Recent pending submissions</CardTitle>
          {pendingCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => nav({ to: "/admin", search: { view: "approval" } })}
            >
              View all
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-2">
          {pendingCount === 0 ? (
            <p className="text-sm text-muted-foreground">No pending submissions right now.</p>
          ) : (
            pendingSubmissions.slice(0, 5).map((sub) => (
              <div
                key={sub.id}
                className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{sub.form.father.name || "Family submission"}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {sub.form.submitter.name || "Unknown"} • {sub.form.location || "—"}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {sub.member_ids.childIds.length} child(ren)
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
