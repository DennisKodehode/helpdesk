import type { RecentActivityResponse } from "@helpdesk/core";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { Link } from "@/components/ui/link";
import { Skeleton } from "@/components/ui/skeleton";
import { auditSummary, auditVisual } from "@/lib/audit-display";
import { formatRelative } from "@/lib/ticket-ui";
import { cn } from "@/lib/utils";

const TONE_RING: Record<string, string> = {
  ai: "bg-accent-tint-2 text-accent-ink",
  warn: "bg-amb-bg text-amb-fg",
  neutral: "bg-panel-2 text-ink-3",
};

export default function RecentActivityCard() {
  const query = useQuery<RecentActivityResponse>({
    queryKey: ["stats", "recent-activity"],
    queryFn: ({ signal }) =>
      axios
        .get<RecentActivityResponse>("/api/stats/recent-activity", { signal })
        .then((r) => r.data),
  });

  return (
    <section
      aria-labelledby="recent-activity-heading"
      className="rounded-[var(--r-lg)] border border-border bg-card px-6 py-[22px]"
    >
      <h2 id="recent-activity-heading" className="eyebrow mb-[18px]">
        Recent activity
      </h2>

      <div>
        {query.isLoading ? (
          <ul className="space-y-4" aria-label="Loading activity">
            {Array.from({ length: 5 }).map((_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length skeleton
              <li key={i} className="flex items-center gap-3">
                <Skeleton className="size-7 rounded-full" />
                <Skeleton className="h-3 w-2/3" />
              </li>
            ))}
          </ul>
        ) : query.isError ? (
          <p className="py-6 text-center font-mono text-[12px] text-ink-3">
            Failed to load activity.
          </p>
        ) : query.data && query.data.length > 0 ? (
          <ol className="relative space-y-4" aria-label="Recent activity">
            {/* Vertical timeline rule behind the round type-icons. */}
            <span
              aria-hidden
              className="absolute left-[13px] top-4 bottom-4 w-px bg-border"
            />
            {query.data.map((row) => {
              const { Icon, tone } = auditVisual(row.type);
              return (
                <li key={row.id} className="flex items-start gap-3">
                  <span
                    aria-hidden
                    className={cn(
                      "grid size-7 shrink-0 place-items-center rounded-full",
                      TONE_RING[tone],
                    )}
                  >
                    <Icon className="size-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] text-foreground">
                      {auditSummary(row)}{" "}
                      <Link
                        to={`/tickets/${row.ticketId}`}
                        className="font-mono text-accent-ink hover:underline"
                      >
                        #{String(row.ticketId).padStart(4, "0")}
                      </Link>
                    </p>
                    <p className="truncate text-[12px] text-ink-3">{row.ticketSubject}</p>
                  </div>
                  <span className="shrink-0 font-mono tabular text-[10.5px] text-ink-4">
                    {formatRelative(row.createdAt)}
                  </span>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="py-6 text-center font-mono text-[12px] text-ink-3">
            No activity yet.
          </p>
        )}
      </div>
    </section>
  );
}
