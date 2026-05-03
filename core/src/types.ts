export const Role = {
  admin: "admin",
  agent: "agent",
} as const;
export type Role = (typeof Role)[keyof typeof Role];

export type TicketStatus = "open" | "resolved" | "closed";

export type TicketCategory =
  | "general_question"
  | "technical_question"
  | "refund_request";
