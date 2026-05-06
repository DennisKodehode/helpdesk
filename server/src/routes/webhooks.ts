import { Router } from "express";
import { inboundEmailSchema, TicketStatus } from "@helpdesk/core";
import { prisma } from "../lib/prisma";
import { firstIssue } from "../lib/validation";

const router = Router();

router.post("/inbound-email", async (req, res) => {
  const result = inboundEmailSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: firstIssue(result.error) });
    return;
  }

  const { fromName, fromEmail, subject, body } = result.data;

  const ticket = await prisma.ticket.create({
    data: { fromName, fromEmail, subject, body: body ?? "", status: TicketStatus.open },
  });

  res.status(201).json(ticket);
});

export default router;
