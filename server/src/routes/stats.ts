import {
  type AiActivityResponse,
  AuditEventType,
  type CategoryBreakdownResponse,
  computeSlaState,
  type NeedsAttentionResponse,
  type RecentActivityResponse,
  SenderType,
  type SlaComplianceResponse,
  type SlaHealthResponse,
  SlaMetric,
  type TicketCategory,
  TicketPriority,
  TicketStatus,
} from "@helpdesk/core";
import { Router } from "express";
import { getAiUserId } from "../lib/ai-user";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth-middleware";

const ACTIVE_STATUSES = [TicketStatus.new, TicketStatus.processing, TicketStatus.open];
const TRIAGING_STATUSES = [TicketStatus.new, TicketStatus.processing];
const COMPLETED_STATUSES = [TicketStatus.resolved, TicketStatus.closed];

const DAY_MS = 24 * 60 * 60 * 1000;
const PRIORITY_ORDER: Record<TicketPriority, number> = {
  [TicketPriority.urgent]: 0,
  [TicketPriority.high]: 1,
  [TicketPriority.normal]: 2,
  [TicketPriority.low]: 3,
};

// Clamp a `?days=`/`?limit=` query param to a sane range, falling back when
// absent or unparseable.
function clampParam(raw: unknown, fallback: number, min: number, max: number): number {
  const n = typeof raw === "string" ? Number.parseInt(raw, 10) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

type TicketStatsRow = {
  total_tickets: bigint;
  open_tickets: bigint;
  unassigned_count: bigint;
  resolved_count: bigint;
  closed_tickets: bigint;
  total_completed: bigint;
  ai_resolved: bigint;
  ai_resolved_30d: bigint;
  total_completed_30d: bigint;
  percent_resolved_by_ai_30d: number | null;
  avg_resolution_minutes: number | null;
};

const router = Router();

router.get("/", requireAuth, async (_req, res) => {
  const aiUserId = getAiUserId();
  const sevenDaysAgo = new Date(Date.now() - 7 * DAY_MS);

  // The SQL function carries the bulk of the headline numbers; triaging and
  // resolved-7d are cheap counts that feed the dashboard stat cards.
  const [[row], triagingTickets, resolvedLast7d] = await Promise.all([
    prisma.$queryRaw<[TicketStatsRow]>`SELECT * FROM get_ticket_stats(${aiUserId})`,
    prisma.ticket.count({ where: { status: { in: TRIAGING_STATUSES } } }),
    prisma.ticket.count({
      where: { status: { in: COMPLETED_STATUSES }, resolvedAt: { gte: sevenDaysAgo } },
    }),
  ]);

  res.json({
    totalTickets: Number(row.total_tickets),
    openTickets: Number(row.open_tickets),
    unassignedTickets: Number(row.unassigned_count),
    resolvedTickets: Number(row.resolved_count),
    closedTickets: Number(row.closed_tickets),
    resolvedByAI: Number(row.ai_resolved),
    percentResolvedByAILast30d: Number(row.percent_resolved_by_ai_30d ?? 0),
    avgResolutionMinutes:
      row.avg_resolution_minutes != null ? Number(row.avg_resolution_minutes) : null,
    triagingTickets,
    resolvedLast7d,
  });
});

router.get("/me", requireAuth, async (req, res) => {
  const meId = req.user!.id;
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    openOnMyPlate,
    resolvedLifetime,
    resolved30d,
    repliesLifetime,
    replies30d,
    avgResRows,
    avgFirstRows,
  ] = await Promise.all([
    prisma.ticket.count({ where: { assignedToId: meId, status: TicketStatus.open } }),
    prisma.ticket.count({
      where: {
        assignedToId: meId,
        status: { in: [TicketStatus.resolved, TicketStatus.closed] },
      },
    }),
    prisma.ticket.count({
      where: {
        assignedToId: meId,
        status: { in: [TicketStatus.resolved, TicketStatus.closed] },
        resolvedAt: { gte: thirtyDaysAgo },
      },
    }),
    prisma.reply.count({ where: { authorId: meId, senderType: SenderType.agent } }),
    prisma.reply.count({
      where: {
        authorId: meId,
        senderType: SenderType.agent,
        createdAt: { gte: thirtyDaysAgo },
      },
    }),
    prisma.$queryRaw<{ minutes: number | null }[]>`
      SELECT ROUND((EXTRACT(EPOCH FROM AVG("resolvedAt" - "createdAt")) / 60)::NUMERIC, 1) AS minutes
      FROM ticket
      WHERE "assignedToId" = ${meId} AND "resolvedAt" IS NOT NULL
    `,
    prisma.$queryRaw<{ minutes: number | null }[]>`
      WITH first_agent_reply AS (
        SELECT DISTINCT ON ("ticketId") "ticketId", "authorId", "createdAt" AS reply_at
        FROM reply
        WHERE "senderType" = 'agent'
        ORDER BY "ticketId", "createdAt" ASC
      )
      SELECT ROUND((EXTRACT(EPOCH FROM AVG(far.reply_at - t."createdAt")) / 60)::NUMERIC, 1) AS minutes
      FROM first_agent_reply far
      JOIN ticket t ON t.id = far."ticketId"
      WHERE far."authorId" = ${meId}
    `,
  ]);

  const avgResMinutes = avgResRows[0]?.minutes;
  const avgFirstMinutes = avgFirstRows[0]?.minutes;

  res.json({
    openOnMyPlate,
    resolvedLifetime,
    resolved30d,
    avgResolutionMinutes: avgResMinutes != null ? Number(avgResMinutes) : null,
    avgFirstResponseMinutes: avgFirstMinutes != null ? Number(avgFirstMinutes) : null,
    repliesLifetime,
    replies30d,
  });
});

