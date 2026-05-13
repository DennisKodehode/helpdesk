import axios from "axios";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  type TicketDetail,
  type Agent,
  Role,
  TicketStatus,
  TicketCategory,
  VALID_TRANSITIONS,
  ADMIN_VALID_TRANSITIONS,
} from "@helpdesk/core";
import { CATEGORY_LABELS, STATUS_LABELS } from "@/lib/ticket-ui";
import StatusPill from "@/components/StatusPill";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { useSession } from "@/lib/auth-client";

interface Props {
  ticket: TicketDetail;
}

async function fetchAgents(): Promise<Agent[]> {
  const { data } = await axios.get<Agent[]>("/api/agents");
  return data;
}

function MetaField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="hairline-b px-5 py-4 last:border-b-0">
      <p className="label-meta mb-2">{label}</p>
      {children}
    </div>
  );
}

export default function TicketMeta({ ticket }: Props) {
  const ticketId = String(ticket.id);
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const isAdmin =
    (session?.user as Record<string, unknown>)?.role === Role.admin;

  const { data: agents = [] } = useQuery({
    queryKey: ["agents"],
    queryFn: fetchAgents,
  });

  const updateCache = (response: { data: TicketDetail }) =>
    queryClient.setQueryData(["ticket", ticketId], response.data);

  const assignMutation = useMutation({
    mutationFn: (assignedToId: string | null) =>
      axios.patch<TicketDetail>(`/api/tickets/${ticketId}`, { assignedToId }),
    onSuccess: updateCache,
  });

  const statusMutation = useMutation({
    mutationFn: (status: TicketStatus) =>
      axios.patch<TicketDetail>(`/api/tickets/${ticketId}`, { status }),
    onSuccess: updateCache,
  });

  const categoryMutation = useMutation({
    mutationFn: (category: TicketCategory | null) =>
      axios.patch<TicketDetail>(`/api/tickets/${ticketId}`, { category }),
    onSuccess: updateCache,
  });

  const currentAssigneeId =
    assignMutation.isPending && assignMutation.variables !== undefined
      ? assignMutation.variables
      : ticket.assignedToId ?? null;

  const displayAgentName = currentAssigneeId
    ? agents.find((a) => a.id === currentAssigneeId)?.name ??
      ticket.assignedTo?.name ??
      null
    : null;

  const currentStatus = (
    statusMutation.isPending && statusMutation.variables !== undefined
      ? statusMutation.variables
      : ticket.status ?? TicketStatus.open
  ) as TicketStatus;

  const currentCategory = (
    categoryMutation.isPending
      ? categoryMutation.variables ?? null
      : ticket.category ?? null
  ) as TicketCategory | null;

  const validNextStatuses = (
    isAdmin ? ADMIN_VALID_TRANSITIONS : VALID_TRANSITIONS
  )[ticket.status as TicketStatus];

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="hairline-b flex items-center justify-between bg-muted/30 px-5 py-3">
        <h2 className="eyebrow">Properties</h2>
      </div>

      <MetaField label="Status">
        {validNextStatuses.length > 0 ? (
          <Select
            value={currentStatus}
            onValueChange={(value) =>
              statusMutation.mutate(value as TicketStatus)
            }
          >
            <SelectTrigger
              className="h-9 w-full text-[13px]"
              aria-label="Change ticket status"
            >
              <span data-slot="select-value" className="flex flex-1 text-left">
                {STATUS_LABELS[currentStatus]}
              </span>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ticket.status as string}>
                {STATUS_LABELS[ticket.status as TicketStatus]}
              </SelectItem>
              {validNextStatuses.map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <StatusPill status={currentStatus} />
        )}
      </MetaField>

      <MetaField label="Category">
        <Select
          value={currentCategory ?? ""}
          onValueChange={(value) =>
            categoryMutation.mutate((value || null) as TicketCategory | null)
          }
        >
          <SelectTrigger
            className="h-9 w-full text-[13px]"
            aria-label="Change ticket category"
          >
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
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </MetaField>

      <MetaField label="Assigned to">
        <Select
          value={currentAssigneeId ?? ""}
          onValueChange={(value) => assignMutation.mutate(value || null)}
        >
          <SelectTrigger
            className="h-9 w-full text-[13px]"
            aria-label="Assign ticket"
          >
            <span data-slot="select-value" className="flex flex-1 text-left">
              {displayAgentName ?? (
                <span className="text-muted-foreground">Unassigned</span>
              )}
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Unassigned</SelectItem>
            {agents.map((agent) => (
              <SelectItem key={agent.id} value={agent.id}>
                {agent.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </MetaField>

      <MetaField label="Timeline">
        <dl className="space-y-1.5">
          <div className="flex items-center justify-between text-[12px]">
            <dt className="text-muted-foreground">Received</dt>
            <dd className="font-mono tabular text-foreground">
              {new Date(ticket.createdAt).toLocaleDateString(undefined, {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </dd>
          </div>
          <div className="flex items-center justify-between text-[12px]">
            <dt className="text-muted-foreground">Updated</dt>
            <dd className="font-mono tabular text-foreground">
              {new Date(ticket.updatedAt).toLocaleDateString(undefined, {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </dd>
          </div>
        </dl>
      </MetaField>
    </div>
  );
}
