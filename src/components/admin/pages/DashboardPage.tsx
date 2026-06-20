import { useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { AlertTriangle, Clock, MessageSquare, Users } from "lucide-react";

import { FamilyAnalyticsGrid } from "@/components/admin/FamilyAnalyticsGrid";
import { countSubmissionsWithDuplicates } from "@/components/admin/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buildFamilyUnits, computeFamilyAnalytics } from "@/lib/admin-family-units";
import { fetchWives } from "@/lib/family";
import type { AdminData } from "../types";

const COLORS = ["#2f7d4f", "#888", "#e6a817", "#6b4423"];

type Props = {
  data: AdminData;
  feedbackCount: number;
};

export function DashboardPage({ data, feedbackCount }: Props) {
  const nav = useNavigate();
  const { pendingSubmissions, approved, duplicates, all } = data;
  const submissionsWithDuplicates = useMemo(
    () => countSubmissionsWithDuplicates(pendingSubmissions, all),
    [pendingSubmissions, all],
  );
  const { data: wives = [] } = useQuery({ queryKey: ["wives"], queryFn: fetchWives });

  const familyAnalytics = useMemo(() => {
    const units = buildFamilyUnits(approved, wives);
    return computeFamilyAnalytics(approved, units);
  }, [approved, wives]);

  const stats = useMemo(() => {
    const kinAlive = approved.filter((m) => m.is_in_kin && m.is_alive).length;
    const kinDead = approved.filter((m) => m.is_in_kin && !m.is_alive).length;
    const outAlive = approved.filter((m) => !m.is_in_kin && m.is_alive).length;
    const outDead = approved.filter((m) => !m.is_in_kin && !m.is_alive).length;
    return { kinAlive, kinDead, outAlive, outDead, total: approved.length };
  }, [approved]);

  const pieData = [
    { name: "In-kin alive", value: stats.kinAlive },
    { name: "In-kin dead", value: stats.kinDead },
    { name: "Out alive", value: stats.outAlive },
    { name: "Out dead", value: stats.outDead },
  ].filter((d) => d.value > 0);

  const byGen = useMemo(() => {
    const map = new Map<number, number>();
    approved.forEach((m) => map.set(m.generation_level, (map.get(m.generation_level) ?? 0) + 1));
    return [...map.entries()].sort((a, b) => a[0] - b[0]).map(([g, c]) => ({ name: `Gen ${g}`, value: c }));
  }, [approved]);

  const cards = [
    { label: "Pending approval", value: pendingSubmissions.length, icon: Clock, view: "approval" as const },
    { label: "Family members", value: approved.length, icon: Users, view: "family" as const },
    { label: "Feedbacks", value: feedbackCount, icon: MessageSquare, view: "feedbacks" as const },
  ];

  const showDuplicateAlert = duplicates.length > 0 || submissionsWithDuplicates > 0;

  return (
    <div className="space-y-6">
      <FamilyAnalyticsGrid analytics={familyAnalytics} />

      {showDuplicateAlert ? (
        <Card
          className="cursor-pointer border-amber-500/40 bg-amber-500/5"
          variant="interactive"
          onClick={() => nav({ to: "/admin", search: { view: duplicates.length > 0 ? "family" : "approval" } })}
        >
          <CardContent className="flex items-start gap-3 pt-4">
            <AlertTriangle className="mt-0.5 size-5 shrink-0 text-amber-600" />
            <div className="space-y-1 text-sm">
              <p className="font-medium text-amber-900 dark:text-amber-100">Duplicate names need review</p>
              {duplicates.length > 0 ? (
                <p className="text-muted-foreground">
                  {duplicates.length} name group{duplicates.length === 1 ? "" : "s"} already in the member list.
                </p>
              ) : null}
              {submissionsWithDuplicates > 0 ? (
                <p className="text-muted-foreground">
                  {submissionsWithDuplicates} pending submission{submissionsWithDuplicates === 1 ? "" : "s"} may overlap
                  with existing or other pending names.
                </p>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        {cards.map(({ label, value, icon: Icon, view }) => (
          <Card key={label} variant="interactive" onClick={() => nav({ to: "/admin", search: { view } })}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
              <Icon className="size-4 text-primary drop-shadow-[0_0_6px_var(--glow-primary)]" />
            </CardHeader>
            <CardContent><p className="text-3xl font-bold text-primary">{value}</p></CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Status breakdown</CardTitle></CardHeader>
          <CardContent className="h-56">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label>
                    {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center pt-16">No approved members yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">By generation</CardTitle></CardHeader>
          <CardContent className="h-56">
            {byGen.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byGen}>
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center pt-16">No data yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
