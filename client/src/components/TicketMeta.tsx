import {
  ADMIN_VALID_TRANSITIONS,
  type Agent,
  type AuditEvent,
  AuditEventType,
  Role,
  type TicketCategory,
  type TicketDetail,
  TicketPriority,
  TicketStatus,
  VALID_TRANSITIONS,
} from "@helpdesk/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Check, type LucideIcon, RotateCcw, Sparkles } from "lucide-react";
import { SlaBadge } from "@/components/SlaBadge";
import StatusPill from "@/components/StatusPill";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { AGENTS_QUERY_KEY } from "@/lib/agents";
import { useSession } from "@/lib/auth-client";
import { MY_OPEN_COUNT_QUERY_KEY } from "@/lib/my-tickets";
import { PERSONAL_STATS_QUERY_KEY } from "@/lib/personal-stats";
import { CATEGORY_LABELS, isTriagingStatus, PRIORITY_LABELS } from "@/lib/ticket-ui";
import { useWorkflowSettings } from "@/lib/workflow-settings";

interface Props {
  ticket: TicketDetail;
}

// Status is shown as a pill + a contextual action button (matching the
// prototype): the primary forward transition for the current status, with any
// remaining valid transitions (e.g. an admin force-close) as quiet overflow
// buttons so nothing the transition matrix allows is lost. Keyed by the TARGET
// status the action moves the ticket to.
const STATUS_ACTION: Record<TicketStatus, { label: string; Icon?: LucideIcon }> = {
  [TicketStatus.resolved]: { label: "Resolve", Icon: Check },
  [TicketStatus.open]: { label: "Reopen", Icon: RotateCcw },
  [TicketStatus.closed]: { label: "Close" },
  [TicketStatus.new]: { label: "New" },
  [TicketStatus.processing]: { label: "Processing" },
};

// The single most common forward transition per status — rendered as the
// prominent action; everything else falls to overflow.
const PRIMARY_NEXT: Partial<Record<TicketStatus, TicketStatus>> = {
  [TicketStatus.open]: TicketStatus.resolved,
  [TicketStatus.resolved]: TicketStatus.open,
  [TicketStatus.closed]: TicketStatus.open,
  [TicketStatus.processing]: TicketStatus.open,
};

async function fetchAgents(signal?: AbortSignal): Promise<Agent[]> {
  const { data } = await axios.get<Agent[]>("/api/agents", { signal });
  return data;
}

async function fetchAuditEvents(
  ticketId: string,
  signal?: AbortSignal,
): Promise<AuditEvent[]> {
  const { data } = await axios.get<AuditEvent[]>(
    `/api/tickets/${ticketId}/audit-events`,
    { signal },
  );
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
    queryKey: AGENTS_QUERY_KEY,
    queryFn: ({ signal }) => fetchAgents(signal),
  });

  // Drives the resolve-gate reflection (the server enforces the same rules).
  const { data: workflowSettings } = useWorkflowSettings();

  // Deduped with ActivityFeed's identical query — no extra request. Used only
  // to tell whether an agent has overridden the AI's on-arrival classification.
  const { data: auditEvents = [] } = useQuery({
    queryKey: ["ticket-audit-events", ticketId],
    queryFn: ({ signal }) => fetchAuditEvents(ticketId, signal),
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

  const primaryNext = PRIMARY_NEXT[currentStatus];
  const primaryAction =
    primaryNext && validNextStatuses.includes(primaryNext) ? primaryNext : undefined;
  const overflowActions = validNextStatuses.filter((s) => s !== primaryAction);
  const PrimaryIcon = primaryAction ? STATUS_ACTION[primaryAction].Icon : undefined;

  // Resolution gates (workflow rules): block resolving until the required fields
  // are set, matching the server-side 422. Evaluated against the current
  // (optimistic) category/assignee so the button re-enables as the agent fills
  // them in.
  const resolveBlockedReason =
    workflowSettings?.requireCategory && !currentCategory
      ? "Set a category before resolving."
      : workflowSettings?.requireAssignee && !currentAssigneeId
        ? "Assign this ticket before resolving."
        : null;
  const resolveBlocked = resolveBlockedReason !== null;
  const canResolve = validNextStatuses.includes(TicketStatus.resolved);

  // Every inbound ticket is auto-categorised by Gemini on arrival; a human
  // override is recorded as a `category_changed` audit event. So a category
  // with no such event still reflects the AI's classification.
  const aiClassified =
    currentCategory !== null &&
    !auditEvents.some((e) => e.type === AuditEventType.category_changed);

  return (
    <div className="overflow-hidden rounded-[var(--r-lg)] border border-border bg-card">
      <div className="hairline-b flex items-center justify-between bg-panel-2 px-5 py-3">
        <h2 className="eyebrow">Properties</h2>
      </div>

      <MetaField label="Status">
        {isTriaging ? (
          <div className="flex flex-wrap items-center gap-2.5">
            <StatusPill status={currentStatus} />
            <span className="ai-chip">
              <Sparkles className="size-2.5" aria-hidden /> AI classifying
            </span>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill status={currentStatus} />
            {primaryAction && (
              <Button
                size="xs"
                variant={primaryAction === TicketStatus.resolved ? "outline" : "ghost"}
                onClick={() => statusMutation.mutate(primaryAction)}
                disabled={
                  statusMutation.isPending ||
                  (primaryAction === TicketStatus.resolved && resolveBlocked)
                }
              >
                {PrimaryIcon && <PrimaryIcon aria-hidden />}
                {STATUS_ACTION[primaryAction].label}
              </Button>
            )}
            {overflowActions.map((s) => (
              <Button
                key={s}
                size="xs"
                variant="ghost"
                className="text-muted-foreground"
                onClick={() => statusMutation.mutate(s)}
                disabled={
                  statusMutation.isPending ||
                  (s === TicketStatus.resolved && resolveBlocked)
                }
              >
                {STATUS_ACTION[s].label}
              </Button>
            ))}
          </div>
        )}
        {!isTriaging && canResolve && resolveBlockedReason && (
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            {resolveBlockedReason}
          </p>
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
        {aiClassified && (
          <p className="ai-chip mt-1.5">
            <Sparkles className="size-2.5" aria-hidden /> Auto-classified by AI
          </p>
        )}
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
        {ticket.assigneeType === "ai" && (
          <p className="ai-chip mt-1.5">
            <Sparkles className="size-2.5" aria-hidden /> Handled by automation
          </p>
        )}
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
