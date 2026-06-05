export enum Role {
  // The owner/root tier. A true one-off, created programmatically only (seed
  // promotes SEED_ADMIN_EMAIL) and enforced as a DB-level singleton. The only
  // role that may create/invite, deactivate, delete, or change the role of
  // `admin` accounts.
  globalAdmin = "globalAdmin",
  admin = "admin",
  agent = "agent",
}

// Capability gate: does this role have admin-console access? Both `admin` and
// `globalAdmin` do. Use this everywhere a check means "has admin powers" — NOT
// raw `role === Role.admin`, which would lock the global admin out of admin
// surfaces. Reserve explicit `=== Role.admin` for targeting/protection (i.e.
// "this user IS an admin we're acting on").
export const hasAdminAccess = (role?: string | null): boolean =>
  role === Role.admin || role === Role.globalAdmin;

// True only for the global admin — used to gate the privileged admin-management
// branches (create/invite/deactivate/delete/role-change of admins).
export const isGlobalAdmin = (role?: string | null): boolean => role === Role.globalAdmin;

// Workspace-access lifecycle for a human agent/admin. Orthogonal to soft-delete
// (`deletedAt`): a removed user is `deletedAt != null` regardless of status.
//   invited  — created via an invite, no credential yet; cannot sign in.
//   active   — has a credential; can sign in.
//   inactive — deactivated by an admin; credential kept but sign-in is blocked.
export enum UserStatus {
  invited = "invited",
  active = "active",
  inactive = "inactive",
}

export enum TicketStatus {
  new = "new",
  processing = "processing",
  open = "open",
  resolved = "resolved",
  closed = "closed",
}

export const TRIAGING_STATUSES: TicketStatus[] = [
  TicketStatus.new,
  TicketStatus.processing,
];

export const TRIAGING_FILTER_VALUE = "triaging" as const;
export type TriagingFilterValue = typeof TRIAGING_FILTER_VALUE;

export enum TicketCategory {
  general_question = "general_question",
  technical_question = "technical_question",
  refund_request = "refund_request",
  billing_inquiry = "billing_inquiry",
  feature_request = "feature_request",
}

// Sentinel for the tickets-list `category` query param when the caller wants
// rows where `category IS NULL` (AI hasn't classified yet, or classification
// failed). Mirrors the TRIAGING_FILTER_VALUE convention so the server can
// distinguish "no filter" (omitted) from "explicitly want uncategorized".
export const UNCATEGORIZED_FILTER_VALUE = "uncategorized" as const;
export type UncategorizedFilterValue = typeof UNCATEGORIZED_FILTER_VALUE;

export enum TicketPriority {
  low = "low",
  normal = "normal",
  high = "high",
  urgent = "urgent",
}

export enum SenderType {
  agent = "agent",
  customer = "customer",
  internal_note = "internal_note",
}

// Strategy for auto-assigning a ticket to a human agent when it leaves triage
// (workflow setting `autoAssignOn`). round_robin cycles evenly across active
// agents; least_loaded picks whoever currently has the fewest open tickets.
export enum AutoAssignMode {
  round_robin = "round_robin",
  least_loaded = "least_loaded",
}

export enum TicketView {
  unassigned = "unassigned",
  triage = "triage",
  awaiting_customer = "awaiting_customer",
  recently_resolved = "recently_resolved",
}

// Window (in days) for the dashboard "Resolved · 7d" stat and the matching
// `recently_resolved` ticket view. Shared so the card's count and the list it
// links to use the same cutoff and can't drift apart.
export const RECENT_RESOLVED_DAYS = 7;

export enum NotificationType {
  customer_reply = "customer_reply",
  ticket_assigned = "ticket_assigned",
  sla_breach_warning = "sla_breach_warning",
}

export enum SlaMetric {
  first_response = "first_response",
  resolution = "resolution",
}

export enum AuditEventType {
  status_changed = "status_changed",
  assignee_changed = "assignee_changed",
  priority_changed = "priority_changed",
  category_changed = "category_changed",
  reply_added = "reply_added",
  ticket_created = "ticket_created",
  auto_resolved = "auto_resolved",
  ai_escalated = "ai_escalated",
  auto_reopened = "auto_reopened",
  auto_closed = "auto_closed",
}

