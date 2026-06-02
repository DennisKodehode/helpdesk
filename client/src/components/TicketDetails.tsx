import type { TicketDetail } from "@helpdesk/core";
import { formatCaseId } from "@/lib/ticket-ui";
import SuppressionPill from "./SuppressionPill";

interface Props {
  ticket: TicketDetail;
}

export default function TicketDetails({ ticket }: Props) {
  const showName = ticket.fromName && ticket.fromName !== ticket.fromEmail;
  const caseId = formatCaseId(ticket.id);
  const received = new Date(ticket.createdAt);

  return (
    <header className="hairline-b pb-8">
      {/* Eyebrow rail */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent-ink">
          Case · <span className="tabular text-foreground">#{caseId}</span>
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground tabular">
          Received{" "}
          {received.toLocaleString(undefined, {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </span>
      </div>

      {/* Subject — editorial serif, fixed 40px (prototype) + mobile fallback */}
      <h1 className="display-serif text-[30px] text-foreground md:text-[40px]">
        {ticket.subject}
      </h1>

      {/* Sender strip */}
      <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        {showName && (
          <span className="text-[14px] font-medium text-foreground">
            {ticket.fromName}
          </span>
        )}
        <span className="font-mono text-[12px] text-muted-foreground">
          {ticket.fromEmail}
        </span>
        {ticket.isSuppressed && <SuppressionPill />}
      </div>
    </header>
  );
}
