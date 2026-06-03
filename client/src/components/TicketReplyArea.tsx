import { type TicketDetail, TicketStatus } from "@helpdesk/core";
import ReplyForm from "@/components/ReplyForm";
import { isTriagingStatus } from "@/lib/ticket-ui";
import { useWorkflowSettings } from "@/lib/workflow-settings";

// Chooses what sits below the reply thread: a read-only notice while the AI is
// triaging, a locked notice when the ticket is closed and the "Lock closed
// tickets" workflow rule is on, or the reply composer otherwise. Mirrors the
// server-side guard in POST /api/tickets/:id/replies.
export default function TicketReplyArea({ ticket }: { ticket: TicketDetail }) {
  const { data: settings } = useWorkflowSettings();

  if (isTriagingStatus(ticket.status)) {
    return (
      <div
        role="status"
        className="rounded-[var(--r-md)] border border-dashed border-border bg-card px-5 py-6 text-center text-[13px] text-muted-foreground"
      >
        AI is triaging this ticket — actions unlock once it has been opened or
        auto-resolved.
      </div>
    );
  }

  if (ticket.status === TicketStatus.closed && settings?.lockClosed) {
    return (
      <div
        role="status"
        className="rounded-[var(--r-md)] border border-dashed border-border bg-card px-5 py-6 text-center text-[13px] text-muted-foreground"
      >
        This ticket is closed and locked. Reopen it to reply.
      </div>
    );
  }

  return <ReplyForm ticketId={String(ticket.id)} />;
}
