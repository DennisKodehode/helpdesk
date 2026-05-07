import { Router } from "express";
import { Prisma } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth-middleware";
import { ticketSortSchema } from "@helpdesk/core";
import { firstIssue } from "../lib/validation";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  const result = ticketSortSchema.safeParse(req.query);
  if (!result.success) {
    res.status(400).json({ error: firstIssue(result.error) });
    return;
  }

  const { sortBy = "createdAt", sortOrder = "desc", status, category, search } = result.data;

  const nullableFields = new Set(["category"]);
  const orderBy = nullableFields.has(sortBy)
    ? { [sortBy]: { sort: sortOrder, nulls: "last" as const } }
    : { [sortBy]: sortOrder };

  const trimmed = search?.trim();

  const where: Prisma.TicketWhereInput = {
    ...(status && { status }),
    ...(category && { category }),
    ...(trimmed && {
      OR: [
        { subject: { contains: trimmed, mode: "insensitive" } },
        { fromName: { contains: trimmed, mode: "insensitive" } },
        { fromEmail: { contains: trimmed, mode: "insensitive" } },
      ],
    }),
  };

  const tickets = await prisma.ticket.findMany({
    where,
    orderBy,
    select: {
      id: true,
      fromName: true,
      fromEmail: true,
      subject: true,
      status: true,
      category: true,
      assignedToId: true,
      createdAt: true,
    },
  });

  res.json(tickets);
});

export default router;
