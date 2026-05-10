import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { StatsResponse } from "@helpdesk/core";

function formatMinutes(minutes: number | null): string {
  if (minutes === null) return "—";
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function StatCard({ title, value }: { title: string; value: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold tracking-tight">{value}</p>
      </CardContent>
    </Card>
  );
}

export default function DashboardStats({ stats }: { stats: StatsResponse }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <StatCard title="Total Tickets" value={String(stats.totalTickets)} />
      <StatCard title="Open Tickets" value={String(stats.openTickets)} />
      <StatCard title="Resolved by AI" value={String(stats.resolvedByAI)} />
      <StatCard title="AI Resolution Rate" value={`${stats.percentResolvedByAI.toFixed(1)}%`} />
      <StatCard title="Avg. Resolution Time" value={formatMinutes(stats.avgResolutionMinutes)} />
    </div>
  );
}