// Admin-action audit log event types — distinct from AuditEventType (which is
// ticket-scoped). These cover security-sensitive admin/config mutations and are
// only ever surfaced on the admin-only activity view, never the agent dashboard.
export enum AdminAuditEventType {
  user_invited = "user_invited",
  invite_resent = "invite_resent",
  user_role_changed = "user_role_changed",
  user_deactivated = "user_deactivated",
  user_reactivated = "user_reactivated",
  user_deleted = "user_deleted",
  user_edited = "user_edited",
  sla_targets_changed = "sla_targets_changed",
  workflow_settings_changed = "workflow_settings_changed",
  kb_article_created = "kb_article_created",
  kb_article_updated = "kb_article_updated",
  kb_article_deleted = "kb_article_deleted",
  kb_suggestion_approved = "kb_suggestion_approved",
  kb_suggestion_rejected = "kb_suggestion_rejected",
}

// Knowledge-base article lifecycle. Only `published` rows are assembled into
// the AI corpus; `draft` is a work-in-progress (or a not-yet-published AI
// suggestion), `archived` is retired but kept for reference/history.
export enum KbArticleStatus {
  draft = "draft",
  published = "published",
  archived = "archived",
}

// Where an article came from: migrated from the legacy markdown (`seed`),
// authored by an admin (`manual`), or promoted from an approved AI/agent
// suggestion (`ai_suggested`).
export enum KbArticleSource {
  seed = "seed",
  manual = "manual",
  ai_suggested = "ai_suggested",
}

// KB suggestion review lifecycle. `pending` awaits an admin; approving creates
// a KbArticle and sets `approved`; `rejected` keeps the row for the audit trail.
export enum KbSuggestionStatus {
  pending = "pending",
  approved = "approved",
  rejected = "rejected",
}

// What proposed the article: the AI gap-analysis cron or an agent's manual
// "Suggest for KB" on a resolved ticket.
export enum KbSuggestionSource {
  ai_gap_analysis = "ai_gap_analysis",
  agent = "agent",
}

// Sentinels for the activity-log `actorId` query param. Distinguish "no actor
// filter" (omitted) from the two non-human actor classes the UI can't name with
// a user id: `system` → events with `actorId IS NULL` (automated, or a deleted
// agent's events via onDelete: SetNull); `ai` → the server resolves this to the
// AI user's id (`getAiUserId()`), keeping the AI user's id off the client.
export const ACTOR_SYSTEM_FILTER_VALUE = "system" as const;
export type ActorSystemFilterValue = typeof ACTOR_SYSTEM_FILTER_VALUE;

export const ACTOR_AI_FILTER_VALUE = "ai" as const;
export type ActorAiFilterValue = typeof ACTOR_AI_FILTER_VALUE;

export const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024;

export const ATTACHMENT_MIME_ALLOWLIST: readonly string[] = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/zip",
];

// Inbound email attachments use a permissive denylist instead of the strict
// allowlist above — we want to accept whatever a customer's email client
// produces (HEIC iPhone photos, .mov clips, .pages, etc.) so agents see what
// the customer actually sent. Only known-dangerous types are dropped.
export const INBOUND_MIME_DENYLIST: readonly string[] = [
  "image/svg+xml",
  "application/x-msdownload",
  "application/x-msdos-program",
  "application/x-msi",
  "application/x-sh",
  "application/x-javascript",
  "text/javascript",
  "application/javascript",
];

export const INBOUND_EXTENSION_DENYLIST: readonly string[] = [
  "exe",
  "bat",
  "sh",
  "js",
  "msi",
  "cmd",
  "ps1",
];

export function isAttachmentSafe(filename: string, contentType: string): boolean {
  if (INBOUND_MIME_DENYLIST.includes(contentType)) return false;
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (INBOUND_EXTENSION_DENYLIST.includes(ext)) return false;
  return true;
}

export const VALID_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  [TicketStatus.new]: [],
  [TicketStatus.processing]: [],
  [TicketStatus.open]: [TicketStatus.resolved],
  [TicketStatus.resolved]: [],
  [TicketStatus.closed]: [],
};

export const ADMIN_VALID_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  [TicketStatus.new]: [],
  [TicketStatus.processing]: [TicketStatus.open],
  [TicketStatus.open]: [TicketStatus.resolved, TicketStatus.closed],
  [TicketStatus.resolved]: [TicketStatus.open, TicketStatus.closed],
  [TicketStatus.closed]: [TicketStatus.open],
};
