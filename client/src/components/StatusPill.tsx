import { TicketStatus } from "@helpdesk/core";
import { BADGE_BASE, STATUS_STYLES, STATUS_DOT, STATUS_LABELS } from "@/lib/ticket-ui";

export default function StatusPill({ status }: { status: TicketStatus }) {
  return (
    <span className={`${BADGE_BASE} ${STATUS_STYLES[status]}`}>
      <span className={`inline-block size-1.5 rounded-full ${STATUS_DOT[status]}`} aria-hidden />
      {STATUS_LABELS[status]}
    </span>
  );
}
