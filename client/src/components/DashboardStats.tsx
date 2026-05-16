import { ArrowUpRight, TrendingUp } from "lucide-react";
import { Link } from "@/components/ui/link";
import { type StatsResponse, TicketStatus } from "@helpdesk/core";

function formatMinutes(minutes: number | null): string {
  if (minutes === null) return "—";
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

interface StatProps {
  label: string;
  value: string;
  hint?: string;
}

function Stat({ label, value, hint }: StatProps) {
  return (
    <div className="flex flex-col gap-2 px-5 py-5 xl:px-7 xl:py-7 2xl:px-9 2xl:py-9">
      <p className="label-meta transition-colors duration-150 group-hover:text-foreground group-focus-visible:text-foreground">
        {label}
      </p>
      <p className="display-serif tabular text-[44px] leading-none text-foreground xl:text-[56px] 2xl:text-[64px]">
        {value}
      </p>
      {hint && (
        <p className="font-mono text-[11px] text-muted-foreground/80">{hint}</p>
      )}
    </div>
  );
}

const STAT_LINK_BASE =
  "group relative block bg-card transition-colors duration-150 " +
  "hover:bg-accent/40 " +
  "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring";

function StatCardLink({ to, label, value }: { to: string; label: string; value: string }) {
  return (
    <Link to={to} className={STAT_LINK_BASE} aria-label={`${label}: ${value} — view tickets`}>
      <ArrowUpRight
        className="pointer-events-none absolute right-4 top-4 size-3 text-muted-foreground/30 transition-colors duration-150 group-hover:text-foreground group-focus-visible:text-foreground"
        aria-hidden
      />
      <Stat label={label} value={value} />
    </Link>
  );
}

export default function DashboardStats({ stats }: { stats: StatsResponse }) {
  const aiRate = stats.percentResolvedByAILast30d;

  return (
    <div className="space-y-6">
      {/* Hero: AI resolution rate — the headline number */}
      <div className="rounded-lg border border-border bg-card">
        <div className="grid items-stretch md:grid-cols-[1.4fr_1fr]">
          <div className="relative overflow-hidden p-8 xl:p-12 2xl:p-16">
            {/* Faint serif glyph as backdrop */}
            <span
              aria-hidden
              className="display-serif pointer-events-none absolute -right-4 -bottom-12 select-none text-[280px] leading-none text-primary/[0.05] xl:text-[360px] 2xl:text-[440px]"
            >
              %
            </span>

            <div className="relative space-y-5">
              <div className="flex items-center gap-2">
                <p className="label-meta">AI Resolution Rate</p>
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-mono text-primary tabular">
                  <TrendingUp className="size-2.5" />
                  last 30 days
                </span>
              </div>

              <div className="flex items-baseline gap-3">
                <span className="display-serif tabular text-[96px] leading-[0.85] tracking-[-0.02em] text-foreground xl:text-[128px] 2xl:text-[160px]">
                  {aiRate.toFixed(1)}
                </span>
                <span className="display-serif text-4xl text-muted-foreground/60">
                  %
                </span>
              </div>

              <p className="max-w-sm text-[13px] leading-relaxed text-muted-foreground">
                <span className="text-foreground tabular">{Math.round(aiRate)}%</span>{" "}
                of tickets received in the last 30 days were resolved
                automatically — without an agent ever touching them.
              </p>
            </div>
          </div>

          <div className="hairline-l grid grid-rows-2 divide-y divide-[var(--hairline)]">
            <Stat
              label="Avg. resolution"
              value={formatMinutes(stats.avgResolutionMinutes)}
              hint="arrival → resolved"
            />
            <Stat
              label="Resolved by AI"
              value={stats.resolvedByAI.toLocaleString()}
              hint="tickets, all-time"
            />
          </div>
        </div>
      </div>

      {/* Supporting row — quiet stats, each a drill-down to filtered tickets */}
      <div className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        <StatCardLink to="/tickets" label="Total tickets" value={stats.totalTickets.toLocaleString()} />
        <StatCardLink to={`/tickets?status=${TicketStatus.open}`} label="Open" value={stats.openTickets.toLocaleString()} />
        <StatCardLink to={`/tickets?status=${TicketStatus.open}&assignee=unassigned`} label="Unassigned" value={stats.unassignedTickets.toLocaleString()} />
        <StatCardLink to={`/tickets?status=${TicketStatus.resolved}`} label="Resolved" value={stats.resolvedTickets.toLocaleString()} />
        <StatCardLink to={`/tickets?status=${TicketStatus.closed}`} label="Closed" value={stats.closedTickets.toLocaleString()} />
      </div>
    </div>
  );
}
