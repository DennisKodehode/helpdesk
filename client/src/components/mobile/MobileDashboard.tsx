import { TicketView } from "@helpdesk/core";
import CategoryBreakdownCard from "@/components/CategoryBreakdownCard";
import AiThisWeekCard from "@/components/dashboard/AiThisWeekCard";
import NeedsAttentionCard from "@/components/dashboard/NeedsAttentionCard";
import { Link } from "@/components/ui/link";
import { Skeleton } from "@/components/ui/skeleton";
import { useStats } from "@/lib/stats";
import { cn } from "@/lib/utils";
import MobileHead from "./MobileHead";

type Tone = "amb" | "vio" | "zin" | "eme";

const DOT: Record<Tone, string> = {
  amb: "bg-amb-dot",
  vio: "bg-vio-dot",
  zin: "bg-zin-dot",
  eme: "bg-eme-dot",
};

function StatTile({
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
      className="rounded-[var(--r-lg)] border border-border bg-card px-4 py-[15px] transition-colors hover:bg-panel-2"
    >
      <span className="label-meta inline-flex items-center gap-1.5 text-[10px]">
        <span aria-hidden className={cn("size-1.5 rounded-full", DOT[tone])} />
        {label}
      </span>
      <div className="display-serif tabular my-1.5 text-[38px] leading-none text-foreground">
        {value.toLocaleString()}
      </div>
      <span className="font-mono text-[9.5px] uppercase tracking-[0.05em] text-ink-4">
        {caption}
      </span>
    </Link>
  );
}

export default function MobileDashboard() {
  const { data: stats, isPending } = useStats();

  return (
    <>
      <MobileHead title="Dashboard" />

      <div className="grid grid-cols-2 gap-3 px-4">
        {isPending || !stats ? (
          Array.from({ length: 4 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length skeleton
            <Skeleton key={i} className="h-[104px] rounded-[var(--r-lg)]" />
          ))
        ) : (
          <>
            <StatTile
              to="/tickets?status=open"
              label="Open"
              value={stats.openTickets}
              caption="awaiting an agent"
              tone="amb"
            />
            <StatTile
              to="/tickets?status=triaging"
              label="Needs triage"
              value={stats.triagingTickets}
              caption="new + processing"
              tone="vio"
            />
            <StatTile
              to="/tickets?view=unassigned"
              label="Unassigned"
              value={stats.unassignedTickets}
              caption="no owner yet"
              tone="zin"
            />
            <StatTile
              to={`/tickets?view=${TicketView.recently_resolved}`}
              label="Resolved · 7d"
              value={stats.resolvedLast7d}
              caption="last 7 days"
              tone="eme"
            />
          </>
        )}
      </div>

      {/* Reused self-contained dashboard cards, stacked for the phone. */}
      <div className="space-y-4 px-4 pt-4">
        <AiThisWeekCard />
        <NeedsAttentionCard />
        <CategoryBreakdownCard />
      </div>
    </>
  );
}
