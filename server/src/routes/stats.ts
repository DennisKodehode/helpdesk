import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth-middleware";
import { TicketStatus } from "@helpdesk/core";

const router = Router();

router.get("/", requireAuth, async (_req, res) => {
  const aiUser = await prisma.user.findUnique({ where: { email: "ai@helpdesk.internal" } });

  const resolvedStatuses = [TicketStatus.resolved, TicketStatus.closed];

  const [total, open, totalResolved, aiResolved, avgResult] = await Promise.all([
    prisma.ticket.count(),
    prisma.ticket.count({ where: { status: TicketStatus.open } }),
    prisma.ticket.count({ where: { status: { in: resolvedStatuses } } }),
    aiUser
      ? prisma.ticket.count({
          where: { status: { in: resolvedStatuses }, assignedToId: aiUser.id },
        })
      : Promise.resolve(0),
    prisma.$queryRaw<[{ avg_seconds: unknown }]>`
      SELECT EXTRACT(EPOCH FROM AVG("resolvedAt" - "createdAt")) AS avg_seconds
      FROM ticket
      WHERE "resolvedAt" IS NOT NULL
    `,
  ]);

  const rawAvg = avgResult[0]?.avg_seconds;
  const avgResolutionMinutes =
    rawAvg != null ? Math.round((Number(rawAvg) / 60) * 10) / 10 : null;

  res.json({
    totalTickets: total,
    openTickets: open,
    resolvedByAI: aiResolved,
    percentResolvedByAI: totalResolved > 0 ? Math.round((aiResolved / totalResolved) * 1000) / 10 : 0,
    avgResolutionMinutes,
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

export default router;
