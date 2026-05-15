import { TrendingUp } from "lucide-react";
import type { StatsResponse } from "@helpdesk/core";

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
      <p className="label-meta">{label}</p>
      <p className="display-serif tabular text-[44px] leading-none text-foreground xl:text-[56px] 2xl:text-[64px]">
        {value}
      </p>
      {hint && (
        <p className="font-mono text-[11px] text-muted-foreground/80">{hint}</p>
      )}
    </div>
  );
}

export default function DashboardStats({ stats }: { stats: StatsResponse }) {
  const aiRate = stats.percentResolvedByAI;
  const aiRateStr = `${aiRate.toFixed(1)}%`;

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
                <span className="text-foreground tabular">{stats.resolvedByAI.toLocaleString()}</span>{" "}
                of <span className="text-foreground tabular">{stats.totalTickets.toLocaleString()}</span>{" "}
                tickets resolved automatically — without an agent ever touching them.
              </p>
            </div>
          </div>

          <div className="hairline-l grid grid-rows-2 divide-y divide-[var(--hairline)]">
            <Stat
              label="Avg. resolution"
              value={formatMinutes(stats.avgResolutionMinutes)}
              hint="time to first resolve"
            />
            <Stat
              label="Resolved by AI"
              value={stats.resolvedByAI.toLocaleString()}
              hint={aiRateStr + " of all"}
            />
          </div>
        </div>
      </div>

      {/* Supporting row — three quiet stats */}
      <div className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-3">
        <div className="bg-card">
          <Stat label="Total tickets" value={stats.totalTickets.toLocaleString()} />
        </div>
        <div className="bg-card">
          <Stat label="Open" value={stats.openTickets.toLocaleString()} />
        </div>
        <div className="bg-card">
          <Stat label="Closed" value={stats.closedTickets.toLocaleString()} />
        </div>
      </div>
    </div>
  );
}
