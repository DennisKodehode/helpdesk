import type { AdminAuditRow } from "@helpdesk/core";
import ErrorAlert from "@/components/ui/ErrorAlert";
import { Skeleton } from "@/components/ui/skeleton";
import { AdminActivityIcon, adminAuditSummary } from "@/lib/admin-audit-display";
import { formatRelative } from "@/lib/ticket-ui";

interface Props {
  events: AdminAuditRow[];
  isPending: boolean;
  isError: boolean;
}

const COL_COUNT = 4;
const TH_CLASS =
  "px-4 py-3 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground";

export default function AdminActivityTable({ events, isPending, isError }: Props) {
  if (isError) return <ErrorAlert message="Failed to load admin activity." />;

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
              Target
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
                  <Skeleton className="h-3 w-48" />
                </td>
                <td className="px-4 py-3">
                  <Skeleton className="h-3 w-20" />
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
                No admin activity matches these filters.
              </td>
            </tr>
          ) : (
            events.map((row) => (
              <tr key={row.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 text-foreground">{row.actorName}</td>
                <td className="px-4 py-3">
                  <span className="flex items-center gap-2">
                    <AdminActivityIcon type={row.type} />
                    <span className="text-foreground">{adminAuditSummary(row)}</span>
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="block max-w-[18rem] truncate text-ink-2">
                    {row.targetName ?? "—"}
                  </span>
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