router.get("/tickets-per-day", requireAuth, async (_req, res) => {
  const rows = await prisma.$queryRaw<{ date: Date; count: bigint }[]>`
    SELECT DATE("createdAt") AS date, COUNT(*) AS count
    FROM ticket
    WHERE "createdAt" >= NOW() - INTERVAL '30 days'
    GROUP BY DATE("createdAt")
    ORDER BY date ASC
  `;

  // Build a full 30-day series, filling missing days with 0
  const today = new Date();
  const series: { date: string; count: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(today.getUTCDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const row = rows.find((r) => r.date.toISOString().slice(0, 10) === dateStr);
    series.push({ date: dateStr, count: row ? Number(row.count) : 0 });
  }

  res.json(series);
});

router.get("/sla-health", requireAuth, async (_req, res) => {
  const [tickets, policies] = await Promise.all([
    prisma.ticket.findMany({
      where: { status: { in: ACTIVE_STATUSES } },
      select: {
        priority: true,
        status: true,
        createdAt: true,
        firstAgentReplyAt: true,
        resolvedAt: true,
      },
    }),
    prisma.slaPolicy.findMany(),
  ]);

  // Keyed by raw priority string to sidestep the nominal mismatch between
  // core's TS string-enum `TicketPriority` and Prisma's generated literal
  // union — values are identical at runtime. Same pattern as sla-breach-check.
  const policyMap = new Map<
    string,
    { firstResponseMinutes: number | null; resolutionMinutes: number | null }
  >(
    policies.map((p) => [
      p.priority,
      {
        firstResponseMinutes: p.firstResponseMinutes,
        resolutionMinutes: p.resolutionMinutes,
      },
    ]),
  );

  let breached = 0;
  let atRisk = 0;
  let ok = 0;
  const byMetric: SlaHealthResponse["byMetric"] = {
    firstResponse: { breached: 0, atRisk: 0 },
    resolution: { breached: 0, atRisk: 0 },
  };

  for (const t of tickets) {
    const state = computeSlaState(
      {
        createdAt: t.createdAt.toISOString(),
        firstAgentReplyAt: t.firstAgentReplyAt?.toISOString() ?? null,
        resolvedAt: t.resolvedAt?.toISOString() ?? null,
        // Cast across the Prisma-vs-core nominal-but-structurally-identical enum gap.
        priority: t.priority as TicketPriority,
        status: t.status as TicketStatus,
      },
      policyMap.get(t.priority),
    );
    if (state.state === "ok") {
      ok++;
      continue;
    }
    const bucket =
      state.metric === SlaMetric.first_response
        ? byMetric.firstResponse
        : byMetric.resolution;
    if (state.state === "breached") {
      breached++;
      bucket.breached++;
    } else {
      atRisk++;
      bucket.atRisk++;
    }
  }

  const response: SlaHealthResponse = {
    total: tickets.length,
    breached,
    atRisk,
    ok,
    byMetric,
  };
  res.json(response);
});

router.get("/categories", requireAuth, async (_req, res) => {
  const rows = await prisma.ticket.groupBy({
    by: ["category"],
    where: { status: { in: ACTIVE_STATUSES } },
    _count: { _all: true },
    orderBy: { _count: { category: "desc" } },
  });

  const response: CategoryBreakdownResponse = rows.map((r) => ({
    category: r.category as TicketCategory | null,
    count: r._count._all,
  }));
  res.json(response);
});

// "AI this week" — machine-driven activity counts over a trailing window.
router.get("/ai-activity", requireAuth, async (req, res) => {
  const days = clampParam(req.query.days, 7, 1, 365);
  const since = new Date(Date.now() - days * DAY_MS);
  const aiUserId = getAiUserId();

  const [autoResolved, autoClassified, escalated, repliesSent] = await Promise.all([
    prisma.auditEvent.count({
      where: { type: AuditEventType.auto_resolved, createdAt: { gte: since } },
    }),
    // Auto-classification records a `category_changed` event actored by the AI
    // user; without a known AI user there's nothing to attribute, so report 0.
    aiUserId
      ? prisma.auditEvent.count({
          where: {
            type: AuditEventType.category_changed,
            actorId: aiUserId,
            createdAt: { gte: since },
          },
        })
      : Promise.resolve(0),
    prisma.auditEvent.count({
      where: { type: AuditEventType.ai_escalated, createdAt: { gte: since } },
    }),
    prisma.reply.count({
      where: { senderType: SenderType.agent, createdAt: { gte: since } },
    }),
  ]);

  const response: AiActivityResponse = {
    autoResolved,
    autoClassified,
    escalated,
    repliesSent,
  };
  res.json(response);
});

// SLA compliance % over a trailing window — fraction of tickets whose outcome
// is decided (responded/resolved, or definitively late) that met their target.
router.get("/sla-compliance", requireAuth, async (req, res) => {
  const days = clampParam(req.query.days, 30, 1, 365);
  const since = new Date(Date.now() - days * DAY_MS);
  const now = Date.now();

  const [tickets, policies] = await Promise.all([
    prisma.ticket.findMany({
      where: { createdAt: { gte: since } },
      select: {
        priority: true,
        createdAt: true,
        firstAgentReplyAt: true,
        resolvedAt: true,
      },
    }),
    prisma.slaPolicy.findMany(),
  ]);

  const policyMap = new Map(
    policies.map((p) => [
      p.priority,
      {
        firstResponseMinutes: p.firstResponseMinutes,
        resolutionMinutes: p.resolutionMinutes,
      },
    ]),
  );

  let frMet = 0;
  let frDecided = 0;
  let resMet = 0;
  let resDecided = 0;

  for (const t of tickets) {
    const policy = policyMap.get(t.priority);
    const created = t.createdAt.getTime();

    const frTarget = policy?.firstResponseMinutes;
    if (frTarget != null) {
      if (t.firstAgentReplyAt) {
        frDecided++;
        if ((t.firstAgentReplyAt.getTime() - created) / 60_000 <= frTarget) frMet++;
      } else if ((now - created) / 60_000 > frTarget) {
        frDecided++; // definitively late, never responded
      }
    }

    const resTarget = policy?.resolutionMinutes;
    if (resTarget != null) {
      if (t.resolvedAt) {
        resDecided++;
        if ((t.resolvedAt.getTime() - created) / 60_000 <= resTarget) resMet++;
      } else if ((now - created) / 60_000 > resTarget) {
        resDecided++;
      }
    }
  }

  const pct = (met: number, decided: number) =>
    decided === 0 ? null : Math.round((met / decided) * 100);

  const response: SlaComplianceResponse = {
    firstResponse: pct(frMet, frDecided),
    resolution: pct(resMet, resDecided),
  };
  res.json(response);
});

// Global recent-activity timeline — newest audit events across all tickets.
router.get("/recent-activity", requireAuth, async (req, res) => {
  const limit = clampParam(req.query.limit, 10, 1, 50);

  const events = await prisma.auditEvent.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      type: true,
      ticketId: true,
      data: true,
      createdAt: true,
      actor: { select: { name: true } },
      ticket: { select: { subject: true } },
    },
  });

  const response: RecentActivityResponse = events.map((e) => ({
    id: e.id,
    type: e.type as AuditEventType,
    ticketId: e.ticketId,
    ticketSubject: e.ticket.subject,
    actorName: e.actor?.name ?? null,
    data: e.data,
    createdAt: e.createdAt.toISOString(),
  }));
  res.json(response);
});

