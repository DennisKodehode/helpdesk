import { z } from "zod";
import {
  AuditEventType,
  NotificationType,
  SenderType,
  TicketCategory,
  TicketPriority,
  TicketStatus,
  TRIAGING_FILTER_VALUE,
} from "./types";

export const userSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  role: z.string(),
  createdAt: z.string(),
});

export type User = z.infer<typeof userSchema>;

export const agentSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
});

export type Agent = z.infer<typeof agentSchema>;

export const createUserSchema = z.object({
  name: z.string().trim().min(3, "Name must be at least 3 characters"),
  email: z.email("Invalid email address"),
  password: z.string().trim().min(8, "Password must be at least 8 characters"),
});

export type CreateUserData = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
  name: z.string().trim().min(3, "Name must be at least 3 characters"),
  email: z.email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters").or(z.literal("")),
});

export type UpdateUserData = z.infer<typeof updateUserSchema>;

export const inboundEmailSchema = z.object({
  fromName: z.string().trim().min(1).max(255),
  fromEmail: z.email("Invalid email address").max(255),
  subject: z
    .string()
    .trim()
    .max(255)
    .transform(
      (s) =>
        s.replace(/^(\s*(re|fwd?|fw)(\[\d+\])?:\s*)+/gi, "").trim() || "(no subject)",
    )
    .default("(no subject)"),
  body: z.string().max(10_000).optional(),
  bodyHtml: z.string().max(50_000).optional(),
});

export type InboundEmailData = z.infer<typeof inboundEmailSchema>;

export const assigneeTypeSchema = z.enum(["human", "ai", "none"]);
export type AssigneeType = z.infer<typeof assigneeTypeSchema>;

export const ticketSchema = z.object({
  id: z.number(),
  fromName: z.string(),
  fromEmail: z.string(),
  subject: z.string(),
  status: z.enum(TicketStatus),
  category: z.enum(TicketCategory).nullable(),
  priority: z.enum(TicketPriority),
  assignedToId: z.string().nullable(),
  assigneeType: assigneeTypeSchema,
  isSuppressed: z.boolean(),
  createdAt: z.string(),
});

export type Ticket = z.infer<typeof ticketSchema>;

export const ticketDetailSchema = z.object({
  id: z.number(),
  fromName: z.string(),
  fromEmail: z.string(),
  subject: z.string(),
  body: z.string(),
  bodyHtml: z.string().nullable(),
  status: z.enum(TicketStatus),
  category: z.enum(TicketCategory).nullable(),
  priority: z.enum(TicketPriority),
  assignedToId: z.string().nullable(),
  assignedTo: z
    .object({ id: z.string(), name: z.string(), email: z.string() })
    .nullable(),
  assigneeType: assigneeTypeSchema,
  isSuppressed: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type TicketDetail = z.infer<typeof ticketDetailSchema>;

export const TICKET_SORT_FIELDS = [
  "subject",
  "fromName",
  "status",
  "category",
  "priority",
  "createdAt",
] as const;

export type TicketSortField = (typeof TICKET_SORT_FIELDS)[number];

export const ticketSortSchema = z.object({
  sortBy: z.enum(TICKET_SORT_FIELDS).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
  status: z.union([z.enum(TicketStatus), z.literal(TRIAGING_FILTER_VALUE)]).optional(),
  category: z.enum(TicketCategory).optional(),
  priority: z.enum(TicketPriority).optional(),
  assignee: z.enum(["unassigned", "me"]).optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});

export const paginatedTicketsSchema = z.object({
  data: z.array(ticketSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
});

export type PaginatedTickets = z.infer<typeof paginatedTicketsSchema>;

export const updateTicketSchema = z.object({
  assignedToId: z.string().nullable().optional(),
  status: z.enum(TicketStatus).optional(),
  category: z.enum(TicketCategory).nullable().optional(),
  priority: z.enum(TicketPriority).optional(),
});

export type UpdateTicketData = z.infer<typeof updateTicketSchema>;

export const replySchema = z.object({
  id: z.number(),
  ticketId: z.number(),
  senderType: z.enum(SenderType),
  body: z.string(),
  bodyHtml: z.string().nullable(),
  author: z.object({ id: z.string(), name: z.string() }).nullable(),
  createdAt: z.string(),
});

export type Reply = z.infer<typeof replySchema>;

export const createReplySchema = z.object({
  body: z.string().trim().min(1, "Reply cannot be empty").max(10_000),
  isInternal: z.boolean(),
});

export type CreateReplyData = z.infer<typeof createReplySchema>;

export const polishReplySchema = z.object({
  body: z.string().trim().min(1, "Reply cannot be empty").max(10_000),
  refinementNote: z.string().trim().max(500).optional(),
});

export const dailyTicketCountSchema = z.object({
  date: z.string(),
  count: z.number(),
});

export type DailyTicketCount = z.infer<typeof dailyTicketCountSchema>;

export const ticketsPerDayResponseSchema = z.array(dailyTicketCountSchema);

export type TicketsPerDayResponse = z.infer<typeof ticketsPerDayResponseSchema>;

export const notificationSchema = z.object({
  id: z.string(),
  type: z.enum(NotificationType),
  ticketId: z.number(),
  ticketSubject: z.string(),
  actorName: z.string().nullable(),
  readAt: z.string().nullable(),
  createdAt: z.string(),
});

export type Notification = z.infer<typeof notificationSchema>;

export const notificationsResponseSchema = z.object({
  data: z.array(notificationSchema),
  unreadCount: z.number(),
});

export type NotificationsResponse = z.infer<typeof notificationsResponseSchema>;

export const attachmentSchema = z.object({
  id: z.string(),
  filename: z.string(),
  contentType: z.string(),
  size: z.number(),
  createdAt: z.string(),
});

export type Attachment = z.infer<typeof attachmentSchema>;

export const attachmentsResponseSchema = z.array(attachmentSchema);

export const auditEventSchema = z.object({
  id: z.string(),
  type: z.enum(AuditEventType),
  actor: z.object({ id: z.string(), name: z.string() }).nullable(),
  data: z.unknown(),
  createdAt: z.string(),
});

export type AuditEvent = z.infer<typeof auditEventSchema>;

export const auditEventsResponseSchema = z.array(auditEventSchema);

export const myOpenCountSchema = z.object({
  count: z.number(),
});

export type MyOpenCount = z.infer<typeof myOpenCountSchema>;

export const personalStatsResponseSchema = z.object({
  openOnMyPlate: z.number(),
  resolvedLifetime: z.number(),
  resolved30d: z.number(),
  avgResolutionMinutes: z.number().nullable(),
  avgFirstResponseMinutes: z.number().nullable(),
  repliesLifetime: z.number(),
  replies30d: z.number(),
});

export type PersonalStatsResponse = z.infer<typeof personalStatsResponseSchema>;

export const statsResponseSchema = z.object({
  totalTickets: z.number(),
  openTickets: z.number(),
  unassignedTickets: z.number(),
  resolvedTickets: z.number(),
  closedTickets: z.number(),
  resolvedByAI: z.number(),
  percentResolvedByAILast30d: z.number(),
  avgResolutionMinutes: z.number().nullable(),
});

export type StatsResponse = z.infer<typeof statsResponseSchema>;
