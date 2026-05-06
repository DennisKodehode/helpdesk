import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth-middleware";

const router = Router();

router.get("/", requireAuth, async (_req, res) => {
  const tickets = await prisma.ticket.findMany({
    orderBy: { createdAt: "desc" },
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
