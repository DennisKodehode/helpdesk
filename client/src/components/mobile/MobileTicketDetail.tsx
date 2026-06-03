import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router";
import ActivityFeed from "@/components/ActivityFeed";
import ReplyThread from "@/components/ReplyThread";
import TicketDetails from "@/components/TicketDetails";
import TicketMeta from "@/components/TicketMeta";
import TicketReplyArea from "@/components/TicketReplyArea";
import ErrorAlert from "@/components/ui/ErrorAlert";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCaseId } from "@/lib/ticket-ui";
import { useTicket } from "@/lib/tickets";

/**
 * Phone ticket detail: a full-screen view with its own back bar (the mobile
 * shell steps aside for detail routes). The conversation + composer + meta reuse
 * the same components as the desktop/tablet detail — replies, AI suggest/polish/
 * send, attachments and sanitization are shared, not reimplemented — laid out in
 * a single mobile column.
 */
export default function MobileTicketDetail({ id }: { id: string }) {
  const navigate = useNavigate();
  const { data: ticket, isPending, isError } = useTicket(id);

  return (
    <div className="flex h-dvh flex-col bg-background">
      <header className="flex-none border-b border-border bg-background/[0.86] pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="flex h-[52px] items-center gap-2 px-2">
          <button
            type="button"
            aria-label="Back"
            onClick={() => navigate(-1)}
            className="grid size-10 place-items-center rounded-md text-ink-2 transition-colors hover:bg-panel-2"
          >
            <ArrowLeft className="size-5" />
          </button>
          <div className="min-w-0 flex-1 text-center">
            <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-ink-3">
              {ticket ? `Case · #${formatCaseId(ticket.id)}` : "Ticket"}
            </div>
            {ticket && (
              <div className="truncate text-[12.5px] text-ink-4">{ticket.fromName}</div>
            )}
          </div>
          {/* Spacer to keep the title centered against the back button. */}
          <span aria-hidden className="size-10" />
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-4">
        {isPending && (
          <div className="space-y-5" role="status" aria-label="Loading ticket">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="mt-4 h-40 w-full" />
          </div>
        )}

        {isError && <ErrorAlert message="Failed to load ticket" />}

        {ticket && (
          <div className="space-y-7">
            <TicketDetails ticket={ticket} />
            <TicketMeta ticket={ticket} />
            <ReplyThread ticket={ticket} />
            <TicketReplyArea ticket={ticket} />
            <ActivityFeed ticketId={id} />
          </div>
        )}
      </div>
    </div>
  );
}
