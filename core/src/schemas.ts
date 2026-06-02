import { z } from "zod";
import {
  AuditEventType,
  NotificationType,
  Role,
  SenderType,
  SlaMetric,
  TicketCategory,
  TicketPriority,
  TicketStatus,
  TicketView,
  TRIAGING_FILTER_VALUE,
  UNCATEGORIZED_FILTER_VALUE,
  UserStatus,
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

// --- Admin · Agents roster -------------------------------------------------
// Parallel to userSchema (kept narrow for /api/users) — the roster carries the
// status + per-agent throughput the Agents screen renders. Don't widen
// userSchema/updateUserSchema for these; the create/edit dialog binds to those.

export const rosterAgentSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  role: z.enum(Role),
  status: z.enum(UserStatus),
  openAssigned: z.number().int(),
  resolved30d: z.number().int(),
  avgResolutionMinutes: z.number().nullable(),
  lastActiveAt: z.string().nullable(),
});

export type RosterAgent = z.infer<typeof rosterAgentSchema>;

export const rosterResponseSchema = z.array(rosterAgentSchema);

// Invite (no password — the invitee sets it on the accept page).
export const inviteAgentSchema = z.object({
  name: z.string().trim().min(3, "Name must be at least 3 characters"),
  email: z.email("Invalid email address"),
  role: z.enum(Role),
});

export type InviteAgentData = z.infer<typeof inviteAgentSchema>;

// Public accept-invite payload (token from the email link + chosen password).
export const acceptInviteSchema = z.object({
  token: z.string().min(1),
  password: z.string().trim().min(8, "Password must be at least 8 characters"),
});

export type AcceptInviteData = z.infer<typeof acceptInviteSchema>;

export const updateUserRoleSchema = z.object({
  role: z.enum(Role),
});

export type UpdateUserRoleData = z.infer<typeof updateUserRoleSchema>;

// Only active⇄inactive is an admin transition; `invited` resolves via accept.
export const updateUserStatusSchema = z.object({
  status: z.enum([UserStatus.active, UserStatus.inactive]),
});

export type UpdateUserStatusData = z.infer<typeof updateUserStatusSchema>;

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

// Attachment schema must come BEFORE ticketDetailSchema + replySchema since
// both reference it (TDZ ReferenceError otherwise — caught at module load).
export const attachmentSchema = z.object({
  id: z.string(),
  filename: z.string(),
  contentType: z.string(),
  size: z.number(),
  createdAt: z.string(),
});

export type Attachment = z.infer<typeof attachmentSchema>;

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
  firstAgentReplyAt: z.string().nullable(),
  resolvedAt: z.string().nullable(),
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
  attachments: z.array(attachmentSchema).default([]),
  createdAt: z.string(),
  updatedAt: z.string(),
  firstAgentReplyAt: z.string().nullable(),
  resolvedAt: z.string().nullable(),
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
  category: z
    .union([z.enum(TicketCategory), z.literal(UNCATEGORIZED_FILTER_VALUE)])
    .optional(),
  priority: z.enum(TicketPriority).optional(),
  assignee: z.enum(["unassigned", "me"]).optional(),
  search: z.string().optional(),
  breachedOnly: z.coerce.boolean().optional(),
  // Filter by current SLA state. Only the real-time-computed states are
  // exposed here — breached has its own `breachedOnly` filter that goes
  // through the notification relation (5-min cron-driven). The server
  // evaluates these via the same `computeSlaState` the dashboard widget
  // uses, against the active-ticket set.
  slaState: z.enum(["at_risk", "ok"]).optional(),
  view: z.enum(TicketView).optional(),
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

export const attachmentsResponseSchema = z.array(attachmentSchema);

export const replySchema = z.object({
  id: z.number(),
  ticketId: z.number(),
  senderType: z.enum(SenderType),
  body: z.string(),
  bodyHtml: z.string().nullable(),
  author: z.object({ id: z.string(), name: z.string() }).nullable(),
  // True when the reply was authored by the AI agent user. Derived server-side
  // (author id === AI user id) — never trust a null author to mean "AI".
  isAi: z.boolean(),
  attachments: z.array(attachmentSchema).default([]),
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

// AI "Suggest reply" — the knowledge-base draft + resolve/escalate decision
// the auto-responder would have made, surfaced to the agent for review.
export const suggestReplyResponseSchema = z.object({
  action: z.enum(["resolve", "escalate"]),
  reply: z.string().nullable(),
  confidence: z.number().min(0).max(100),
  escalate: z.boolean(),
  rationale: z.string().nullable(),
});

export type SuggestReplyResponse = z.infer<typeof suggestReplyResponseSchema>;

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
  data: z.unknown().nullish(),
  readAt: z.string().nullable(),
  createdAt: z.string(),
});

