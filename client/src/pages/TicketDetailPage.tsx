import type { TicketDetail } from "@helpdesk/core";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { useParams } from "react-router";
import ActivityFeed from "@/components/ActivityFeed";
import ReplyThread from "@/components/ReplyThread";
import TicketDetails from "@/components/TicketDetails";
import TicketMeta from "@/components/TicketMeta";
import TicketReplyArea from "@/components/TicketReplyArea";
import BackLink from "@/components/ui/BackLink";
import ErrorAlert from "@/components/ui/ErrorAlert";
import PageContainer from "@/components/ui/PageContainer";
import { Skeleton } from "@/components/ui/skeleton";

async function fetchTicket(id: string, signal?: AbortSignal): Promise<TicketDetail> {
  const { data } = await axios.get<TicketDetail>(`/api/tickets/${id}`, { signal });
  return data;
}

function TicketDetailSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading ticket">
      <Skeleton className="h-3 w-32" />
      <Skeleton className="h-10 w-2/3" />
      <Skeleton className="h-4 w-48" />
      <Skeleton className="h-48 w-full mt-6" />
    </div>
  );
}

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();

  const {
    data: ticket,
    isPending,
    isError,
  } = useQuery({
    queryKey: ["ticket", id],
    queryFn: ({ signal }) => fetchTicket(id!, signal),
    enabled: !!id,
  });

  return (
    <PageContainer width="content">
      <div className="mb-8">
        <BackLink to="/tickets" label="All tickets" />
      </div>

      {isPending && <TicketDetailSkeleton />}

      {isError && <ErrorAlert message="Failed to load ticket" />}

      {ticket && (
        <div>
          <TicketDetails ticket={ticket} />

          <div className="mt-10 grid grid-cols-1 gap-x-9 gap-y-8 lg:grid-cols-[1fr_312px] lg:items-start">
            <div className="min-w-0 space-y-8">
              <ReplyThread ticket={ticket} />
              <TicketReplyArea ticket={ticket} />
            </div>

            <aside className="lg:sticky lg:top-6">
              <TicketMeta ticket={ticket} />
              <ActivityFeed ticketId={id!} />
            </aside>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
