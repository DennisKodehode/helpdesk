import { ArrowUpRight, Inbox } from "lucide-react";
import MobileStats from "@/components/mobile/MobileStats";
import ErrorAlert from "@/components/ui/ErrorAlert";
import { Link } from "@/components/ui/link";
import PageContainer from "@/components/ui/PageContainer";
import PageHeader from "@/components/ui/PageHeader";
import StatCard from "@/components/ui/StatCard";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMinutes } from "@/lib/format";
import { usePersonalStats } from "@/lib/personal-stats";
import { useLayoutTier } from "@/lib/useBreakpoint";
import { cn } from "@/lib/utils";

const RESOLVED_DRILL = "/my-tickets?active=resolved";

// All hairline dividers in the stats grids share this color + width. Using
// Tailwind border classes (instead of the custom .hairline-* utilities) so
// responsive prefixes work — we need different borders at mobile vs md+.
const HAIRLINE = "border-[var(--hairline)]";

const STAT_LINK_BASE =
  "group relative block bg-card transition-colors duration-150 " +
  "hover:bg-panel-2 " +
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
  const tier = useLayoutTier();
  if (tier === "mobile") return <MobileStats />;
  return <MyStatsView />;
}

function MyStatsView() {
  const { data: stats, isPending, isError } = usePersonalStats(true);

  return (
    <PageContainer width="content">
      <PageHeader
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
          {/* Hero card — one shared 4-col grid so dividers in the hero line
              up with the supporting row below. The hero spans 2 cols × 2 rows
              on the left; the other four stats fill the 2×2 grid on the
              right. Every right-side cell uses the same StatCard rhythm. */}
          <div className="overflow-hidden rounded-[var(--r-lg)] border border-border bg-card">
            <div className="grid grid-cols-1 md:grid-cols-4 md:grid-rows-[1fr_1fr]">
              <Link
                to="/my-tickets"
                className="group relative block px-5 pt-6 pb-7 transition-colors duration-150 hover:bg-panel-2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring md:col-span-2 md:row-span-2 md:px-7 md:py-8 xl:px-9 xl:py-10 2xl:px-11 2xl:py-12"
                aria-label={`Open on your plate: ${stats.openOnMyPlate} — go to my tickets`}
              >
                <div className="flex items-center gap-2">
                  <Inbox className="size-3.5 text-primary" aria-hidden />
                  <p className="label-meta">Open on my plate</p>
                </div>

                <div className="mt-6 flex items-baseline gap-4">
                  <span className="display-serif tabular text-[88px] leading-[0.85] text-foreground md:text-[132px]">
                    {stats.openOnMyPlate.toLocaleString()}
                  </span>
                  <span className="display-serif text-[24px] text-muted-foreground/60 md:text-[30px]">
                    {stats.openOnMyPlate === 1 ? "ticket" : "tickets"}
                  </span>
                </div>

                <p className="mt-5 max-w-sm text-[14px] leading-relaxed text-muted-foreground">
                  Unresolved tickets currently assigned to you.
                </p>

                <span className="mt-6 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-primary transition-colors group-hover:text-foreground">
                  Open my queue
                  <ArrowUpRight className="size-3 transition-transform group-hover:-translate-y-px group-hover:translate-x-px" />
                </span>
              </Link>

              {/* Row 1 right — Resolved · 30 days (col 3), Resolved · lifetime (col 4) */}
              <div className={cn("border-t md:border-t-0 md:border-l", HAIRLINE)}>
                <StatCardLink
                  to={RESOLVED_DRILL}
                  label="Resolved · 30 days"
                  value={stats.resolved30d.toLocaleString()}
                  hint="tickets you closed"
                  ariaSuffix="view your resolved tickets"
                />
              </div>
              <div className={cn("border-t md:border-t-0 md:border-l", HAIRLINE)}>
                <StatCardLink
                  to={RESOLVED_DRILL}
                  label="Resolved · lifetime"
                  value={stats.resolvedLifetime.toLocaleString()}
                  hint="all-time"
                  ariaSuffix="view your resolved tickets"
                />
              </div>

              {/* Row 2 right — Avg. resolution (col 3), Avg. first reply (col 4) */}
              <div className={cn("border-t md:border-l", HAIRLINE)}>
                <StatCard
                  label="Avg. resolution"
                  value={formatMinutes(stats.avgResolutionMinutes)}
                  hint="arrival → resolved"
                />
              </div>
              <div className={cn("border-t md:border-l", HAIRLINE)}>
                <StatCard
                  label="Avg. first reply"
                  value={formatMinutes(stats.avgFirstResponseMinutes)}
                  hint="when you reply first"
                />
              </div>
            </div>
          </div>

          {/* Supporting row — replies activity in two equal cells. Sized to
              span the right half (cols 3+4) of the hero's 4-col grid, so the
              center divider at 50% aligns with the divider above. */}
          <div className="grid grid-cols-1 overflow-hidden rounded-[var(--r-lg)] border border-border bg-card sm:grid-cols-2">
            <StatCard
              label="Replies · 30 days"
              value={stats.replies30d.toLocaleString()}
              hint="messages you sent"
            />
            <div className={cn("border-t sm:border-t-0 sm:border-l", HAIRLINE)}>
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
            Throughput and resolution time credit the agent currently assigned to a
            ticket. Reply counts and first-response time follow your authorship and are
            unaffected by reassignment.
          </p>
        </div>
      )}
    </PageContainer>
  );
}

/* ─── Loading shell ─────────────────────────────────────────────── */

function LoadingShell() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading stats">
      <div className="overflow-hidden rounded-[var(--r-lg)] border border-border bg-card">
        <div className="grid grid-cols-1 md:grid-cols-4 md:grid-rows-[1fr_1fr]">
          <div className="px-5 pt-6 pb-7 md:col-span-2 md:row-span-2 md:px-7 md:py-8 xl:px-9 xl:py-10 2xl:px-11 2xl:py-12">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="mt-6 h-24 w-32 xl:h-32 xl:w-40" />
            <Skeleton className="mt-5 h-3 w-56" />
          </div>
          <LoadingCell className={cn("border-t md:border-t-0 md:border-l", HAIRLINE)} />
          <LoadingCell className={cn("border-t md:border-t-0 md:border-l", HAIRLINE)} />
          <LoadingCell className={cn("border-t md:border-l", HAIRLINE)} />
          <LoadingCell className={cn("border-t md:border-l", HAIRLINE)} />
        </div>
      </div>
      <div className="grid grid-cols-1 overflow-hidden rounded-[var(--r-lg)] border border-border bg-card sm:grid-cols-2">
        <LoadingCell />
        <LoadingCell className={cn("border-t sm:border-t-0 sm:border-l", HAIRLINE)} />
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