export type Notification = z.infer<typeof notificationSchema>;

export const notificationsResponseSchema = z.object({
  data: z.array(notificationSchema),
  unreadCount: z.number(),
});

export type NotificationsResponse = z.infer<typeof notificationsResponseSchema>;

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
  // Dashboard stat cards: tickets still being triaged (new + processing) and
  // tickets resolved in the trailing 7 days.
  triagingTickets: z.number(),
  resolvedLast7d: z.number(),
});

export type StatsResponse = z.infer<typeof statsResponseSchema>;

export const slaPolicySchema = z.object({
  priority: z.enum(TicketPriority),
  firstResponseMinutes: z.number().int().nullable(),
  resolutionMinutes: z.number().int().nullable(),
  updatedAt: z.string(),
});

export type SlaPolicy = z.infer<typeof slaPolicySchema>;

export const slaPoliciesResponseSchema = z.array(slaPolicySchema);

// Either field may be omitted to leave it unchanged, or set to null to drop
// the target for that metric. Negative or non-integer minutes are rejected
// at the route boundary via firstIssue.
export const updateSlaPolicySchema = z
  .object({
    firstResponseMinutes: z.number().int().min(1).nullable().optional(),
    resolutionMinutes: z.number().int().min(1).nullable().optional(),
  })
  .refine(
    (v) => v.firstResponseMinutes !== undefined || v.resolutionMinutes !== undefined,
    { message: "At least one of firstResponseMinutes or resolutionMinutes is required" },
  );

export type UpdateSlaPolicyData = z.infer<typeof updateSlaPolicySchema>;

const slaMetricCountSchema = z.object({
  breached: z.number().int().nonnegative(),
  atRisk: z.number().int().nonnegative(),
});

export const slaHealthResponseSchema = z.object({
  total: z.number().int().nonnegative(),
  breached: z.number().int().nonnegative(),
  atRisk: z.number().int().nonnegative(),
  ok: z.number().int().nonnegative(),
  byMetric: z.object({
    firstResponse: slaMetricCountSchema,
    resolution: slaMetricCountSchema,
  }),
});

export type SlaHealthResponse = z.infer<typeof slaHealthResponseSchema>;

export const categoryBreakdownRowSchema = z.object({
  category: z.enum(TicketCategory).nullable(),
  count: z.number().int().nonnegative(),
});

export const categoryBreakdownResponseSchema = z.array(categoryBreakdownRowSchema);

export type CategoryBreakdownRow = z.infer<typeof categoryBreakdownRowSchema>;
export type CategoryBreakdownResponse = z.infer<typeof categoryBreakdownResponseSchema>;

// Dashboard "AI this week" — machine-driven activity over a trailing window.
export const aiActivityResponseSchema = z.object({
  autoResolved: z.number().int().nonnegative(),
  autoClassified: z.number().int().nonnegative(),
  escalated: z.number().int().nonnegative(),
  repliesSent: z.number().int().nonnegative(),
});

export type AiActivityResponse = z.infer<typeof aiActivityResponseSchema>;

// Dashboard SLA compliance rings — percent of in-window tickets that met each
// target. Null when there were no tickets to measure for that metric.
export const slaComplianceResponseSchema = z.object({
  firstResponse: z.number().min(0).max(100).nullable(),
  resolution: z.number().min(0).max(100).nullable(),
});

export type SlaComplianceResponse = z.infer<typeof slaComplianceResponseSchema>;

// Dashboard recent-activity timeline — global audit events across all tickets.
export const recentActivityRowSchema = z.object({
  id: z.string(),
  type: z.enum(AuditEventType),
  ticketId: z.number().int(),
  ticketSubject: z.string(),
  actorName: z.string().nullable(),
  data: z.unknown(),
  createdAt: z.string(),
});

export const recentActivityResponseSchema = z.array(recentActivityRowSchema);

export type RecentActivityRow = z.infer<typeof recentActivityRowSchema>;
export type RecentActivityResponse = z.infer<typeof recentActivityResponseSchema>;

// Dashboard needs-attention — active tickets at risk of or past an SLA target.
export const needsAttentionRowSchema = z.object({
  id: z.number().int(),
  subject: z.string(),
  priority: z.enum(TicketPriority),
  slaState: z.enum(["at_risk", "breached"]),
  slaMetric: z.enum(SlaMetric),
});

export const needsAttentionResponseSchema = z.array(needsAttentionRowSchema);

export type NeedsAttentionRow = z.infer<typeof needsAttentionRowSchema>;
export type NeedsAttentionResponse = z.infer<typeof needsAttentionResponseSchema>;
