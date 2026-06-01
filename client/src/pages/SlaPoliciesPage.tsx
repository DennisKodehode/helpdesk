import { type SlaPolicy, TicketPriority } from "@helpdesk/core";
import { useState } from "react";
import SlaPolicyDialog from "@/components/SlaPolicyDialog";
import { Button } from "@/components/ui/button";
import ErrorAlert from "@/components/ui/ErrorAlert";
import PageHeader from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { useSlaPolicies } from "@/lib/sla-policies";
import {
  BADGE_BASE,
  PRIORITY_DOT,
  PRIORITY_LABELS,
  PRIORITY_STYLES,
} from "@/lib/ticket-ui";

// Order matches the urgency we want to highlight, not the enum declaration
// order. Urgent rows surface first so a glance at the page shows the most
// aggressive policy.
const PRIORITY_ORDER: TicketPriority[] = [
  TicketPriority.urgent,
  TicketPriority.high,
  TicketPriority.normal,
  TicketPriority.low,
];

function formatMinutes(minutes: number | null): string {
  if (minutes == null) return "—";
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 60 * 24) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m === 0 ? `${h}h` : `${h}h ${m}m`;
  }
  const d = Math.floor(minutes / (60 * 24));
  const remainder = minutes - d * 60 * 24;
  const h = Math.floor(remainder / 60);
  return h === 0 ? `${d}d` : `${d}d ${h}h`;
}

export default function SlaPoliciesPage() {
  const [editTarget, setEditTarget] = useState<SlaPolicy | null>(null);
  const { data: policies, isPending, isError } = useSlaPolicies();

  return (
    <main className="mx-auto max-w-4xl px-4 pt-11 pb-10 sm:px-6 md:px-8 md:pb-12 lg:px-12 xl:px-14">
      <PageHeader
        eyebrow="Policies"
        title="SLA targets"
        description="First-response and resolution targets per ticket priority. The breach-detection cron checks open tickets against these every 5 minutes."
      />

      {isError && (
        <ErrorAlert message="Failed to load SLA policies. Try refreshing the page." />
      )}

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <table className="w-full text-[13px]">
          <thead className="hairline-b bg-muted/30 text-left">
            <tr>
              <th className="px-5 py-3 eyebrow text-[11px]">Priority</th>
              <th className="px-5 py-3 eyebrow text-[11px]">First response</th>
              <th className="px-5 py-3 eyebrow text-[11px]">Resolution</th>
              <th className="px-5 py-3 eyebrow text-[11px] text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isPending
              ? Array.from({ length: 4 }).map((_, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: skeleton row placeholders, never reordered
                  <tr key={`skeleton-${i}`} className="hairline-b">
                    <td className="px-5 py-4">
                      <Skeleton className="h-5 w-20" />
                    </td>
                    <td className="px-5 py-4">
                      <Skeleton className="h-5 w-16" />
                    </td>
                    <td className="px-5 py-4">
                      <Skeleton className="h-5 w-16" />
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Skeleton className="ml-auto h-8 w-16" />
                    </td>
                  </tr>
                ))
              : PRIORITY_ORDER.map((priority) => {
                  const p = policies?.[priority];
                  if (!p) return null;
                  return (
                    <tr key={priority} className="hairline-b last:border-b-0">
                      <td className="px-5 py-4">
                        <span className={`${BADGE_BASE} ${PRIORITY_STYLES[priority]}`}>
                          <span
                            className={`size-1.5 rounded-full ${PRIORITY_DOT[priority]}`}
                            aria-hidden
                          />
                          {PRIORITY_LABELS[priority]}
                        </span>
                      </td>
                      <td className="px-5 py-4 font-mono tabular text-[12.5px]">
                        {formatMinutes(p.firstResponseMinutes)}
                      </td>
                      <td className="px-5 py-4 font-mono tabular text-[12.5px]">
                        {formatMinutes(p.resolutionMinutes)}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setEditTarget(p)}
                        >
                          Edit
                        </Button>
                      </td>
                    </tr>
                  );
                })}
          </tbody>
        </table>
      </div>

      <SlaPolicyDialog
        key={editTarget?.priority ?? "closed"}
        policy={editTarget}
        open={editTarget !== null}
        onOpenChange={(open) => {
          if (!open) setEditTarget(null);
        }}
      />
    </main>
  );
}
