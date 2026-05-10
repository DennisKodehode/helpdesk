import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth-middleware";
import { getAiUserId } from "../lib/ai-user";

type TicketStatsRow = {
  total_tickets: bigint;
  open_tickets: bigint;
  total_resolved: bigint;
  ai_resolved: bigint;
  percent_resolved_by_ai: number | null;
  avg_resolution_minutes: number | null;
};

const router = Router();

router.get("/", requireAuth, async (_req, res) => {
  const aiUserId = getAiUserId();

  const [row] = await prisma.$queryRaw<[TicketStatsRow]>`SELECT * FROM get_ticket_stats(${aiUserId})`;

  res.json({
    totalTickets: Number(row.total_tickets),
    openTickets: Number(row.open_tickets),
    resolvedByAI: Number(row.ai_resolved),
    percentResolvedByAI: Number(row.percent_resolved_by_ai ?? 0),
    avgResolutionMinutes: row.avg_resolution_minutes != null ? Number(row.avg_resolution_minutes) : null,
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
