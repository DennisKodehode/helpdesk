import { useParams } from "react-router";
import { Link } from "@/components/ui/link";
import axios from "axios";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { type TicketDetail, type Agent } from "@helpdesk/core";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft } from "lucide-react";
import { BADGE_BASE, STATUS_STYLES, CATEGORY_LABELS } from "@/lib/ticket-ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";

async function fetchTicket(id: string): Promise<TicketDetail> {
  const { data } = await axios.get<TicketDetail>(`/api/tickets/${id}`);
  return data;
}

async function fetchAgents(): Promise<Agent[]> {
  const { data } = await axios.get<Agent[]>("/api/agents");
  return data;
}

export default function TicketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  const { data: ticket, isPending, isError } = useQuery({
    queryKey: ["ticket", id],
    queryFn: () => fetchTicket(id!),
    enabled: !!id,
  });

  const { data: agents = [] } = useQuery({
    queryKey: ["agents"],
    queryFn: fetchAgents,
  });

  const assignMutation = useMutation({
    mutationFn: (assignedToId: string | null) =>
      axios.patch(`/api/tickets/${id}`, { assignedToId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ticket", id] }),
  });

  // While a mutation is in-flight, show the optimistic value immediately
  const currentAssigneeId = assignMutation.isPending && assignMutation.variables !== undefined
    ? assignMutation.variables
    : ticket?.assignedToId ?? null;

  // Resolve agent name from the agents list; fall back to ticket.assignedTo.name
  // (available from the detail response before the users list loads)
  const displayAgentName = currentAssigneeId
    ? (agents.find(a => a.id === currentAssigneeId)?.name ?? ticket?.assignedTo?.name ?? null)
    : null;

  return (
    <main className="p-8 max-w-3xl mx-auto">
      <Link
        to="/tickets"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-6"
        aria-label="Back to tickets"
      >
        <ArrowLeft className="size-4" />
        Back to tickets
      </Link>

      {isPending && (
        <div className="space-y-4" aria-label="Loading ticket">
          <Skeleton className="h-7 w-2/3" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-40 w-full mt-4" />
        </div>
      )}

      {isError && (
        <p className="text-sm text-red-500">Failed to load ticket</p>
      )}

      {ticket && (
        <div className="space-y-6">
          <h1 className="text-2xl font-semibold text-gray-900">{ticket.subject}</h1>

          <div className="flex flex-wrap gap-2 items-center">
            <span className={`${BADGE_BASE} ${STATUS_STYLES[ticket.status]}`}>
              {ticket.status}
            </span>
            {ticket.category && (
              <span className={`${BADGE_BASE} bg-blue-100 text-blue-700`}>
                {CATEGORY_LABELS[ticket.category]}
              </span>
            )}
          </div>

          <dl className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm border-t border-gray-100 pt-4">
            <div>
              <dt className="text-gray-500 font-medium">From</dt>
              <dd className="text-gray-900">{ticket.fromName}</dd>
              <dd className="text-gray-500">{ticket.fromEmail}</dd>
            </div>
            <div>
              <dt className="text-gray-500 font-medium">Received</dt>
              <dd className="text-gray-900">{new Date(ticket.createdAt).toLocaleString()}</dd>
            </div>
            <div>
              <dt className="text-gray-500 font-medium mb-1">Assigned to</dt>
              <dd>
                <Select
                  value={currentAssigneeId ?? ""}
                  onValueChange={(value) => assignMutation.mutate(value || null)}
                >
                  <SelectTrigger aria-label="Assign ticket">
                    <span data-slot="select-value" className="flex flex-1 text-left">
                      {displayAgentName ?? <span className="text-muted-foreground">Unassigned</span>}
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Unassigned</SelectItem>
                    {agents.map(agent => (
                      <SelectItem key={agent.id} value={agent.id}>{agent.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </dd>
            </div>
          </dl>

          <div className="border-t border-gray-100 pt-4">
            <h2 className="text-sm font-medium text-gray-500 mb-2">Message</h2>
            <div className="bg-white rounded-lg border border-gray-200 p-4 text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
              {ticket.body || <span className="text-gray-400 italic">(no message body)</span>}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
