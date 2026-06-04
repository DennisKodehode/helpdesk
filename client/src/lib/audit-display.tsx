import { AuditEventType, type RecentActivityRow, SenderType } from "@helpdesk/core";
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
import { cn } from "@/lib/utils";

export type AuditTone = "ai" | "warn" | "neutral";

// Tailwind classes for the round type-icon badge, keyed by tone. Shared by the
// dashboard's recent-activity feed and the admin activity table via <ActivityIcon>.
export const TONE_RING: Record<AuditTone, string> = {
  ai: "bg-accent-tint-2 text-accent-ink",
  warn: "bg-amb-bg text-amb-fg",
  neutral: "bg-panel-2 text-ink-3",
};

// Short, filter-friendly labels per event type — used in the activity-log
// event-type dropdown. (The richer per-row phrasing lives in `auditSummary`.)
export const EVENT_TYPE_LABELS: Record<AuditEventType, string> = {
  [AuditEventType.status_changed]: "Status changed",
  [AuditEventType.assignee_changed]: "Reassigned",
  [AuditEventType.priority_changed]: "Priority changed",
  [AuditEventType.category_changed]: "Category changed",
  [AuditEventType.reply_added]: "Reply added",
  [AuditEventType.ticket_created]: "Ticket created",
  [AuditEventType.auto_resolved]: "AI auto-resolved",
  [AuditEventType.ai_escalated]: "AI escalated",
  [AuditEventType.auto_reopened]: "Auto-reopened",
  [AuditEventType.auto_closed]: "Auto-closed",
};

// Icon + tone per audit event type. AI/machine moments are violet ("ai"),
// escalations/notes are amber ("warn"), everything else neutral. Shared by the
// dashboard's global recent-activity feed; the per-ticket ActivityFeed keeps
// its own richer, link-bearing rendering.
const VISUAL: Record<AuditEventType, { Icon: typeof Mail; tone: AuditTone }> = {
  [AuditEventType.status_changed]: { Icon: ArrowRight, tone: "neutral" },
  [AuditEventType.assignee_changed]: { Icon: UserCheck, tone: "neutral" },
  [AuditEventType.priority_changed]: { Icon: Flag, tone: "neutral" },
  [AuditEventType.category_changed]: { Icon: Tag, tone: "neutral" },
  [AuditEventType.reply_added]: { Icon: MessageSquare, tone: "neutral" },
  [AuditEventType.ticket_created]: { Icon: Mail, tone: "neutral" },
  [AuditEventType.auto_resolved]: { Icon: Sparkles, tone: "ai" },
  [AuditEventType.ai_escalated]: { Icon: AlertTriangle, tone: "warn" },
  [AuditEventType.auto_reopened]: { Icon: RotateCcw, tone: "neutral" },
  [AuditEventType.auto_closed]: { Icon: Archive, tone: "neutral" },
};

export function auditVisual(type: AuditEventType): {
  Icon: typeof Mail;
  tone: AuditTone;
} {
  return VISUAL[type] ?? { Icon: MessageSquare, tone: "neutral" };
}

// A compact, plain-text action summary for one global activity row. Keeps the
// actor's name out front when we have it; otherwise leans on the verb.
export function auditSummary(row: RecentActivityRow): string {
  const who = row.actorName ?? "System";
  const data = (row.data ?? {}) as Record<string, unknown>;
  switch (row.type) {
    case AuditEventType.status_changed:
      return `${who} changed status`;
    case AuditEventType.assignee_changed:
      return `${who} reassigned the ticket`;
    case AuditEventType.priority_changed:
      return `${who} set priority`;
    case AuditEventType.category_changed:
      return `${who} set category`;
    case AuditEventType.reply_added:
      if (data.senderType === SenderType.internal_note) return `${who} added a note`;
      if (data.senderType === SenderType.customer) return "Customer replied";
      return `${who} replied`;
    case AuditEventType.ticket_created:
      return "Ticket created";
    case AuditEventType.auto_resolved:
      return "AI auto-resolved";
    case AuditEventType.ai_escalated:
      return "AI escalated to a human";
    case AuditEventType.auto_reopened:
      return "Reopened on customer reply";
    case AuditEventType.auto_closed:
      return "Auto-closed after 96h";
    default:
      return "Updated";
  }
}

// The round, tone-tinted type-icon badge for one activity row. Default size
// matches the dashboard feed (size-7); pass `className` to override.
export function ActivityIcon({
  type,
  className,
}: {
  type: AuditEventType;
  className?: string;
}) {
  const { Icon, tone } = auditVisual(type);
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-7 shrink-0 place-items-center rounded-full",
        TONE_RING[tone],
        className,
      )}
    >
      <Icon className="size-3.5" />
    </span>
  );
}

// Re-exported so the internal-note path can render a lock affordance if needed.
export { Lock };
