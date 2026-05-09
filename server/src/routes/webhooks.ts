import { Router } from "express";
import { inboundEmailSchema, TicketStatus, SenderType } from "@helpdesk/core";
import { prisma } from "../lib/prisma";
import { firstIssue } from "../lib/validation";
import boss from "../lib/boss";
import { CLASSIFY_TICKET_QUEUE } from "../lib/classify-ticket";

const router = Router();

router.post("/inbound-email", async (req, res) => {
  const result = inboundEmailSchema.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({ error: firstIssue(result.error) });
    return;
  }

  const { fromName, fromEmail, subject, body, bodyHtml } = result.data;

  const existingTicket = await prisma.ticket.findFirst({
    where: {
      fromEmail,
      status: { in: [TicketStatus.open, TicketStatus.resolved] },
    },
    orderBy: { createdAt: "desc" },
  });

  if (existingTicket) {
    const reply = await prisma.reply.create({
      data: {
        ticketId: existingTicket.id,
        authorId: null,
        senderType: SenderType.customer,
        body: body ?? "",
        bodyHtml: bodyHtml ?? null,
      },
    });
    res.status(201).json({ type: "reply", reply });
    return;
  }

  const ticket = await prisma.ticket.create({
    data: { fromName, fromEmail, subject, body: body ?? "", bodyHtml: bodyHtml ?? null, status: TicketStatus.open },
  });

  await boss.send(CLASSIFY_TICKET_QUEUE, { id: ticket.id, subject: ticket.subject, body: ticket.body });

  res.status(201).json({ type: "ticket", ticket });
});

export default router;
