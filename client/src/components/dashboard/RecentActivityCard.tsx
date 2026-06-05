import { hasAdminAccess, type RecentActivityResponse } from "@helpdesk/core";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { TicketRef } from "@/components/TicketRef";
import { Link } from "@/components/ui/link";
import { Skeleton } from "@/components/ui/skeleton";
import { ActivityIcon, auditSummary } from "@/lib/audit-display";
import { useSession } from "@/lib/auth-client";
import { formatRelative } from "@/lib/ticket-ui";

export default function RecentActivityCard() {
  const { data: session } = useSession();
  const isAdmin = hasAdminAccess(
    (session?.user as Record<string, unknown>)?.role as string | undefined,
  );

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
      <div className="mb-[18px] flex items-center justify-between gap-3">
        <h2 id="recent-activity-heading" className="eyebrow">
          Recent activity
        </h2>
        {isAdmin && (
          <Link
            to="/activity"
            className="font-mono text-[11px] text-accent-ink hover:underline"
          >
            View all
          </Link>
        )}
      </div>

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
            {query.data.map((row) => (
              <li key={row.id} className="relative flex items-start gap-3">
                <ActivityIcon type={row.type} />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] text-foreground">
                    {auditSummary(row)} <TicketRef id={row.ticketId} />
                  </p>
                  <p className="truncate text-[12px] text-ink-3">{row.ticketSubject}</p>
                </div>
                <span className="shrink-0 font-mono tabular text-[10.5px] text-ink-4">
                  {formatRelative(row.createdAt)}
                </span>
              </li>
            ))}
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
