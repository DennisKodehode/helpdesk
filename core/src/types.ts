export enum Role {
  admin = "admin",
  agent = "agent",
}

export enum TicketStatus {
  new = "new",
  processing = "processing",
  open = "open",
  resolved = "resolved",
  closed = "closed",
}

export const TRIAGING_STATUSES: TicketStatus[] = [TicketStatus.new, TicketStatus.processing];

export const TRIAGING_FILTER_VALUE = "triaging" as const;
export type TriagingFilterValue = typeof TRIAGING_FILTER_VALUE;

export enum TicketCategory {
  general_question = "general_question",
  technical_question = "technical_question",
  refund_request = "refund_request",
  billing_inquiry = "billing_inquiry",
  feature_request = "feature_request",
}

export enum TicketPriority {
  low = "low",
  normal = "normal",
  high = "high",
  urgent = "urgent",
}

export enum SenderType {
  agent = "agent",
  customer = "customer",
}

export enum NotificationType {
  customer_reply = "customer_reply",
  ticket_assigned = "ticket_assigned",
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
