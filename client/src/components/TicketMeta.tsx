import {
  ADMIN_VALID_TRANSITIONS,
  type Agent,
  Role,
  type TicketCategory,
  type TicketDetail,
  TicketPriority,
  TicketStatus,
  VALID_TRANSITIONS,
} from "@helpdesk/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Sparkles } from "lucide-react";
import { SlaBadge } from "@/components/SlaBadge";
import StatusPill from "@/components/StatusPill";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { useSession } from "@/lib/auth-client";
import { MY_OPEN_COUNT_QUERY_KEY } from "@/lib/my-tickets";
import { PERSONAL_STATS_QUERY_KEY } from "@/lib/personal-stats";
import {
  CATEGORY_LABELS,
  isTriagingStatus,
  PRIORITY_LABELS,
  STATUS_LABELS,
} from "@/lib/ticket-ui";

interface Props {
  ticket: TicketDetail;
}

async function fetchAgents(signal?: AbortSignal): Promise<Agent[]> {
  const { data } = await axios.get<Agent[]>("/api/agents", { signal });
  return data;
}

function MetaField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="hairline-b px-5 py-4 last:border-b-0 xl:px-6 xl:py-5">
      <p className="label-meta mb-2">{label}</p>
      {children}
    </div>
  );
}

export default function TicketMeta({ ticket }: Props) {
  const ticketId = String(ticket.id);
  const queryClient = useQueryClient();
  const { data: session } = useSession();
  const isAdmin = (session?.user as Record<string, unknown>)?.role === Role.admin;

  const { data: agents = [] } = useQuery({
    queryKey: ["agents"],
    queryFn: ({ signal }) => fetchAgents(signal),
  });

  const updateCache = (response: { data: TicketDetail }) => {
    queryClient.setQueryData(["ticket", ticketId], response.data);
    queryClient.invalidateQueries({ queryKey: ["ticket-audit-events", ticketId] });
  };

  const updateCacheAndCount = (response: { data: TicketDetail }) => {
    updateCache(response);
    queryClient.invalidateQueries({ queryKey: MY_OPEN_COUNT_QUERY_KEY });
    queryClient.invalidateQueries({ queryKey: PERSONAL_STATS_QUERY_KEY });
  };

  const assignMutation = useMutation({
    mutationFn: (assignedToId: string | null) =>
      axios.patch<TicketDetail>(`/api/tickets/${ticketId}`, { assignedToId }),
    onSuccess: updateCacheAndCount,
  });

  const statusMutation = useMutation({
    mutationFn: (status: TicketStatus) =>
      axios.patch<TicketDetail>(`/api/tickets/${ticketId}`, { status }),
    onSuccess: updateCacheAndCount,
  });

  const categoryMutation = useMutation({
    mutationFn: (category: TicketCategory | null) =>
      axios.patch<TicketDetail>(`/api/tickets/${ticketId}`, { category }),
    onSuccess: updateCache,
  });

  const priorityMutation = useMutation({
    mutationFn: (priority: TicketPriority) =>
      axios.patch<TicketDetail>(`/api/tickets/${ticketId}`, { priority }),
    onSuccess: updateCache,
  });

  const currentAssigneeId =
    assignMutation.isPending && assignMutation.variables !== undefined
      ? assignMutation.variables
      : (ticket.assignedToId ?? null);

  const displayAgentName = currentAssigneeId
    ? (agents.find((a) => a.id === currentAssigneeId)?.name ??
      ticket.assignedTo?.name ??
      null)
    : null;

  const currentStatus = (
    statusMutation.isPending && statusMutation.variables !== undefined
      ? statusMutation.variables
      : (ticket.status ?? TicketStatus.open)
  ) as TicketStatus;

  const currentCategory = (
    categoryMutation.isPending
      ? (categoryMutation.variables ?? null)
      : (ticket.category ?? null)
  ) as TicketCategory | null;

  const currentPriority = (
    priorityMutation.isPending && priorityMutation.variables !== undefined
      ? priorityMutation.variables
      : (ticket.priority ?? TicketPriority.normal)
  ) as TicketPriority;

  const validNextStatuses = (isAdmin ? ADMIN_VALID_TRANSITIONS : VALID_TRANSITIONS)[
    ticket.status as TicketStatus
  ];

  const isTerminal =
    ticket.status === TicketStatus.resolved || ticket.status === TicketStatus.closed;

  const isTriaging = isTriagingStatus(ticket.status as TicketStatus);

  return (
    <div className="overflow-hidden rounded-[var(--r-lg)] border border-border bg-card">
      <div className="hairline-b flex items-center justify-between bg-panel-2 px-5 py-3">
        <h2 className="eyebrow">Properties</h2>
      </div>

      <MetaField label="Status">
        {validNextStatuses.length > 0 && !isTriaging ? (
          <Select
            value={currentStatus}
            onValueChange={(value) => statusMutation.mutate(value as TicketStatus)}
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
            disabled={isTriaging}
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

      <MetaField label="Priority">
        <Select
          value={currentPriority}
          onValueChange={(value) => priorityMutation.mutate(value as TicketPriority)}
        >
          <SelectTrigger
            className="h-9 w-full text-[13px]"
            aria-label="Change ticket priority"
            disabled={isTriaging}
          >
            <span data-slot="select-value" className="flex flex-1 text-left">
              {PRIORITY_LABELS[currentPriority]}
            </span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TicketPriority.urgent}>Urgent</SelectItem>
            <SelectItem value={TicketPriority.high}>High</SelectItem>
            <SelectItem value={TicketPriority.normal}>Normal</SelectItem>
            <SelectItem value={TicketPriority.low}>Low</SelectItem>
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
            disabled={isTerminal || isTriaging}
          >
            <span data-slot="select-value" className="flex flex-1 text-left">
              {ticket.assigneeType === "ai" ? (
                <span className="inline-flex items-center gap-1.5">
                  <Sparkles className="size-3 text-primary" aria-hidden />
                  AI Agent
                </span>
              ) : displayAgentName ? (
                displayAgentName
              ) : (
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
        {isTerminal && (
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            Reopen the ticket to reassign.
          </p>
        )}
      </MetaField>

      <MetaField label="SLA">
        <SlaBadge
          ticket={ticket}
          fallback={<span className="text-sm text-muted-foreground/40">—</span>}
        />
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
