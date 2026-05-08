import { useParams } from "react-router";
import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import { type TicketDetail } from "@helpdesk/core";
import { Skeleton } from "@/components/ui/skeleton";
import ErrorAlert from "@/components/ui/ErrorAlert";
import BackLink from "@/components/ui/BackLink";
import ReplyForm from "@/components/ReplyForm";
import ReplyThread from "@/components/ReplyThread";
import TicketDetails from "@/components/TicketDetails";
import TicketMeta from "@/components/TicketMeta";

async function fetchTicket(id: string): Promise<TicketDetail> {
  const { data } = await axios.get<TicketDetail>(`/api/tickets/${id}`);
  return data;
}

function TicketDetailSkeleton() {
  return (
    <div className="space-y-4" aria-label="Loading ticket">
      <Skeleton className="h-7 w-2/3" />
      <Skeleton className="h-4 w-40" />
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-40 w-full mt-4" />
    </div>
  );
}

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { data: ticket, isPending, isError } = useQuery({
    queryKey: ["ticket", id],
    queryFn: () => fetchTicket(id!),
    enabled: !!id,
  });

  return (
    <main className="p-8 max-w-5xl mx-auto">
      <BackLink to="/tickets" label="Back to tickets" />

      {isPending && <TicketDetailSkeleton />}

      {isError && <ErrorAlert message="Failed to load ticket" />}

      {ticket && (
        <div className="space-y-6">
          <div className="grid grid-cols-[4fr_1fr] gap-8">
            <div className="space-y-6">
              <TicketDetails ticket={ticket} />
              <ReplyThread ticket={ticket} />
              <ReplyForm ticketId={id!} />
            </div>

            <TicketMeta ticket={ticket} />
          </div>
        </div>
      )}
    </main>
  );
}
