import { Router } from "express";
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

  const { sortBy = "createdAt", sortOrder = "desc" } = result.data;

  const tickets = await prisma.ticket.findMany({
    orderBy: { [sortBy]: sortOrder },
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
