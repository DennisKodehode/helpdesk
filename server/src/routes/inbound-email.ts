import { Router } from "express";
import { inboundEmailSchema, TicketStatus, SenderType } from "@helpdesk/core";
import { prisma } from "../lib/prisma";
import { firstIssue } from "../lib/validation";
import boss from "../lib/boss";
import { CLASSIFY_TICKET_QUEUE } from "../lib/classify-ticket";
import { AUTO_RESOLVE_TICKET_QUEUE } from "../lib/auto-resolve-ticket";
import resend from "../lib/resend";

const router = Router();

function parseFrom(from: string): { fromName: string; fromEmail: string } {
  const match = from.match(/^"?([^"<>]+?)"?\s*<([^>]+)>$/);
  if (match) {
    return { fromName: match[1].trim() || match[2].trim(), fromEmail: match[2].trim() };
  }
  return { fromName: from.trim(), fromEmail: from.trim() };
}

router.post("/", async (req, res) => {
  const rawPayload = (req as any).rawBody ?? JSON.stringify(req.body);

  try {
    resend.webhooks.verify({
      payload: rawPayload,
      headers: {
        id: req.headers["svix-id"] as string,
        timestamp: req.headers["svix-timestamp"] as string,
        signature: req.headers["svix-signature"] as string,
      },
      webhookSecret: process.env.RESEND_WEBHOOK_SECRET!,
    });
  } catch {
    res.status(401).json({ error: "Invalid webhook signature" });
    return;
  }

  const event = JSON.parse(rawPayload) as {
    type: string;
    data: { email_id: string; from: string; subject: string; to: string[]; text?: string; html?: string };
  };

  if (event.type !== "email.received") {
    res.status(200).json({ received: true });
    return;
  }

  const bodyText = event.data.text ?? undefined;
  const bodyHtml = event.data.html ?? undefined;

  const { fromName, fromEmail } = parseFrom(event.data.from ?? "");
  const result = inboundEmailSchema.safeParse({
    fromName,
    fromEmail,
    subject: event.data.subject,
    body: bodyText,
    bodyHtml,
  });

  if (!result.success) {
    res.status(400).json({ error: firstIssue(result.error) });
    return;
  }

  const { fromName: parsedName, fromEmail: parsedEmail, subject, body } = result.data;

  const existingTicket = await prisma.ticket.findFirst({
    where: {
      fromEmail: parsedEmail,
      subject,
      status: { in: [TicketStatus.new, TicketStatus.processing, TicketStatus.open, TicketStatus.resolved] },
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
    data: { fromName: parsedName, fromEmail: parsedEmail, subject, body: body ?? "", bodyHtml: bodyHtml ?? null, status: TicketStatus.new },
  });

  await boss.send(CLASSIFY_TICKET_QUEUE, { id: ticket.id, subject: ticket.subject, body: ticket.body });
  await boss.send(AUTO_RESOLVE_TICKET_QUEUE, { id: ticket.id, fromName: ticket.fromName, subject: ticket.subject, body: ticket.body });

  res.status(201).json({ type: "ticket", ticket });
});

export default router;
