import type { StatsResponse, TicketsPerDayResponse } from "@helpdesk/core";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import CategoryBreakdownCard from "@/components/CategoryBreakdownCard";
import DashboardStats from "@/components/DashboardStats";
import SlaHealthCard from "@/components/SlaHealthCard";
import TicketsBarChart from "@/components/TicketsBarChart";
import ErrorAlert from "@/components/ui/ErrorAlert";
import PageHeader from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";

function DashboardSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading dashboard">
      <div className="rounded-lg border border-border bg-card p-8">
        <Skeleton className="h-4 w-32 mb-4" />
        <Skeleton className="h-24 w-48" />
      </div>
      <div className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholder; never reorders
          <div key={i} className="bg-card p-5">
            <Skeleton className="h-3 w-24 mb-3" />
            <Skeleton className="h-10 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function HomePage() {
  const statsQuery = useQuery<StatsResponse>({
    queryKey: ["stats"],
    queryFn: ({ signal }) =>
      axios.get<StatsResponse>("/api/stats", { signal }).then((r) => r.data),
  });

  const chartQuery = useQuery<TicketsPerDayResponse>({
    queryKey: ["stats", "tickets-per-day"],
    queryFn: ({ signal }) =>
      axios
        .get<TicketsPerDayResponse>("/api/stats/tickets-per-day", { signal })
        .then((r) => r.data),
  });

  return (
    <main className="mx-auto max-w-6xl px-4 pt-6 pb-12 sm:px-6 md:px-8 md:pt-12 md:pb-16 lg:px-10 xl:px-12 xl:pt-16 2xl:px-16 2xl:pt-20">
      <PageHeader
        eyebrow="Overview"
        title="Dashboard"
        description="A snapshot of inbound volume, automated resolutions, and where your team is spending its time."
      />

      {statsQuery.isError && (
        <div className="mb-6">
          <ErrorAlert
            message={
              statsQuery.error instanceof Error
                ? statsQuery.error.message
                : "Failed to load dashboard stats"
            }
          />
        </div>
      )}

      {statsQuery.isLoading ? (
        <DashboardSkeleton />
      ) : statsQuery.data ? (
        <DashboardStats stats={statsQuery.data} />
      ) : null}

      {/* Trend section */}
      <section className="mt-10 rounded-lg border border-border bg-card p-6">
        {chartQuery.isLoading ? (
          <Skeleton className="h-72 w-full" />
        ) : chartQuery.isError ? (
          <ErrorAlert message="Failed to load chart data" />
        ) : chartQuery.data ? (
          <TicketsBarChart data={chartQuery.data} />
        ) : null}
      </section>

      {/* Operational signal: SLA load + queue composition */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <SlaHealthCard />
        <CategoryBreakdownCard />
      </div>
    </main>
  );
}
