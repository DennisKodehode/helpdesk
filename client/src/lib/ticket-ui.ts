import { TicketStatus, TicketCategory } from "@helpdesk/core";

export const BADGE_BASE = "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium";

export const STATUS_STYLES: Record<TicketStatus, string> = {
  [TicketStatus.open]: "bg-amber-100 text-amber-700",
  [TicketStatus.resolved]: "bg-green-100 text-green-700",
  [TicketStatus.closed]: "bg-gray-100 text-gray-500",
};

export const CATEGORY_LABELS: Record<TicketCategory, string> = {
  [TicketCategory.general_question]: "General",
  [TicketCategory.technical_question]: "Technical",
  [TicketCategory.refund_request]: "Refund",
  [TicketCategory.billing_inquiry]: "Billing",
  [TicketCategory.feature_request]: "Feature",
};
