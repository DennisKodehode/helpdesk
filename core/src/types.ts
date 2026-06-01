export enum Role {
  admin = "admin",
  agent = "agent",
}

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

export enum TicketView {
  unassigned = "unassigned",
  triage = "triage",
  awaiting_customer = "awaiting_customer",
}

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
