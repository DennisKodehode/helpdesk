import {
  ACTOR_AI_FILTER_VALUE,
  ACTOR_SYSTEM_FILTER_VALUE,
  type AuditEventType,
  auditEventQuerySchema,
  type PaginatedAuditEvents,
} from "@helpdesk/core";
import { Router } from "express";
import type { Prisma } from "../generated/prisma/client";
import { getAiUserId } from "../lib/ai-user";
import { prisma } from "../lib/prisma";
import { firstIssue } from "../lib/validation";
import { requireAdminChain } from "../middleware/auth-middleware";

const DAY_MS = 24 * 60 * 60 * 1000;

// Parse a date-only (YYYY-MM-DD) or full ISO string as a Date, treated as UTC
// (date-only ISO parses to UTC midnight per spec — deterministic for an audit
// log, independent of server timezone). Returns null on an unparseable value.
function parseDate(raw: string): Date | null {
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

const router = Router();

// Admin-only activity log: every audit event across all tickets, newest-first,
// filterable by event type / actor / date range, offset-paginated. Distinct
// from /api/stats/recent-activity (all-agents, top-N teaser, no filters).
router.get("/", ...requireAdminChain, async (req, res) => {
  const parsed = auditEventQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: firstIssue(parsed.error) });
    return;
  }
  const { type, actorId, from, to, page, pageSize } = parsed.data;

  const where: Prisma.AuditEventWhereInput = {};
  if (type) where.type = type;

  if (actorId === ACTOR_SYSTEM_FILTER_VALUE) {
    // Automated events, plus deleted agents' events (actorId nulled via SetNull).
    where.actorId = null;
  } else if (actorId === ACTOR_AI_FILTER_VALUE) {
    const aiUserId = getAiUserId();
    // AI user not resolved at runtime → nothing can match; short-circuit empty.
    if (!aiUserId) {
      res.json({ data: [], total: 0, page, pageSize } satisfies PaginatedAuditEvents);
      return;
    }
    where.actorId = aiUserId;
  } else if (actorId) {
    where.actorId = actorId;
  }

  // Date range on createdAt. `to` is made inclusive of its whole day by using a
  // start-of-next-day `lt`. Unparseable bounds are ignored (UI sends valid dates).
  const createdAt: { gte?: Date; lt?: Date } = {};
  if (from) {
    const fromDate = parseDate(from);
    if (fromDate) createdAt.gte = fromDate;
  }
  if (to) {
    const toDate = parseDate(to);
    if (toDate) createdAt.lt = new Date(toDate.getTime() + DAY_MS);
  }
  if (createdAt.gte || createdAt.lt) where.createdAt = createdAt;

  const [events, total] = await prisma.$transaction([
    prisma.auditEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        type: true,
        ticketId: true,
        data: true,
        createdAt: true,
        actor: { select: { name: true } },
        ticket: { select: { subject: true } },
      },
    }),
    prisma.auditEvent.count({ where }),
  ]);

  const response: PaginatedAuditEvents = {
    data: events.map((e) => ({
      id: e.id,
      type: e.type as AuditEventType,
      ticketId: e.ticketId,
      ticketSubject: e.ticket.subject,
      actorName: e.actor?.name ?? null,
      data: e.data,
      createdAt: e.createdAt.toISOString(),
    })),
    total,
    page,
    pageSize,
  };
  res.json(response);
});

export default router;
