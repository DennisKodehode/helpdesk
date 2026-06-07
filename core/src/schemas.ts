import { z } from "zod";
import {
  AdminAuditEventType,
  AuditEventType,
  AutoAssignMode,
  KbArticleSource,
  KbArticleStatus,
  KbSuggestionSource,
  KbSuggestionStatus,
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
// Role is restricted to admin/agent: `globalAdmin` is never assignable via the
// API (it's a programmatic-only singleton). Whether the caller may actually
// invite an `admin` is enforced in the route handler (global-admin only).
export const inviteAgentSchema = z.object({
  name: z.string().trim().min(3, "Name must be at least 3 characters"),
  email: z.email("Invalid email address"),
  role: z.enum([Role.admin, Role.agent]),
});

export type InviteAgentData = z.infer<typeof inviteAgentSchema>;

// Public accept-invite payload (token from the email link + chosen password).
export const acceptInviteSchema = z.object({
  token: z.string().min(1),
  password: z.string().trim().min(8, "Password must be at least 8 characters"),
});

export type AcceptInviteData = z.infer<typeof acceptInviteSchema>;

// Client-only accept-invite form schema. Adds a confirmation field so the
// invitee must type their new password twice and the two must match. This is a
// UX guard that never leaves the browser — the API payload (acceptInviteSchema)
// only carries `password`. Both sides are trimmed so trailing whitespace can't
// cause a spurious mismatch (the stored password is trimmed too).
export const acceptInviteFormSchema = z
  .object({
    password: z.string().trim().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().trim(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type AcceptInviteFormData = z.infer<typeof acceptInviteFormSchema>;

// --- Password reset (Better Auth built-in) ---------------------------------
// The reset endpoints are Better Auth's own (request-password-reset /
// reset-password); these schemas only back the client forms. The "forgot"
// form collects an email; the "reset" form collects + confirms a new password,
// mirroring acceptInviteFormSchema (trim both sides so trailing whitespace can't
// trigger a spurious mismatch).
export const requestPasswordResetSchema = z.object({
  email: z.email("Invalid email address"),
});

export type RequestPasswordResetData = z.infer<typeof requestPasswordResetSchema>;

export const resetPasswordFormSchema = z
  .object({
    newPassword: z.string().trim().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string().trim(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type ResetPasswordFormData = z.infer<typeof resetPasswordFormSchema>;

// Role changes are limited to admin/agent. `globalAdmin` is programmatic-only
// (DB-seeded singleton) and can never be granted or revoked through the API.
export const updateUserRoleSchema = z.object({
  role: z.enum([Role.admin, Role.agent]),
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
  // True when an agent has already filed a "Suggest for KB" request for this
  // ticket — derived server-side so the button stays disabled across navigation.
  hasKbSuggestion: z.boolean(),
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
  // Scope toggle: the queue defaults to Active (non-closed); `archived=true`
  // flips it to the Archive (closed-only). Distinct from the `view` presets —
  // it's the base status scope, not an exclusive preset.
  archived: z.coerce.boolean().optional(),
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

// AI "Polish" response — the KB-grounded rewrite of the agent's own draft.
// Polish fact-checks the draft against the category-filtered knowledge base,
// corrects/anchors factual claims, and reports how well-supported the result is.
// `sources` are the KB articles the model cited, already resolved to id/title
// server-side (hallucinated indexes are dropped before this point).
export const polishReplyResponseSchema = z.object({
  body: z.string(),
  confidence: z.number().min(0).max(100),
  changeSummary: z.string().nullable(),
  sources: z.array(z.object({ id: z.string(), title: z.string() })),
});

export type PolishReplyResponse = z.infer<typeof polishReplyResponseSchema>;

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

// --- Admin · Workflow settings --------------------------------------------
// Singleton row governing the configurable ticket-lifecycle rules (auto-assign,
// AI auto-resolve gates, resolution gates, auto-close, reopen, lock). The SLA
// targets live in their own schemas above; the Workflow admin screen edits both
// but the contracts stay separate. `autoResolveThreshold` is stored as an
// integer percent (50–99); the AI worker compares it against the model's
// 0–100 confidence. `roundRobinCursor` is internal server state and is
// deliberately absent here — it is never read or written by the client.
export const workflowSettingsSchema = z.object({
  autoAssignOn: z.boolean(),
  autoAssignMode: z.enum(AutoAssignMode),
  autoResolveOn: z.boolean(),
  autoResolveThreshold: z.number().int().min(50).max(99),
  requireCategory: z.boolean(),
  requireAssignee: z.boolean(),
  autoCloseOn: z.boolean(),
  autoCloseDays: z.number().int().min(1).max(30),
  reopenOnReply: z.boolean(),
  lockClosed: z.boolean(),
  // Dashboard SLA-compliance ring colours: >= green is healthy, >= yellow is
  // warning, below yellow is breaching. Stored as integer percents; the
  // green > yellow ordering is enforced on update (see updateWorkflowSettingsSchema).
  slaGreenMin: z.number().int().min(0).max(100),
  slaYellowMin: z.number().int().min(0).max(100),
  // Self-growing KB. `kbGrowthOn` master switch; `kbGrowthIntervalDays` is how
  // often the AI gap-analysis runs (also the lookback window); `kbMinClusterSize`
  // is the min number of similar resolved tickets before a topic is proposed.
  // The internal `kbGrowthLastRunAt` cadence timestamp is deliberately absent —
  // never read or written by the client.
  kbGrowthOn: z.boolean(),
  kbGrowthIntervalDays: z.number().int().min(1).max(365),
  kbMinClusterSize: z.number().int().min(2).max(20),
  updatedAt: z.string(),
});

export type WorkflowSettings = z.infer<typeof workflowSettingsSchema>;

// Any field may be omitted to leave it unchanged. Rejects an empty body so a
// no-op PATCH is a 400 (mirrors updateSlaPolicySchema's .refine()). The cross-
// field green > yellow rule can only be fully checked against the merged row
// (a PATCH may touch just one), so the route does that; here we catch the
// obvious case where both are sent inverted.
export const updateWorkflowSettingsSchema = workflowSettingsSchema
  .omit({ updatedAt: true })
  .partial()
  .refine((v) => Object.keys(v).length > 0, {
    message: "At least one field is required",
  })
  .refine(
    (v) =>
      v.slaGreenMin == null || v.slaYellowMin == null || v.slaGreenMin > v.slaYellowMin,
    { message: "Green threshold must be greater than the yellow threshold" },
  );

export type UpdateWorkflowSettingsData = z.infer<typeof updateWorkflowSettingsSchema>;

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

// Activity-page health signals (Watchlist) — operational-health metrics derived
// from the audit stream over a trailing 7-day window. Each signal pairs a value
// with a threshold `state`, a signed week-over-week `delta`, and a 10-point
// weekly `spark` trend (oldest → newest; the last point is the current week, so
// it equals `value`). The server returns computed numbers only — the static
// presentation copy (label/read/unit/worseDir/drill) lives client-side.
export const healthSignalSchema = z.object({
  id: z.enum(["ai-escalation", "ai-failures", "reassignment", "reopened", "priority"]),
  value: z.number(),
  numerator: z.number().int().nonnegative(),
  denominator: z.number().int().nonnegative(),
  state: z.enum(["alert", "watch", "ok"]),
  delta: z.number(),
  spark: z.array(z.number()).length(10),
  // Denominator too small to be meaningful — render muted, suppress alarm copy.
  lowSample: z.boolean(),
  // Only meaningful for the `reassignment` signal; null otherwise.
  avgHandoffs: z.number().nullable(),
});

export const healthSignalsResponseSchema = z.object({
  signals: z.array(healthSignalSchema),
  windowDays: z.number().int().positive(),
});

export type HealthSignal = z.infer<typeof healthSignalSchema>;
export type HealthSignalsResponse = z.infer<typeof healthSignalsResponseSchema>;
export type HealthSignalId = HealthSignal["id"];
export type HealthSignalState = HealthSignal["state"];

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

// Admin activity-log query params. Coercion mirrors `ticketSortSchema` so the
// raw `req.query` strings parse into numbers/defaults. `actorId` is free-form:
// a user id, or one of ACTOR_SYSTEM_FILTER_VALUE / ACTOR_AI_FILTER_VALUE which
// the server resolves. `from`/`to` are date-only (YYYY-MM-DD) or ISO strings;
// the server treats them as UTC and makes `to` inclusive.
export const auditEventQuerySchema = z.object({
  type: z.enum(AuditEventType).optional(),
  actorId: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export type AuditEventQuery = z.infer<typeof auditEventQuerySchema>;

// The activity-log row is identical to the dashboard's recent-activity row
// (flat `actorName`) — reuse it so the server maps the same way and the UI can
// share `auditSummary`/`<ActivityIcon>` with no adapter.
export const auditEventRowSchema = recentActivityRowSchema;
export type AuditEventRow = RecentActivityRow;

export const paginatedAuditEventsSchema = z.object({
  data: z.array(recentActivityRowSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
});

export type PaginatedAuditEvents = z.infer<typeof paginatedAuditEventsSchema>;

// --- Admin-action audit log (separate from the ticket AuditEvent) ----------
// Admin-only log of user-management + config mutations. The row carries
// denormalized `actorName`/`targetName` snapshots so it stays legible after the
// referenced users are deleted (the actor FK is SetNull, but the name persists).
// `targetName` doubles as the human label of what was affected: a user's name
// (bucket A) or a config area like "SLA · Urgent" / "Workflow" (bucket B).
export const adminAuditRowSchema = z.object({
  id: z.string(),
  type: z.enum(AdminAuditEventType),
  actorName: z.string(),
  targetUserId: z.string().nullable(),
  targetName: z.string().nullable(),
  data: z.unknown(),
  createdAt: z.string(),
});

export type AdminAuditRow = z.infer<typeof adminAuditRowSchema>;

// Mirrors auditEventQuerySchema. `actorId` is free-form (a user id) or the
// ACTOR_SYSTEM_FILTER_VALUE sentinel (events whose actor was deleted → null).
export const adminAuditEventQuerySchema = z.object({
  type: z.enum(AdminAuditEventType).optional(),
  actorId: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export type AdminAuditEventQuery = z.infer<typeof adminAuditEventQuerySchema>;

export const paginatedAdminAuditEventsSchema = z.object({
  data: z.array(adminAuditRowSchema),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
});

export type PaginatedAdminAuditEvents = z.infer<typeof paginatedAdminAuditEventsSchema>;

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

// --- Knowledge base ---------------------------------------------------------
// Structured KB articles (replace the legacy knowledge-base.md). `category` is
// nullable — null means a general/uncategorized article that's always injected
// into the AI corpus regardless of the ticket's category. `hitCount`/`lastUsedAt`
// are read-only usage signals the server maintains; the client renders but never
// writes them.
export const kbArticleSchema = z.object({
  id: z.string(),
  title: z.string(),
  question: z.string(),
  answer: z.string(),
  category: z.enum(TicketCategory).nullable(),
  status: z.enum(KbArticleStatus),
  source: z.enum(KbArticleSource),
  hitCount: z.number().int(),
  lastUsedAt: z.string().nullable(),
  lastReviewedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type KbArticle = z.infer<typeof kbArticleSchema>;

export const kbArticlesResponseSchema = z.array(kbArticleSchema);

// Article authoring. `status` is restricted to draft/published on create —
// archiving is a transition done via update, never an initial state. `category`
// accepts null for a general article.
export const createKbArticleSchema = z.object({
  title: z.string().trim().min(3, "Title must be at least 3 characters").max(200),
  question: z.string().trim().min(3, "Question must be at least 3 characters").max(2000),
  answer: z.string().trim().min(3, "Answer must be at least 3 characters").max(10_000),
  category: z.enum(TicketCategory).nullable(),
  status: z.enum([KbArticleStatus.draft, KbArticleStatus.published]),
});

export type CreateKbArticleData = z.infer<typeof createKbArticleSchema>;

// Any field may be omitted to leave it unchanged. `status` accepts all three
// states here (archiving is an update). Rejects an empty body so a no-op PATCH
// is a 400 (mirrors updateWorkflowSettingsSchema).
export const updateKbArticleSchema = z
  .object({
    title: z.string().trim().min(3, "Title must be at least 3 characters").max(200),
    question: z
      .string()
      .trim()
      .min(3, "Question must be at least 3 characters")
      .max(2000),
    answer: z.string().trim().min(3, "Answer must be at least 3 characters").max(10_000),
    category: z.enum(TicketCategory).nullable(),
    status: z.enum(KbArticleStatus),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, {
    message: "At least one field is required",
  });

export type UpdateKbArticleData = z.infer<typeof updateKbArticleSchema>;

// --- KB suggestions (self-growing KB) --------------------------------------
// A proposed article awaiting admin review. `requestedByName` is the agent who
// filed it (null for AI-sourced); `sourceTicketIds` are the tickets that
// motivated it. Approving creates a KbArticle (see approveKbSuggestionSchema).
export const kbSuggestionSchema = z.object({
  id: z.string(),
  source: z.enum(KbSuggestionSource),
  status: z.enum(KbSuggestionStatus),
  category: z.enum(TicketCategory).nullable(),
  title: z.string(),
  question: z.string(),
  answer: z.string(),
  sourceTicketIds: z.array(z.number().int()).nullable(),
  requestedByName: z.string().nullable(),
  reviewedByName: z.string().nullable(),
  reviewedAt: z.string().nullable(),
  reviewReason: z.string().nullable(),
  resultArticleId: z.string().nullable(),
  createdAt: z.string(),
});

export type KbSuggestion = z.infer<typeof kbSuggestionSchema>;

export const kbSuggestionsResponseSchema = z.array(kbSuggestionSchema);

export const kbSuggestionsCountResponseSchema = z.object({
  pending: z.number().int().nonnegative(),
});

export type KbSuggestionsCountResponse = z.infer<typeof kbSuggestionsCountResponseSchema>;

// Approval payload: the admin may edit the proposed article before it's
// published, and choose draft vs published — mirrors createKbArticleSchema.
export const approveKbSuggestionSchema = z.object({
  title: z.string().trim().min(3, "Title must be at least 3 characters").max(200),
  question: z.string().trim().min(3, "Question must be at least 3 characters").max(2000),
  answer: z.string().trim().min(3, "Answer must be at least 3 characters").max(10_000),
  category: z.enum(TicketCategory).nullable(),
  status: z.enum([KbArticleStatus.draft, KbArticleStatus.published]),
});

export type ApproveKbSuggestionData = z.infer<typeof approveKbSuggestionSchema>;

export const rejectKbSuggestionSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export type RejectKbSuggestionData = z.infer<typeof rejectKbSuggestionSchema>;
