export const Role = {
  admin: "admin",
  agent: "agent",
} as const;
export type Role = (typeof Role)[keyof typeof Role];

export const TicketStatus = {
  open: "open",
  resolved: "resolved",
  closed: "closed",
} as const;
export type TicketStatus = (typeof TicketStatus)[keyof typeof TicketStatus];

export const TicketCategory = {
  general_question: "general_question",
  technical_question: "technical_question",
  refund_request: "refund_request",
} as const;
export type TicketCategory = (typeof TicketCategory)[keyof typeof TicketCategory];
