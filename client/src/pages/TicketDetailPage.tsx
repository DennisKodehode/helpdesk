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
    <div className="space-y-6" aria-label="Loading ticket">
      <Skeleton className="h-3 w-32" />
      <Skeleton className="h-10 w-2/3" />
      <Skeleton className="h-4 w-48" />
      <Skeleton className="h-48 w-full mt-6" />
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
    <main className="mx-auto max-w-6xl px-4 pt-6 pb-12 sm:px-6 md:px-8 md:pt-10 md:pb-16">
      <div className="mb-8">
        <BackLink to="/tickets" label="All tickets" />
      </div>

      {isPending && <TicketDetailSkeleton />}

      {isError && <ErrorAlert message="Failed to load ticket" />}

      {ticket && (
        <div>
          <TicketDetails ticket={ticket} />

          <div className="mt-10 grid grid-cols-1 gap-x-10 gap-y-8 lg:grid-cols-[1fr_300px] lg:items-start">
            <div className="min-w-0 space-y-8">
              <ReplyThread ticket={ticket} />
              <ReplyForm ticketId={id!} />
            </div>

            <aside className="lg:sticky lg:top-8">
              <TicketMeta ticket={ticket} />
            </aside>
          </div>
        </div>
      )}
    </main>
  );
}
