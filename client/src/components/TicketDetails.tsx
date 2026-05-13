import { type TicketDetail } from "@helpdesk/core";

interface Props {
  ticket: TicketDetail;
}

export default function TicketDetails({ ticket }: Props) {
  const showName = ticket.fromName && ticket.fromName !== ticket.fromEmail;
  const caseId = String(ticket.id).padStart(4, "0");
  const received = new Date(ticket.createdAt);

  return (
    <header className="hairline-b pb-8">
      {/* Eyebrow rail */}
      <div className="mb-5 flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-primary">
          Case · <span className="tabular text-foreground">#{caseId}</span>
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground tabular">
          Received {received.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
        </span>
      </div>

      {/* Subject — editorial serif */}
      <h1 className="display-serif text-[44px] leading-[1.06] tracking-[-0.015em] text-foreground">
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
      </div>
    </header>
  );
}
