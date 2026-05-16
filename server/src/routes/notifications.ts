import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth-middleware";

const router = Router();

const NOTIFICATION_LIST_LIMIT = 30;

router.get("/", requireAuth, async (req, res) => {
  const userId = req.user!.id;

  const [rows, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: NOTIFICATION_LIST_LIMIT,
      select: {
        id: true,
        type: true,
        ticketId: true,
        readAt: true,
        createdAt: true,
        ticket: { select: { subject: true } },
        actor: { select: { name: true } },
      },
    }),
    prisma.notification.count({ where: { userId, readAt: null } }),
  ]);

  const data = rows.map((n) => ({
    id: n.id,
    type: n.type,
    ticketId: n.ticketId,
    ticketSubject: n.ticket.subject,
    actorName: n.actor?.name ?? null,
    readAt: n.readAt?.toISOString() ?? null,
    createdAt: n.createdAt.toISOString(),
  }));

  res.json({ data, unreadCount });
});

router.patch("/:id/read", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const id = String(req.params.id);

  const result = await prisma.notification.updateMany({
    where: { id, userId, readAt: null },
    data: { readAt: new Date() },
  });

  if (result.count === 0) {
    const exists = await prisma.notification.findFirst({ where: { id, userId }, select: { id: true } });
    if (!exists) {
      res.status(404).json({ error: "Notification not found" });
      return;
    }
  }
  res.status(204).end();
});

router.post("/mark-all-read", requireAuth, async (req, res) => {
  const userId = req.user!.id;
  const result = await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
  res.json({ markedCount: result.count });
});

export default router;
