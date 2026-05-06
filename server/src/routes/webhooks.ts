import { Router } from "express";
import { inboundEmailSchema, TicketStatus } from "@helpdesk/core";
import { prisma } from "../lib/prisma";

const router = Router();

router.post("/inbound-email", async (req, res) => {
  const secret = req.headers["x-webhook-secret"];
  if (!secret || secret !== process.env.WEBHOOK_SECRET) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const result = inboundEmailSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: result.error.issues[0].message });
    return;
  }

  const { fromName, fromEmail, subject, body } = result.data;

  const ticket = await prisma.ticket.create({
    data: { fromName, fromEmail, subject, body: body ?? "", status: TicketStatus.open },
  });

  res.status(201).json(ticket);
});

export default router;
