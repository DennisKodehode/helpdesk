import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import ErrorAlert from "@/components/ui/ErrorAlert";
import PageHeader from "@/components/ui/PageHeader";
import DashboardStats from "@/components/DashboardStats";
import TicketsBarChart from "@/components/TicketsBarChart";
import type { StatsResponse, TicketsPerDayResponse } from "@helpdesk/core";

function StatCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <CardTitle><Skeleton className="h-4 w-32" /></CardTitle>
      </CardHeader>
      <CardContent>
        <Skeleton className="h-9 w-20" />
      </CardContent>
    </Card>
  );
}

export default function HomePage() {
  const statsQuery = useQuery<StatsResponse>({
    queryKey: ["stats"],
    queryFn: () => axios.get<StatsResponse>("/api/stats").then((r) => r.data),
  });

  const chartQuery = useQuery<TicketsPerDayResponse>({
    queryKey: ["stats", "tickets-per-day"],
    queryFn: () => axios.get<TicketsPerDayResponse>("/api/stats/tickets-per-day").then((r) => r.data),
  });

  return (
    <main className="p-8 space-y-6">
      <PageHeader title="Dashboard" />

      {statsQuery.isError && (
        <ErrorAlert message={statsQuery.error instanceof Error ? statsQuery.error.message : "Failed to load dashboard stats"} />
      )}

      {statsQuery.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>
      ) : statsQuery.data ? (
        <DashboardStats stats={statsQuery.data} />
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tickets per day — last 30 days</CardTitle>
        </CardHeader>
        <CardContent>
          {chartQuery.isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : chartQuery.isError ? (
            <ErrorAlert message="Failed to load chart data" />
          ) : chartQuery.data ? (
            <TicketsBarChart data={chartQuery.data} />
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}
