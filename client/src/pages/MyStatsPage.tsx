import { ArrowUpRight, Inbox } from "lucide-react";
import { Link } from "@/components/ui/link";
import { Skeleton } from "@/components/ui/skeleton";
import ErrorAlert from "@/components/ui/ErrorAlert";
import PageHeader from "@/components/ui/PageHeader";
import StatCard from "@/components/ui/StatCard";
import { usePersonalStats } from "@/lib/personal-stats";
import { formatMinutes } from "@/lib/format";
import { cn } from "@/lib/utils";

const RESOLVED_DRILL = "/my-tickets?active=resolved";

const STAT_LINK_BASE =
  "group relative block bg-card transition-colors duration-150 " +
  "hover:bg-accent/40 " +
  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring";

function StatCardLink({
  to,
  label,
  value,
  hint,
  ariaSuffix,
}: {
  to: string;
  label: string;
  value: string;
  hint?: string;
  ariaSuffix?: string;
}) {
  return (
    <Link
      to={to}
      className={STAT_LINK_BASE}
      aria-label={`${label}: ${value}${ariaSuffix ? ` — ${ariaSuffix}` : ""}`}
    >
      <ArrowUpRight
        aria-hidden
        className="pointer-events-none absolute right-4 top-4 size-3 text-muted-foreground/30 transition-colors duration-150 group-hover:text-foreground group-focus-visible:text-foreground"
      />
      <StatCard label={label} value={value} hint={hint} />
    </Link>
  );
}

export default function MyStatsPage() {
  const { data: stats, isPending, isError } = usePersonalStats(true);

  return (
    <main className="mx-auto max-w-6xl px-4 pt-6 pb-12 sm:px-6 md:px-8 md:pt-12 md:pb-16 lg:px-10 xl:px-12 xl:pt-16 2xl:px-16 2xl:pt-20">
      <PageHeader
        eyebrow="Personal"
        title="My stats"
        description="Tickets and replies attributed to you, plus the speed you've been turning them around at."
      />

      {isError && (
        <div className="mb-6">
          <ErrorAlert message="Failed to load your stats" />
        </div>
      )}

      {isPending || !stats ? (
        <LoadingShell />
      ) : (
        <div className="space-y-6">
          {/* Hero — Open queue, with resolved counters on the side */}
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <div className="grid items-stretch md:grid-cols-[1.4fr_1fr]">
              <Link
                to="/my-tickets"
                className="group relative block p-8 transition-colors duration-150 hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring xl:p-12 2xl:p-16"
                aria-label={`Open on your plate: ${stats.openOnMyPlate} — go to my tickets`}
              >
                <div className="flex items-center gap-2">
                  <Inbox className="size-3.5 text-primary" aria-hidden />
                  <p className="label-meta">Open on my plate</p>
                </div>

                <div className="mt-5 flex items-baseline gap-4">
                  <span className="display-serif tabular text-[96px] leading-[0.85] tracking-[-0.02em] text-foreground xl:text-[128px] 2xl:text-[160px]">
                    {stats.openOnMyPlate.toLocaleString()}
                  </span>
                  <span className="display-serif text-3xl text-muted-foreground/60">
                    {stats.openOnMyPlate === 1 ? "ticket" : "tickets"}
                  </span>
                </div>

                <p className="mt-5 max-w-sm text-[13px] leading-relaxed text-muted-foreground">
                  Unresolved tickets currently assigned to you.
                </p>

                <span className="mt-5 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-primary transition-colors group-hover:text-foreground">
                  Open my queue
                  <ArrowUpRight className="size-3 transition-transform group-hover:-translate-y-px group-hover:translate-x-px" />
                </span>
              </Link>

              <div className="hairline-l grid grid-rows-2 divide-y divide-[var(--hairline)]">
                <StatCardLink
                  to={RESOLVED_DRILL}
                  label="Resolved · last 30 days"
                  value={stats.resolved30d.toLocaleString()}
                  hint="tickets you closed"
                  ariaSuffix="view your resolved tickets"
                />
                <StatCardLink
                  to={RESOLVED_DRILL}
                  label="Resolved · lifetime"
                  value={stats.resolvedLifetime.toLocaleString()}
                  hint="all-time"
                  ariaSuffix="view your resolved tickets"
                />
              </div>
            </div>
          </div>

          {/* Supporting row — speed + activity, plain cards (no drill-downs) */}
          <div className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
            <div className="bg-card">
              <StatCard
                label="Avg. resolution"
                value={formatMinutes(stats.avgResolutionMinutes)}
                hint="arrival → resolved"
              />
            </div>
            <div className="bg-card">
              <StatCard
                label="Avg. first reply"
                value={formatMinutes(stats.avgFirstResponseMinutes)}
                hint="when you reply first"
              />
            </div>
            <div className="bg-card">
              <StatCard
                label="Replies · last 30 days"
                value={stats.replies30d.toLocaleString()}
                hint="messages you sent"
              />
            </div>
            <div className="bg-card">
              <StatCard
                label="Replies · lifetime"
                value={stats.repliesLifetime.toLocaleString()}
                hint="all-time"
              />
            </div>
          </div>

          {/* Quiet attribution note — important context, not a flourish */}
          <p className="pt-2 text-[11px] leading-relaxed text-muted-foreground/70">
            <span className="font-mono uppercase tracking-[0.14em] text-muted-foreground/60">
              Note —{" "}
            </span>
            Throughput and resolution time credit the agent currently assigned to a ticket.
            Reply counts and first-response time follow your authorship and are unaffected by reassignment.
          </p>
        </div>
      )}
    </main>
  );
}

/* ─── Loading shell ─────────────────────────────────────────────── */

function LoadingShell() {
  return (
    <div className="space-y-6" aria-label="Loading stats">
      <div className="rounded-lg border border-border bg-card">
        <div className="grid items-stretch md:grid-cols-[1.4fr_1fr]">
          <div className="p-8 xl:p-12 2xl:p-16">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="mt-5 h-24 w-32 xl:h-32 xl:w-40" />
            <Skeleton className="mt-5 h-3 w-56" />
          </div>
          <div className="hairline-l grid grid-rows-2 divide-y divide-[var(--hairline)]">
            <LoadingCell />
            <LoadingCell />
          </div>
        </div>
      </div>
      <div className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
        <LoadingCell />
        <LoadingCell />
        <LoadingCell />
        <LoadingCell />
      </div>
    </div>
  );
}

function LoadingCell({ className }: { className?: string }) {
  return (
    <div className={cn("bg-card px-5 py-5 xl:px-7 xl:py-7 2xl:px-9 2xl:py-9", className)}>
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-3 h-10 w-20" />
      <Skeleton className="mt-3 h-3 w-32" />
    </div>
  );
}
