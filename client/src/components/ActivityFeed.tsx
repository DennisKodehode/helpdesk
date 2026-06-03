import {
  type Agent,
  type AuditEvent,
  AuditEventType,
  SenderType,
  type TicketCategory,
  type TicketPriority,
  type TicketStatus,
} from "@helpdesk/core";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import {
  AlertTriangle,
  Archive,
  ArrowRight,
  Flag,
  Lock,
  Mail,
  MessageSquare,
  RotateCcw,
  Sparkles,
  Tag,
  UserCheck,
} from "lucide-react";
import type { ReactNode } from "react";
import { AGENTS_QUERY_KEY } from "@/lib/agents";
import {
  CATEGORY_LABELS,
  formatRelative,
  PRIORITY_LABELS,
  STATUS_LABELS,
} from "@/lib/ticket-ui";

interface Props {
  ticketId: string;
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

async function fetchAgents(signal?: AbortSignal): Promise<Agent[]> {
  const { data } = await axios.get<Agent[]>("/api/agents", { signal });
  return data;
}

type ChangeData<T> = { from: T; to: T };
type AssigneeChangeData = {
  from: string | null;
  to: string | null;
  reopenUnassigned?: boolean;
  reason?: "user_deleted";
};
type ReplyAddedData = { replyId: number; senderType: SenderType };
type TicketCreatedData = { fromEmail: string };
type AutoResolvedData = { replyId: number };
type AiEscalatedData = {
  reason: "ai_chose_escalate" | "ai_call_failed" | "json_parse_failure";
};

function renderEvent(
  event: AuditEvent,
  agentsById: Map<string, string>,
): { icon: ReactNode; content: ReactNode } {
  const actorName = event.actor?.name ?? "Someone";

  if (event.type === AuditEventType.status_changed) {
    const { from, to } = event.data as ChangeData<TicketStatus>;
    return {
      icon: <ArrowRight className="size-3.5 text-muted-foreground" aria-hidden />,
      content: (
        <span>
          <span className="font-medium text-foreground">{actorName}</span>
          {" changed status: "}
          <span className="text-foreground">{STATUS_LABELS[from]}</span>
          {" → "}
          <span className="text-foreground">{STATUS_LABELS[to]}</span>
        </span>
      ),
    };
  }

  if (event.type === AuditEventType.assignee_changed) {
    const data = event.data as AssigneeChangeData;
    if (data.reopenUnassigned) {
      return {
        icon: <UserCheck className="size-3.5 text-muted-foreground" aria-hidden />,
        content: <span>Auto-unassigned on reopen</span>,
      };
    }
    const toName = data.to ? agentsById.get(data.to) : null;
    const suffix = data.reason === "user_deleted" ? " (agent deleted)" : "";
    return {
      icon: <UserCheck className="size-3.5 text-muted-foreground" aria-hidden />,
      content: (
        <span>
          <span className="font-medium text-foreground">{actorName}</span>
          {data.to === null
            ? ` unassigned the ticket${suffix}`
            : toName
              ? ` assigned to ${toName}`
              : " reassigned the ticket"}
        </span>
      ),
    };
  }

  if (event.type === AuditEventType.priority_changed) {
    const { to } = event.data as ChangeData<TicketPriority>;
    return {
      icon: <Flag className="size-3.5 text-muted-foreground" aria-hidden />,
      content: (
        <span>
          <span className="font-medium text-foreground">{actorName}</span>
          {" set priority to "}
          <span className="text-foreground">{PRIORITY_LABELS[to]}</span>
        </span>
      ),
    };
  }

  if (event.type === AuditEventType.category_changed) {
    const { to } = event.data as ChangeData<TicketCategory | null>;
    return {
      icon: <Tag className="size-3.5 text-muted-foreground" aria-hidden />,
      content: (
        <span>
          <span className="font-medium text-foreground">{actorName}</span>
          {to === null
            ? " cleared the category"
            : ` set category to ${CATEGORY_LABELS[to]}`}
        </span>
      ),
    };
  }

  if (event.type === AuditEventType.reply_added) {
    const data = event.data as ReplyAddedData;
    if (data.senderType === SenderType.internal_note) {
      return {
        icon: <Lock className="size-3.5 text-amb-fg" aria-hidden />,
        content: (
          <a
            href={`#reply-${data.replyId}`}
            className="hover:text-foreground hover:underline"
          >
            <span className="font-medium text-foreground">{actorName}</span>
            {" added an internal note"}
          </a>
        ),
      };
    }
    if (data.senderType === SenderType.customer) {
      return {
        icon: <Mail className="size-3.5 text-muted-foreground" aria-hidden />,
        content: (
          <a
            href={`#reply-${data.replyId}`}
            className="hover:text-foreground hover:underline"
          >
            <span className="font-medium text-foreground">Customer</span>
            {" replied"}
          </a>
        ),
      };
    }
    return {
      icon: <MessageSquare className="size-3.5 text-primary" aria-hidden />,
      content: (
        <a
          href={`#reply-${data.replyId}`}
          className="hover:text-foreground hover:underline"
        >
          <span className="font-medium text-foreground">{actorName}</span>
          {" replied"}
        </a>
      ),
    };
  }

  if (event.type === AuditEventType.ticket_created) {
    const data = event.data as TicketCreatedData;
    return {
      icon: <Mail className="size-3.5 text-muted-foreground" aria-hidden />,
      content: (
        <span>
          Ticket created from <span className="text-foreground">{data.fromEmail}</span>
        </span>
      ),
    };
  }

  if (event.type === AuditEventType.auto_resolved) {
    const data = event.data as AutoResolvedData;
    return {
      icon: <Sparkles className="size-3.5 text-primary" aria-hidden />,
      content: (
        <a
          href={`#reply-${data.replyId}`}
          className="hover:text-foreground hover:underline"
        >
          <span className="font-medium text-foreground">AI</span>
          {" auto-resolved the ticket"}
        </a>
      ),
    };
  }

  if (event.type === AuditEventType.ai_escalated) {
    const data = event.data as AiEscalatedData;
    return {
      icon: <AlertTriangle className="size-3.5 text-amb-fg" aria-hidden />,
      content: (
        <span title={data.reason}>
          <span className="font-medium text-foreground">AI</span>
          {" escalated to humans"}
        </span>
      ),
    };
  }

  if (event.type === AuditEventType.auto_reopened) {
    return {
      icon: <RotateCcw className="size-3.5 text-muted-foreground" aria-hidden />,
      content: <span>Auto-reopened on customer reply</span>,
    };
  }

  if (event.type === AuditEventType.auto_closed) {
    return {
      icon: <Archive className="size-3.5 text-muted-foreground" aria-hidden />,
      content: <span>Auto-closed after 96h</span>,
    };
  }

  return { icon: null, content: null };
}

export default function ActivityFeed({ ticketId }: Props) {
  const { data: events = [], isPending } = useQuery({
    queryKey: ["ticket-audit-events", ticketId],
    queryFn: ({ signal }) => fetchAuditEvents(ticketId, signal),
  });
  const { data: agents = [] } = useQuery({
    queryKey: AGENTS_QUERY_KEY,
    queryFn: ({ signal }) => fetchAgents(signal),
  });

  const agentsById = new Map(agents.map((a) => [a.id, a.name]));

  return (
    <section
      aria-label="Activity"
      className="mt-5 overflow-hidden rounded-[var(--r-lg)] border border-border bg-card"
    >
      <div className="hairline-b flex items-center justify-between bg-panel-2 px-5 py-3">
        <h2 className="eyebrow">Activity</h2>
      </div>

      <div className="px-5 py-4 xl:px-6 xl:py-5">
        {isPending ? (
          <p className="text-[12px] text-muted-foreground">Loading…</p>
        ) : events.length === 0 ? (
          <p className="text-[12px] text-muted-foreground">No activity yet</p>
        ) : (
          <ol className="space-y-3">
            {events.map((event) => {
              // A single malformed event (e.g. a missing `data` payload) must
              // not white-screen the whole activity feed via the ErrorBoundary —
              // log it and skip the row instead.
              let icon: ReactNode;
              let content: ReactNode;
              try {
                ({ icon, content } = renderEvent(event, agentsById));
              } catch (err) {
                console.error(
                  `Failed to render audit event ${event.id} (${event.type}):`,
                  err,
                );
                return null;
              }
              if (!content) return null;
              return (
                <li
                  key={event.id}
                  className="flex gap-2.5 text-[12px] text-muted-foreground"
                >
                  <span className="mt-0.5 shrink-0">{icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="leading-snug">{content}</div>
                    <div className="mt-0.5 font-mono tabular text-[10px] text-muted-foreground/70">
                      {formatRelative(event.createdAt)}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </section>
  );
}