// Active tickets at risk of, or past, an SLA target — breached first, then by
// priority. Reuses the same per-ticket computeSlaState as /sla-health.
router.get("/needs-attention", requireAuth, async (req, res) => {
  const limit = clampParam(req.query.limit, 5, 1, 20);

  const [tickets, policies] = await Promise.all([
    prisma.ticket.findMany({
      where: { status: { in: ACTIVE_STATUSES } },
      select: {
        id: true,
        subject: true,
        priority: true,
        status: true,
        createdAt: true,
        firstAgentReplyAt: true,
        resolvedAt: true,
      },
    }),
    prisma.slaPolicy.findMany(),
  ]);

  const policyMap = new Map(
    policies.map((p) => [
      p.priority,
      {
        firstResponseMinutes: p.firstResponseMinutes,
        resolutionMinutes: p.resolutionMinutes,
      },
    ]),
  );

  const rows: NeedsAttentionResponse = [];
  for (const t of tickets) {
    const state = computeSlaState(
      {
        createdAt: t.createdAt.toISOString(),
        firstAgentReplyAt: t.firstAgentReplyAt?.toISOString() ?? null,
        resolvedAt: t.resolvedAt?.toISOString() ?? null,
        priority: t.priority as TicketPriority,
        status: t.status as TicketStatus,
      },
      policyMap.get(t.priority),
    );
    if (state.state === "ok") continue;
    rows.push({
      id: t.id,
      subject: t.subject,
      priority: t.priority as TicketPriority,
      slaState: state.state,
      slaMetric: state.metric,
    });
  }

  rows.sort((a, b) => {
    if (a.slaState !== b.slaState) return a.slaState === "breached" ? -1 : 1;
    return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
  });

  res.json(rows.slice(0, limit));
});

export default router;
