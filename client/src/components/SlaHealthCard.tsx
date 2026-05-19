import type { SlaHealthResponse } from "@helpdesk/core";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { ArrowUpRight } from "lucide-react";
import ErrorAlert from "@/components/ui/ErrorAlert";
import { Link } from "@/components/ui/link";
import { Skeleton } from "@/components/ui/skeleton";

function metricBreakdownTitle(
  prefix: string,
  byMetric: SlaHealthResponse["byMetric"],
  state: "breached" | "atRisk",
): string {
  const fr = byMetric.firstResponse[state];
  const res = byMetric.resolution[state];
  return `${prefix} — First-response: ${fr} · Resolution: ${res}`;
}

function StatColumn({
  label,
  value,
  dotClass,
  valueClass,
  title,
}: {
  label: string;
  value: number;
  dotClass: string;
  valueClass: string;
  title?: string;
}) {
  return (
    <div className="flex flex-col gap-2 px-5 py-5 xl:px-7 xl:py-6" title={title}>
      <div className="flex items-center gap-2">
        <span aria-hidden className={`size-1.5 rounded-full ${dotClass}`} />
        <p className="label-meta">{label}</p>
      </div>
      <p
        className={`display-serif tabular text-[44px] leading-none xl:text-[52px] ${valueClass}`}
      >
        {value}
      </p>
    </div>
  );
}

function SlaHealthCardSkeleton() {
  return (
    <section
      className="rounded-lg border border-border bg-card"
      role="status"
      aria-label="Loading SLA health"
    >
      <div className="border-b border-[var(--hairline)] px-6 py-4">
        <Skeleton className="h-3 w-24" />
      </div>
      <div className="grid gap-px overflow-hidden bg-border sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: skeleton placeholder; never reorders
          <div key={i} className="bg-card p-5">
            <Skeleton className="h-3 w-16 mb-3" />
            <Skeleton className="h-10 w-12" />
          </div>
        ))}
      </div>
    </section>
  );
}

export default function SlaHealthCard() {
  const query = useQuery<SlaHealthResponse>({
    queryKey: ["stats", "sla-health"],
    queryFn: () =>
      axios.get<SlaHealthResponse>("/api/stats/sla-health").then((r) => r.data),
  });

  if (query.isLoading) return <SlaHealthCardSkeleton />;

  if (query.isError) {
    return (
      <section className="rounded-lg border border-border bg-card p-6">
        <ErrorAlert
          message={
            query.error instanceof Error
              ? query.error.message
              : "Failed to load SLA health"
          }
        />
      </section>
    );
  }

  const data = query.data;
  if (!data) return null;

  return (
    <section
      className="rounded-lg border border-border bg-card"
      aria-labelledby="sla-health-heading"
    >
      <div className="flex items-center justify-between border-b border-[var(--hairline)] px-6 py-4">
        <div>
          <h2 id="sla-health-heading" className="label-meta mb-0">
            SLA health
          </h2>
          <p className="font-mono text-[11px] text-muted-foreground/80 mt-1">
            {data.total === 0
              ? "no active tickets"
              : `${data.total} active ${data.total === 1 ? "ticket" : "tickets"}`}
          </p>
        </div>
      </div>

      {data.total === 0 ? (
        <p className="px-6 py-10 text-center font-mono text-[12px] text-muted-foreground">
          Nothing to track right now.
        </p>
      ) : (
        <div className="grid gap-px overflow-hidden bg-border sm:grid-cols-3">
          <Link
            to="/tickets?breachedOnly=true"
            className="group relative block bg-card transition-colors duration-150 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring"
            aria-label={`Breached: ${data.breached} — view breached tickets`}
          >
            <ArrowUpRight
              className="pointer-events-none absolute right-3 top-3 size-3 text-muted-foreground/30 transition-colors duration-150 group-hover:text-foreground group-focus-visible:text-foreground"
              aria-hidden
            />
            <StatColumn
              label="Breached"
              value={data.breached}
              dotClass="bg-rose-500"
              valueClass={
                data.breached > 0 ? "text-rose-600 dark:text-rose-400" : "text-foreground"
              }
              title={metricBreakdownTitle("Breached", data.byMetric, "breached")}
            />
          </Link>
          <div className="bg-card">
            <StatColumn
              label="At risk"
              value={data.atRisk}
              dotClass="bg-amber-500"
              valueClass={
                data.atRisk > 0 ? "text-amber-600 dark:text-amber-400" : "text-foreground"
              }
              title={metricBreakdownTitle("At risk", data.byMetric, "atRisk")}
            />
          </div>
          <div className="bg-card">
            <StatColumn
              label="On track"
              value={data.ok}
              dotClass="bg-emerald-500"
              valueClass="text-foreground"
            />
          </div>
        </div>
      )}
    </section>
  );
}
