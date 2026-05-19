import { TicketPriority, updateSlaPolicySchema } from "@helpdesk/core";
import { Router } from "express";
import { prisma } from "../lib/prisma";
import { firstIssue } from "../lib/validation";
import { requireAdminChain, requireAuth } from "../middleware/auth-middleware";

const router = Router();

// Any authenticated user can read policies — the client uses them to compute
// SLA badges in the ticket list/detail. Only admins can mutate.
router.get("/", requireAuth, async (_req, res) => {
  const policies = await prisma.slaPolicy.findMany({ orderBy: { priority: "asc" } });
  res.json(
    policies.map((p) => ({
      priority: p.priority,
      firstResponseMinutes: p.firstResponseMinutes,
      resolutionMinutes: p.resolutionMinutes,
      updatedAt: p.updatedAt.toISOString(),
    })),
  );
});

router.patch("/:priority", ...requireAdminChain, async (req, res) => {
  const priority = req.params.priority as string;
  if (!(Object.values(TicketPriority) as string[]).includes(priority)) {
    res.status(404).json({ error: "Unknown priority" });
    return;
  }
  const result = updateSlaPolicySchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: firstIssue(result.error) });
    return;
  }

  const existing = await prisma.slaPolicy.findUnique({
    where: { priority: priority as TicketPriority },
  });
  if (!existing) {
    res.status(404).json({ error: "Policy not found" });
    return;
  }

  const updated = await prisma.slaPolicy.update({
    where: { priority: priority as TicketPriority },
    data: result.data,
  });
  res.json({
    priority: updated.priority,
    firstResponseMinutes: updated.firstResponseMinutes,
    resolutionMinutes: updated.resolutionMinutes,
    updatedAt: updated.updatedAt.toISOString(),
  });
});

export default router;
