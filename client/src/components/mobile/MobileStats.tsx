import { ArrowUpRight, Inbox } from "lucide-react";
import { useNavigate } from "react-router";
import ErrorAlert from "@/components/ui/ErrorAlert";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMinutes } from "@/lib/format";
import { usePersonalStats } from "@/lib/personal-stats";
import MobileHead from "./MobileHead";

function MiniStat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="flex min-h-[116px] flex-col justify-between rounded-[var(--r-lg)] border border-border bg-card p-4">
      <p className="label-meta text-[10px]">{label}</p>
      <div>
        <div className="display-serif tabular text-[36px] leading-[0.95] text-foreground">
          {value}
        </div>
        <span className="font-mono text-[9.5px] uppercase tracking-[0.05em] text-ink-4">
          {hint}
        </span>
      </div>
    </div>
  );
}

export default function MobileStats() {
  const navigate = useNavigate();
  const { data: stats, isPending, isError } = usePersonalStats(true);

  return (
    <>
      <MobileHead title="My stats" sub="Tickets and replies attributed to you." />

      {isError && (
        <div className="px-4">
          <ErrorAlert message="Failed to load your stats" />
        </div>
      )}

      {isPending || !stats ? (
        <div className="space-y-3 px-4" role="status" aria-label="Loading stats">
          <Skeleton className="h-40 w-full rounded-[var(--r-lg)]" />
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length skeleton
              <Skeleton key={i} className="h-[116px] rounded-[var(--r-lg)]" />
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="px-4 pb-3.5">
            <div className="rounded-[var(--r-lg)] border border-border bg-card px-[22px] pt-[22px] pb-5">
              <span className="label-meta inline-flex items-center gap-1.5">
                <Inbox className="size-3.5 text-primary" aria-hidden /> Open on my plate
              </span>
              <div className="mt-2.5 flex items-baseline gap-2.5">
                <span className="display-serif tabular text-[84px] leading-[0.82] text-foreground">
                  {stats.openOnMyPlate.toLocaleString()}
                </span>
                <span className="display-serif text-[22px] text-muted-foreground/60">
                  {stats.openOnMyPlate === 1 ? "ticket" : "tickets"}
                </span>
              </div>
              <button
                type="button"
                onClick={() => navigate("/my-tickets")}
                className="mt-4 inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.1em] text-accent-ink"
              >
                Open my queue <ArrowUpRight className="size-3" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 px-4">
            <MiniStat
              label="Resolved · 30d"
              value={stats.resolved30d.toLocaleString()}
              hint="tickets you closed"
            />
            <MiniStat
              label="Resolved · lifetime"
              value={stats.resolvedLifetime.toLocaleString()}
              hint="all-time"
            />
            <MiniStat
              label="Avg. resolution"
              value={formatMinutes(stats.avgResolutionMinutes)}
              hint="arrival → resolved"
            />
            <MiniStat
              label="Avg. first reply"
              value={formatMinutes(stats.avgFirstResponseMinutes)}
              hint="when you reply first"
            />
            <MiniStat
              label="Replies · 30d"
              value={stats.replies30d.toLocaleString()}
              hint="messages sent"
            />
            <MiniStat
              label="Replies · lifetime"
              value={stats.repliesLifetime.toLocaleString()}
              hint="all-time"
            />
          </div>
        </>
      )}
    </>
  );
}
