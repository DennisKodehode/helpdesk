import {
  ACTOR_SYSTEM_FILTER_VALUE,
  type AdminAuditEventType,
  adminAuditEventQuerySchema,
  type PaginatedAdminAuditEvents,
} from "@helpdesk/core";
import { Router } from "express";
import type { Prisma } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";
import { firstIssue } from "../lib/validation";
import { requireAdminChain } from "../middleware/auth-middleware";

const DAY_MS = 24 * 60 * 60 * 1000;

// Date-only (YYYY-MM-DD) or full ISO, treated as UTC. Null on unparseable.
function parseDate(raw: string): Date | null {
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

const router = Router();

// Admin-only log of admin/config mutations (user management + SLA/workflow
// changes), newest-first, filterable by event type / actor / date range,
// offset-paginated. Separate from /api/audit-events (ticket-scoped) and never
// surfaced on the agent dashboard. Reads denormalized actor/target names, so no
// joins are needed and the record survives the referenced users being deleted.
router.get("/", ...requireAdminChain, async (req, res) => {
  const parsed = adminAuditEventQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: firstIssue(parsed.error) });
    return;
  }
  const { type, actorId, from, to, page, pageSize } = parsed.data;

  const where: Prisma.AdminAuditEventWhereInput = {};
  if (type) where.type = type;

  if (actorId === ACTOR_SYSTEM_FILTER_VALUE) {
    // Events whose actor was deleted (actorId nulled via SetNull).
    where.actorId = null;
  } else if (actorId) {
    where.actorId = actorId;
  }

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
    prisma.adminAuditEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        type: true,
        actorName: true,
        targetUserId: true,
        targetName: true,
        data: true,
        createdAt: true,
      },
    }),
    prisma.adminAuditEvent.count({ where }),
  ]);

  const response: PaginatedAdminAuditEvents = {
    data: events.map((e) => ({
      id: e.id,
      type: e.type as AdminAuditEventType,
      actorName: e.actorName,
      targetUserId: e.targetUserId,
      targetName: e.targetName,
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
