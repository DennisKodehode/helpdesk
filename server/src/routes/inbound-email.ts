import {
  inboundEmailSchema,
  NotificationType,
  SenderType,
  TicketStatus,
} from "@helpdesk/core";
import * as Sentry from "@sentry/node";
import EmailReplyParser from "email-reply-parser";
import { Router } from "express";
import he from "he";
import { isAiAssigned } from "../lib/ai-user";
import { AUTO_RESOLVE_TICKET_QUEUE } from "../lib/auto-resolve-ticket";
import boss from "../lib/boss";
import { CLASSIFY_TICKET_QUEUE } from "../lib/classify-ticket";
import { prisma } from "../lib/prisma";
import resend from "../lib/resend";
import { firstIssue } from "../lib/validation";

const router = Router();

function parseFrom(from: string): { fromName: string; fromEmail: string } {
  const match = from.match(/^"?([^"<>]+?)"?\s*<([^>]+)>$/);
  if (match) {
    return { fromName: match[1].trim() || match[2].trim(), fromEmail: match[2].trim() };
  }
  return { fromName: from.trim(), fromEmail: from.trim() };
}

function findHeader(
  headers: Record<string, string> | null | undefined,
  name: string,
): string | undefined {
  if (!headers) return undefined;
  const lower = name.toLowerCase();
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === lower) return headers[key];
  }
  return undefined;
}

function isAutoSubmittedOrBounce(
  headers: Record<string, string> | null | undefined,
): string | null {
  const autoSubmitted = findHeader(headers, "Auto-Submitted");
  if (autoSubmitted && autoSubmitted.trim().toLowerCase() !== "no") {
    return `Auto-Submitted: ${autoSubmitted}`;
  }

  const suppress = findHeader(headers, "X-Auto-Response-Suppress");
  if (suppress && /\b(all|oof|autoreply)\b/i.test(suppress)) {
    return `X-Auto-Response-Suppress: ${suppress}`;
  }

  const precedence = findHeader(headers, "Precedence");
  if (precedence && /\b(bulk|auto_reply|list|junk)\b/i.test(precedence)) {
    return `Precedence: ${precedence}`;
  }

  const returnPath = findHeader(headers, "Return-Path");
  if (returnPath && returnPath.trim() === "<>") {
    return "Return-Path: <> (bounce)";
  }

  return null;
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
    data: { email_id: string; from: string; subject: string; to: string[] };
  };

  if (event.type !== "email.received") {
    res.status(200).json({ received: true });
    return;
  }

  const emailId = event.data.email_id;

  const [existingTicketWithId, existingReplyWithId] = await Promise.all([
    prisma.ticket.findUnique({ where: { resendEmailId: emailId }, select: { id: true } }),
    prisma.reply.findUnique({ where: { resendEmailId: emailId }, select: { id: true } }),
  ]);
  if (existingTicketWithId || existingReplyWithId) {
    res.status(200).json({ deduplicated: true });
    return;
  }

  const emailResult = await resend.emails.receiving.get(emailId);
  if (emailResult.error) {
    console.error("[inbound-email] Could not retrieve email body:", emailResult.error);
    Sentry.captureException(emailResult.error);
  }

  const loopReason = isAutoSubmittedOrBounce(emailResult.data?.headers);
  if (loopReason) {
    console.log(`[inbound-email] dropping email ${emailId}: ${loopReason}`);
    res.status(200).json({ dropped: true, reason: loopReason });
    return;
  }

  const rawText = emailResult.data?.text ?? "";
  const bodyText = rawText
    ? new EmailReplyParser().parseReply(he.decode(rawText))
    : undefined;
  const bodyHtml = undefined;

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
      status: {
        in: [
          TicketStatus.new,
          TicketStatus.processing,
          TicketStatus.open,
          TicketStatus.resolved,
        ],
      },
    },
    orderBy: { createdAt: "desc" },
  });

  if (existingTicket) {
    const wasResolved = existingTicket.status === TicketStatus.resolved;
    const shouldUnassignAi = wasResolved && isAiAssigned(existingTicket.assignedToId);
    const now = new Date();

    const [reply, refreshedTicket] = await prisma.$transaction([
      prisma.reply.create({
        data: {
          ticketId: existingTicket.id,
          authorId: null,
          senderType: SenderType.customer,
          body: body ?? "",
          bodyHtml: bodyHtml ?? null,
          resendEmailId: emailId,
        },
      }),
      prisma.ticket.update({
        where: { id: existingTicket.id },
        data: {
          updatedAt: now,
          ...(wasResolved && { status: TicketStatus.open, resolvedAt: null }),
          ...(shouldUnassignAi && { assignedToId: null }),
        },
        select: { id: true, assignedToId: true, subject: true },
      }),
    ]);

    if (refreshedTicket.assignedToId && !isAiAssigned(refreshedTicket.assignedToId)) {
      const agent = await prisma.user.findUnique({
        where: { id: refreshedTicket.assignedToId },
        select: { id: true, deletedAt: true },
      });
      if (agent && !agent.deletedAt) {
        await prisma.notification.create({
          data: {
            userId: agent.id,
            type: NotificationType.customer_reply,
            ticketId: refreshedTicket.id,
          },
        });
      }
    }

    res.status(201).json({ type: "reply", reply, reopened: wasResolved });
    return;
  }

  const ticket = await prisma.ticket.create({
    data: {
      fromName: parsedName,
      fromEmail: parsedEmail,
      subject,
      body: body ?? "",
      bodyHtml: bodyHtml ?? null,
      status: TicketStatus.new,
      resendEmailId: emailId,
    },
  });

  await boss.send(CLASSIFY_TICKET_QUEUE, {
    id: ticket.id,
    subject: ticket.subject,
    body: ticket.body,
  });
  await boss.send(AUTO_RESOLVE_TICKET_QUEUE, {
    id: ticket.id,
    fromName: ticket.fromName,
    subject: ticket.subject,
    body: ticket.body,
  });

  res.status(201).json({ type: "ticket", ticket });
});

export default router;
