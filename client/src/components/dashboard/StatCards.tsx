import { type SlaHealthResponse, type StatsResponse, TicketView } from "@helpdesk/core";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { ArrowUpRight } from "lucide-react";
import { Link } from "@/components/ui/link";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type Tone = "amb" | "vio" | "ros" | "eme";

const DOT: Record<Tone, string> = {
  amb: "bg-amb-dot",
  vio: "bg-vio-dot",
  ros: "bg-ros-dot",
  eme: "bg-eme-dot",
};

function DashboardStatCard({
  to,
  label,
  value,
  caption,
  tone,
}: {
  to: string;
  label: string;
  value: number;
  caption: string;
  tone: Tone;
}) {
  return (
    <Link
      to={to}
      aria-label={`${label}: ${value} — view tickets`}
      className="group relative block rounded-[var(--r-lg)] border border-border bg-card px-[22px] py-5 transition-all duration-150 hover:-translate-y-[2px] hover:shadow-[var(--shadow-md)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring"
    >
      <ArrowUpRight
        aria-hidden
        className="pointer-events-none absolute right-4 top-4 size-3 text-ink-4 opacity-40 transition-opacity duration-150 group-hover:opacity-100"
      />
      <div className="flex items-center gap-2">
        <span aria-hidden className={cn("size-1.5 rounded-full", DOT[tone])} />
        <p className="label-meta">{label}</p>
      </div>
      <p className="display-serif tabular mt-[14px] mb-2 text-[46px] leading-none text-foreground">
        {value.toLocaleString()}
      </p>
      <p className="font-mono text-[11px] uppercase tracking-[0.06em] text-ink-4">
        {caption}
      </p>
    </Link>
  );
}

function CardSkeleton() {
  return (
    <div className="rounded-[var(--r-lg)] border border-border bg-card px-[22px] py-5">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-[14px] h-10 w-16" />
      <Skeleton className="mt-2 h-3 w-20" />
    </div>
  );
}

export default function StatCards() {
  const statsQuery = useQuery<StatsResponse>({
    queryKey: ["stats"],
    queryFn: ({ signal }) =>
      axios.get<StatsResponse>("/api/stats", { signal }).then((r) => r.data),
  });
  const slaQuery = useQuery<SlaHealthResponse>({
    queryKey: ["stats", "sla-health"],
    queryFn: ({ signal }) =>
      axios
        .get<SlaHealthResponse>("/api/stats/sla-health", { signal })
        .then((r) => r.data),
  });

  if (statsQuery.isLoading || slaQuery.isLoading) {
    return (
      <div
        className="grid gap-4 sm:grid-cols-2 md:grid-cols-4"
        role="status"
        aria-label="Loading stats"
      >
        {Array.from({ length: 4 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length skeleton
          <CardSkeleton key={i} />
        ))}
      </div>
    );
  }

  const stats = statsQuery.data;
  const sla = slaQuery.data;
  if (!stats || !sla) return null;

  return (
    <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
      <DashboardStatCard
        to="/tickets?status=open"
        label="Open"
        value={stats.openTickets}
        caption="awaiting an agent"
        tone="amb"
      />
      <DashboardStatCard
        to="/tickets?status=triaging"
        label="Needs triage"
        value={stats.triagingTickets}
        caption="new + processing"
        tone="vio"
      />
      <DashboardStatCard
        to="/tickets?breachedOnly=true"
        label="SLA breached"
        value={sla.breached}
        caption="past target"
        tone="ros"
      />
      <DashboardStatCard
        to={`/tickets?view=${TicketView.recently_resolved}`}
        label="Resolved · 7d"
        value={stats.resolvedLast7d}
        caption="last 7 days"
        tone="eme"
      />
    </div>
  );
}
