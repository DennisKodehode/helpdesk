import {
  type CategoryBreakdownResponse,
  computeSlaState,
  SenderType,
  type SlaHealthResponse,
  SlaMetric,
  type TicketCategory,
  type TicketPriority,
  TicketStatus,
} from "@helpdesk/core";
import { Router } from "express";
import { getAiUserId } from "../lib/ai-user";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth-middleware";

const ACTIVE_STATUSES = [TicketStatus.new, TicketStatus.processing, TicketStatus.open];

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

  const [row] = await prisma.$queryRaw<
    [TicketStatsRow]
  >`SELECT * FROM get_ticket_stats(${aiUserId})`;

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

export default router;
