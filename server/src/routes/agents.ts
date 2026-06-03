import { Role, UserStatus } from "@helpdesk/core";
import { Router } from "express";
import { prisma } from "../lib/prisma";
import { requireAuth } from "../middleware/auth-middleware";

const router = Router();

// Assignable agents: invited + active, excluding deactivated agents (they can't
// act on tickets) and the AI user. Drives the ticket "Assigned to" picker.
router.get("/", requireAuth, async (_req, res) => {
  const agents = await prisma.user.findMany({
    where: {
      role: Role.agent,
      deletedAt: null,
      status: { not: UserStatus.inactive },
      NOT: { email: "ai@helpdesk.internal" },
    },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });
  res.json(agents);
});

export default router;
