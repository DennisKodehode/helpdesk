import { useParams } from "react-router";
import { Link } from "@/components/ui/link";
import axios from "axios";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { type TicketDetail, type Agent, Role, TicketStatus, TicketCategory, VALID_TRANSITIONS, ADMIN_VALID_TRANSITIONS } from "@helpdesk/core";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft } from "lucide-react";
import { BADGE_BASE, STATUS_STYLES, STATUS_LABELS, CATEGORY_LABELS } from "@/lib/ticket-ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { useSession } from "@/lib/auth-client";

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
  const { data: session } = useSession();
  const isAdmin = (session?.user as Record<string, unknown>)?.role === Role.admin;

  const { data: ticket, isPending, isError } = useQuery({
    queryKey: ["ticket", id],
    queryFn: () => fetchTicket(id!),
    enabled: !!id,
  });

  const { data: agents = [] } = useQuery({
    queryKey: ["agents"],
    queryFn: fetchAgents,
  });

  const updateCache = (response: { data: TicketDetail }) =>
    queryClient.setQueryData(["ticket", id], response.data);

  const assignMutation = useMutation({
    mutationFn: (assignedToId: string | null) =>
      axios.patch<TicketDetail>(`/api/tickets/${id}`, { assignedToId }),
    onSuccess: updateCache,
  });

  const statusMutation = useMutation({
    mutationFn: (status: TicketStatus) =>
      axios.patch<TicketDetail>(`/api/tickets/${id}`, { status }),
    onSuccess: updateCache,
  });

  const categoryMutation = useMutation({
    mutationFn: (category: TicketCategory | null) =>
      axios.patch<TicketDetail>(`/api/tickets/${id}`, { category }),
    onSuccess: updateCache,
  });

  const currentAssigneeId =
    assignMutation.isPending && assignMutation.variables !== undefined
      ? assignMutation.variables
      : (ticket?.assignedToId ?? null);

  const displayAgentName = currentAssigneeId
    ? (agents.find(a => a.id === currentAssigneeId)?.name ?? ticket?.assignedTo?.name ?? null)
    : null;

  const currentStatus = (
    statusMutation.isPending && statusMutation.variables !== undefined
      ? statusMutation.variables
      : (ticket?.status ?? TicketStatus.open) as TicketStatus
  );

  const currentCategory = (
    categoryMutation.isPending
      ? (categoryMutation.variables ?? null)
      : (ticket?.category ?? null)
  ) as TicketCategory | null;

  const validNextStatuses = ticket
    ? (isAdmin ? ADMIN_VALID_TRANSITIONS : VALID_TRANSITIONS)[ticket.status as TicketStatus]
    : [];

  return (
    <main className="p-8 max-w-5xl mx-auto">
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

          <div className="grid grid-cols-[4fr_1fr] gap-8">
            {/* Left column — sender info + message body */}
            <div className="space-y-6">
              <dl className="text-sm space-y-3 border-t border-gray-100 pt-4">
                <div>
                  <dt className="text-gray-500 font-medium">From</dt>
                  <dd className="text-gray-900">{ticket.fromName}</dd>
                  <dd className="text-gray-500">{ticket.fromEmail}</dd>
                </div>
                <div>
                  <dt className="text-gray-500 font-medium">Received</dt>
                  <dd className="text-gray-900">{new Date(ticket.createdAt).toLocaleString()}</dd>
                </div>
              </dl>

              <div className="border-t border-gray-100 pt-4">
                <h2 className="text-sm font-medium text-gray-500 mb-2">Message</h2>
                <div className="bg-white rounded-lg border border-gray-200 p-4 text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                  {ticket.body || <span className="text-gray-400 italic">(no message body)</span>}
                </div>
              </div>
            </div>

            {/* Right column — dropdowns */}
            <dl className="text-sm space-y-4 border-t border-gray-100 pt-4">
              <div>
                <dt className="text-gray-500 font-medium mb-1">Status</dt>
                <dd>
                  {validNextStatuses.length > 0 ? (
                    <Select
                      value={currentStatus}
                      onValueChange={(value) => statusMutation.mutate(value as TicketStatus)}
                    >
                      <SelectTrigger className="w-full" aria-label="Change ticket status">
                        <span data-slot="select-value" className="flex flex-1 text-left">
                          {STATUS_LABELS[currentStatus]}
                        </span>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={ticket.status as string}>
                          {STATUS_LABELS[ticket.status as TicketStatus]}
                        </SelectItem>
                        {validNextStatuses.map(s => (
                          <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className={`${BADGE_BASE} ${STATUS_STYLES[currentStatus]}`}>
                      {STATUS_LABELS[currentStatus]}
                    </span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500 font-medium mb-1">Category</dt>
                <dd>
                  <Select
                    value={currentCategory ?? ""}
                    onValueChange={(value) =>
                      categoryMutation.mutate((value || null) as TicketCategory | null)
                    }
                  >
                    <SelectTrigger className="w-full" aria-label="Change ticket category">
                      <span data-slot="select-value" className="flex flex-1 text-left">
                        {currentCategory ? (
                          CATEGORY_LABELS[currentCategory]
                        ) : (
                          <span className="text-muted-foreground">None</span>
                        )}
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">None</SelectItem>
                      {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </dd>
              </div>
              <div>
                <dt className="text-gray-500 font-medium mb-1">Assigned to</dt>
                <dd>
                  <Select
                    value={currentAssigneeId ?? ""}
                    onValueChange={(value) => assignMutation.mutate(value || null)}
                  >
                    <SelectTrigger className="w-full" aria-label="Assign ticket">
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
          </div>
        </div>
      )}
    </main>
  );
}
