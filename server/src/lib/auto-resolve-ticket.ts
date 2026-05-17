import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { google } from "@ai-sdk/google";
import { SenderType, TicketStatus } from "@helpdesk/core";
import * as Sentry from "@sentry/node";
import { generateText } from "ai";
import type { Job } from "pg-boss";
import type { Logger } from "pino";
import { getAiUserId } from "./ai-user";
import boss from "./boss";
import { logger } from "./logger";
import { prisma } from "./prisma";
import { SEND_REPLY_EMAIL_QUEUE } from "./send-reply-email-job";

export const AUTO_RESOLVE_TICKET_QUEUE = "auto-resolve-ticket";

export type AutoResolveJobData = {
  id: number;
  fromName: string;
  subject: string;
  body: string;
  _requestId?: string;
};

const KNOWLEDGE_BASE = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../../knowledge-base.md"),
  "utf-8",
);

async function runAutoResolve(data: AutoResolveJobData, log: Logger) {
  const aiUserId = getAiUserId();
  if (!aiUserId) {
    log.warn({ ticketId: data.id }, "auto-resolve: skipping — AI agent user not found");
    return;
  }

  await prisma.ticket.update({
    where: { id: data.id },
    data: { status: TicketStatus.processing, assignedToId: aiUserId },
  });

  const prompt =
    `You are a customer support agent.\n\n` +
    `Using ONLY the knowledge base below, determine whether you can fully answer the customer's ticket.\n\n` +
    `You MUST respond with action: "escalate" if:\n` +
    `- The customer threatens legal action\n` +
    `- The customer requests a refund outside the 30-day window\n` +
    `- The customer disputes a charge or mentions a chargeback\n` +
    `- The issue involves account security concerns\n` +
    `- You are not confident the knowledge base fully covers this issue\n\n` +
    `KNOWLEDGE BASE:\n${KNOWLEDGE_BASE}\n\n` +
    `CUSTOMER TICKET:\n` +
    `Customer name: ${data.fromName}\n` +
    `Subject: ${data.subject}\n` +
    `Message: ${data.body}\n\n` +
    `Respond with JSON only, no markdown, no explanation:\n` +
    `{"action":"resolve","reply":"<complete reply addressed to the customer>"}\n` +
    `or\n` +
    `{"action":"escalate"}`;

  let text: string;
  try {
    ({ text } = await generateText({
      model: google("gemini-2.5-flash-lite"),
      prompt,
    }));
  } catch (err) {
    log.error({ err, ticketId: data.id }, "auto-resolve generateText failed");
    Sentry.captureException(err);
    await prisma.ticket.update({
      where: { id: data.id },
      data: { status: TicketStatus.open, assignedToId: null },
    });
    return;
  }

  let parsed: { action: string; reply?: string };
  try {
    parsed = JSON.parse(text.trim());
  } catch {
    log.error({ ticketId: data.id, text }, "auto-resolve: failed to parse AI response");
    Sentry.captureMessage("auto-resolve: AI response was not valid JSON", "error");
    await prisma.ticket.update({
      where: { id: data.id },
      data: { status: TicketStatus.open, assignedToId: null },
    });
    return;
  }

  if (parsed.action === "resolve" && parsed.reply) {
    const ticket = await prisma.ticket.findUnique({
      where: { id: data.id },
      select: { fromName: true, fromEmail: true, subject: true, firstAgentReplyAt: true },
    });

    const now = new Date();
    await prisma.$transaction([
      prisma.reply.create({
        data: {
          ticketId: data.id,
          authorId: aiUserId,
          senderType: SenderType.agent,
          body: parsed.reply,
        },
      }),
      prisma.ticket.update({
        where: { id: data.id },
        data: {
          status: TicketStatus.resolved,
          resolvedAt: now,
          ...(!ticket?.firstAgentReplyAt && { firstAgentReplyAt: now }),
        },
      }),
    ]);

    if (ticket) {
      await boss.send(SEND_REPLY_EMAIL_QUEUE, {
        to: ticket.fromEmail,
        toName: ticket.fromName,
        subject: ticket.subject,
        replyBody: parsed.reply,
        _requestId: data._requestId,
      });
    }
  } else {
    await prisma.ticket.update({
      where: { id: data.id },
      data: { status: TicketStatus.open, assignedToId: null },
    });
  }
}

export async function autoResolveTicketWorker([job]: Job<AutoResolveJobData>[]) {
  const log = logger.child({
    reqId: job.data._requestId ?? randomUUID(),
    job: AUTO_RESOLVE_TICKET_QUEUE,
    ticketId: job.data.id,
  });
  await runAutoResolve(job.data, log);
}
