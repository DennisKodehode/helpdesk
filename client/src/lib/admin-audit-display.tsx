import { AdminAuditEventType, type AdminAuditRow } from "@helpdesk/core";
import {
  Ban,
  Mail,
  Pencil,
  ShieldCheck,
  SlidersHorizontal,
  Timer,
  Trash2,
  UserCheck,
  UserPlus,
} from "lucide-react";
import { type AuditTone, TONE_RING } from "@/lib/audit-display";
import { cn } from "@/lib/utils";

// Short, filter-friendly labels per admin event type — used in the admin
// activity-log event-type dropdown.
export const ADMIN_EVENT_TYPE_LABELS: Record<AdminAuditEventType, string> = {
  [AdminAuditEventType.user_invited]: "User invited",
  [AdminAuditEventType.invite_resent]: "Invite resent",
  [AdminAuditEventType.user_role_changed]: "Role changed",
  [AdminAuditEventType.user_deactivated]: "User deactivated",
  [AdminAuditEventType.user_reactivated]: "User reactivated",
  [AdminAuditEventType.user_deleted]: "User removed",
  [AdminAuditEventType.user_edited]: "User edited",
  [AdminAuditEventType.sla_targets_changed]: "SLA targets changed",
  [AdminAuditEventType.workflow_settings_changed]: "Workflow settings changed",
};

// Icon + tone per type. Destructive/attention actions (deactivate, remove) read
// amber ("warn"); everything else stays neutral. (Admin actions never use the
// violet "ai" tone.)
const VISUAL: Record<AdminAuditEventType, { Icon: typeof Mail; tone: AuditTone }> = {
  [AdminAuditEventType.user_invited]: { Icon: UserPlus, tone: "neutral" },
  [AdminAuditEventType.invite_resent]: { Icon: Mail, tone: "neutral" },
  [AdminAuditEventType.user_role_changed]: { Icon: ShieldCheck, tone: "neutral" },
  [AdminAuditEventType.user_deactivated]: { Icon: Ban, tone: "warn" },
  [AdminAuditEventType.user_reactivated]: { Icon: UserCheck, tone: "neutral" },
  [AdminAuditEventType.user_deleted]: { Icon: Trash2, tone: "warn" },
  [AdminAuditEventType.user_edited]: { Icon: Pencil, tone: "neutral" },
  [AdminAuditEventType.sla_targets_changed]: { Icon: Timer, tone: "neutral" },
  [AdminAuditEventType.workflow_settings_changed]: {
    Icon: SlidersHorizontal,
    tone: "neutral",
  },
};

function adminVisual(type: AdminAuditEventType) {
  return VISUAL[type] ?? { Icon: Pencil, tone: "neutral" as AuditTone };
}

// A compact, plain-text action summary for one admin activity row. Actor name is
// always present (denormalized snapshot); target is the affected user or config
// area. Never surfaces secrets — password edits read "(password reset)".
export function adminAuditSummary(row: AdminAuditRow): string {
  const who = row.actorName;
  const target = row.targetName ?? "an account";
  const data = (row.data ?? {}) as Record<string, unknown>;
  switch (row.type) {
    case AdminAuditEventType.user_invited:
      return `${who} invited ${target} as ${String(data.role ?? "agent")}`;
    case AdminAuditEventType.invite_resent:
      return `${who} resent an invite to ${target}`;
    case AdminAuditEventType.user_role_changed:
      return `${who} changed ${target}'s role ${String(data.from)} → ${String(data.to)}`;
    case AdminAuditEventType.user_deactivated:
      return `${who} deactivated ${target}`;
    case AdminAuditEventType.user_reactivated:
      return `${who} reactivated ${target}`;
    case AdminAuditEventType.user_deleted:
      return `${who} removed ${target}`;
    case AdminAuditEventType.user_edited:
      return data.passwordReset
        ? `${who} edited ${target} (password reset)`
        : `${who} edited ${target}`;
    case AdminAuditEventType.sla_targets_changed:
      return `${who} changed ${target} targets`;
    case AdminAuditEventType.workflow_settings_changed:
      return `${who} changed workflow settings`;
    default:
      return `${who} made a change`;
  }
}

// The round, tone-tinted type-icon badge for one admin activity row.
export function AdminActivityIcon({
  type,
  className,
}: {
  type: AdminAuditEventType;
  className?: string;
}) {
  const { Icon, tone } = adminVisual(type);
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
