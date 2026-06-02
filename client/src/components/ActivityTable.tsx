import type { AuditEventRow } from "@helpdesk/core";
import { TicketRef } from "@/components/TicketRef";
import ErrorAlert from "@/components/ui/ErrorAlert";
import { Skeleton } from "@/components/ui/skeleton";
import { ActivityIcon, auditSummary } from "@/lib/audit-display";
import { formatRelative } from "@/lib/ticket-ui";

interface Props {
  events: AuditEventRow[];
  isPending: boolean;
  isError: boolean;
}

const COL_COUNT = 4;
const TH_CLASS =
  "px-4 py-3 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground";

export default function ActivityTable({ events, isPending, isError }: Props) {
  if (isError) return <ErrorAlert message="Failed to load activity." />;

  return (
    <div className="overflow-x-auto rounded-[var(--r-lg)] border border-border bg-card">
      <table className="w-full border-collapse text-left text-[13px]">
        <thead>
          <tr className="border-b border-border">
            <th scope="col" className={TH_CLASS}>
              Actor
            </th>
            <th scope="col" className={TH_CLASS}>
              Action
            </th>
            <th scope="col" className={TH_CLASS}>
              Ticket
            </th>
            <th scope="col" className={TH_CLASS}>
              When
            </th>
          </tr>
        </thead>
        <tbody>
          {isPending ? (
            Array.from({ length: 8 }).map((_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length skeleton
              <tr key={i} className="border-b border-border last:border-0">
                <td className="px-4 py-3">
                  <Skeleton className="h-3 w-24" />
                </td>
                <td className="px-4 py-3">
                  <Skeleton className="h-3 w-40" />
                </td>
                <td className="px-4 py-3">
                  <Skeleton className="h-3 w-16" />
                </td>
                <td className="px-4 py-3">
                  <Skeleton className="h-3 w-12" />
                </td>
              </tr>
            ))
          ) : events.length === 0 ? (
            <tr>
              <td
                colSpan={COL_COUNT}
                className="px-4 py-12 text-center font-mono text-[12px] text-ink-3"
              >
                No activity matches these filters.
              </td>
            </tr>
          ) : (
            events.map((row) => (
              <tr key={row.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 text-foreground">{row.actorName ?? "System"}</td>
                <td className="px-4 py-3">
                  <span className="flex items-center gap-2">
                    <ActivityIcon type={row.type} />
                    <span className="text-foreground">{auditSummary(row)}</span>
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="min-w-0">
                    <TicketRef id={row.ticketId} />
                    <span className="block max-w-[18rem] truncate text-[12px] text-ink-3">
                      {row.ticketSubject}
                    </span>
                  </div>
                </td>
                <td
                  className="whitespace-nowrap px-4 py-3 font-mono tabular text-[11px] text-ink-4"
                  title={new Date(row.createdAt).toLocaleString()}
                >
                  {formatRelative(row.createdAt)}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
