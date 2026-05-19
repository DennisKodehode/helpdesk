import type { Ticket, TicketDetail } from "@helpdesk/core";
import type { ReactNode } from "react";
import { useSlaPolicies } from "@/lib/sla-policies";
import {
  BADGE_BASE,
  computeSlaState,
  formatDurationShort,
  SLA_DOT,
  SLA_LABELS,
  SLA_METRIC_LABELS,
  SLA_STYLES,
} from "@/lib/ticket-ui";
import { cn } from "@/lib/utils";

type SlaBadgeTicket = Pick<
  Ticket | TicketDetail,
  "createdAt" | "firstAgentReplyAt" | "resolvedAt" | "priority" | "status"
>;

interface SlaBadgeProps {
  ticket: SlaBadgeTicket;
  // What to render when the ticket is healthy / resolved. Defaults to nothing
  // — useful for the list view where empty cells stay tidy. The detail-page
  // sidebar passes a muted dash so the row doesn't look broken.
  fallback?: ReactNode;
}

// Pure presentational: looks up the policy for this priority via the cached
// useSlaPolicies hook, computes state, and renders the pill — or nothing if
// the ticket is healthy / resolved / closed. The native `title` attribute
// gives a no-dep accessible tooltip with the metric + time-to/from-due.
export function SlaBadge({ ticket, fallback = null }: SlaBadgeProps) {
  const { data: policies } = useSlaPolicies();
  const computed = computeSlaState(ticket, policies?.[ticket.priority]);
  if (computed.state === "ok") return <>{fallback}</>;

  const now = Date.now();
  const dueAtMs = computed.dueAt.getTime();
  const diffMinutes = Math.round((dueAtMs - now) / 60_000);
  const metricLabel = SLA_METRIC_LABELS[computed.metric];
  const title =
    computed.state === "breached"
      ? `${metricLabel}: ${formatDurationShort(diffMinutes)} overdue`
      : `${metricLabel}: ${formatDurationShort(diffMinutes)} remaining`;

  return (
    <span className={cn(BADGE_BASE, SLA_STYLES[computed.state])} title={title}>
      <span
        aria-hidden
        className={cn("size-1.5 rounded-full", SLA_DOT[computed.state])}
      />
      {SLA_LABELS[computed.state]}
    </span>
  );
}
