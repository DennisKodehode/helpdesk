import type { TicketStatus } from "@helpdesk/core";
import {
  BADGE_BASE,
  isTriagingStatus,
  STATUS_DOT,
  STATUS_LABELS,
  STATUS_STYLES,
  TRIAGING_DOT,
  TRIAGING_LABEL,
  TRIAGING_STYLE,
} from "@/lib/ticket-ui";

export default function StatusPill({ status }: { status: TicketStatus }) {
  const triaging = isTriagingStatus(status);
  const style = triaging ? TRIAGING_STYLE : STATUS_STYLES[status];
  const dot = triaging ? TRIAGING_DOT : STATUS_DOT[status];
  const label = triaging ? TRIAGING_LABEL : STATUS_LABELS[status];

  return (
    <span className={`${BADGE_BASE} ${style}`}>
      <span className={`inline-block size-1.5 rounded-full ${dot}`} aria-hidden />
      {label}
    </span>
  );
}
