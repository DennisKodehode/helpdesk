import { Router } from "express";
import { Role } from "@helpdesk/core";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth-middleware";

const router = Router();

router.get("/", requireAuth, async (_req, res) => {
  const agents = await prisma.user.findMany({
    where: { role: Role.agent, deletedAt: null },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });
  res.json(agents);
});

export default router;
