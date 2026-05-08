export enum Role {
  admin = "admin",
  agent = "agent",
}

export enum TicketStatus {
  open = "open",
  resolved = "resolved",
  closed = "closed",
}

export enum TicketCategory {
  general_question = "general_question",
  technical_question = "technical_question",
  refund_request = "refund_request",
  billing_inquiry = "billing_inquiry",
  feature_request = "feature_request",
}

export enum SenderType {
  agent = "agent",
  customer = "customer",
}

export const VALID_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  [TicketStatus.open]: [TicketStatus.resolved],
  [TicketStatus.resolved]: [],
  [TicketStatus.closed]: [],
};

export const ADMIN_VALID_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  [TicketStatus.open]: [TicketStatus.resolved, TicketStatus.closed],
  [TicketStatus.resolved]: [TicketStatus.open, TicketStatus.closed],
  [TicketStatus.closed]: [TicketStatus.open],
};
