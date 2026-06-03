import ActivityFeed from "@/components/ActivityFeed";
import ReplyThread from "@/components/ReplyThread";
import TicketDetails from "@/components/TicketDetails";
import TicketMeta from "@/components/TicketMeta";
import TicketReplyArea from "@/components/TicketReplyArea";
import ErrorAlert from "@/components/ui/ErrorAlert";
import { Skeleton } from "@/components/ui/skeleton";
import { useTicket } from "@/lib/tickets";

/**
 * The right pane of the tablet master-detail. Reuses the real detail building
 * blocks (so all data + mutation logic is shared with the desktop page) inside
 * a single scrolling column — the master-detail already provides the "two
 * column" split, so the desktop page's meta sidebar collapses inline here.
 */
export default function TabletTicketDetailPane({ id }: { id: string }) {
  const { data: ticket, isPending, isError } = useTicket(id);

  return (
    <div className="min-w-0 flex-1 overflow-y-auto bg-background">
      <div className="mx-auto max-w-3xl px-7 py-7">
        {isPending && (
          <div className="space-y-6" role="status" aria-label="Loading ticket">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-9 w-2/3" />
            <Skeleton className="h-4 w-48" />
            <Skeleton className="mt-6 h-48 w-full" />
          </div>
        )}

        {isError && <ErrorAlert message="Failed to load ticket" />}

        {ticket && (
          <>
            <TicketDetails ticket={ticket} />
            <div className="mt-8 space-y-8">
              <TicketMeta ticket={ticket} />
              <ReplyThread ticket={ticket} />
              <TicketReplyArea ticket={ticket} />
              <ActivityFeed ticketId={id} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
