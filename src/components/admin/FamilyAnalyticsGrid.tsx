import type { FamilyAnalytics } from "@/lib/admin-family-units";

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-card px-3 py-2 md:px-4 md:py-3">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground md:text-xs">
        {label}
      </p>
      <p className="text-lg font-bold leading-tight md:text-2xl">{value}</p>
    </div>
  );
}

type Props = {
  analytics: FamilyAnalytics;
};

export function FamilyAnalyticsGrid({ analytics }: Props) {
  const items: { label: string; value: number }[] = [
    { label: "Total", value: analytics.total },
    { label: "Generations", value: analytics.generations },
    { label: "Families", value: analytics.families },
    { label: "Males", value: analytics.males },
    { label: "Females", value: analytics.females },
    { label: "Alive", value: analytics.alive },
    { label: "Dead", value: analytics.dead },
  ];

  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-7 lg:gap-3">
      {items.map((item) => (
        <StatCard key={item.label} label={item.label} value={item.value} />
      ))}
    </div>
  );
}
