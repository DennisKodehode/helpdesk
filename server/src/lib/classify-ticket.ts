import { randomUUID } from "node:crypto";
import { google } from "@ai-sdk/google";
import { TicketCategory, TicketPriority } from "@helpdesk/core";
import * as Sentry from "@sentry/node";
import { generateText, Output } from "ai";
import type { Job } from "pg-boss";
import type { Logger } from "pino";
import { z } from "zod";
import { logger } from "./logger";
import { prisma } from "./prisma";

export const CLASSIFY_TICKET_QUEUE = "classify-ticket";

export type ClassifyTicketJobData = {
  id: number;
  subject: string;
  body: string;
  _requestId?: string;
};

const classificationSchema = z.object({
  category: z.enum(TicketCategory),
  priority: z.enum(TicketPriority),
});

async function runClassification(data: ClassifyTicketJobData, log: Logger) {
  const prompt =
    `Classify this customer support ticket along two axes.\n\n` +
    `Category (pick exactly one):\n` +
    `- general_question: how-to questions, account navigation, feature questions, and general inquiries\n` +
    `- technical_question: bug reports, errors, broken functionality, API or integration issues\n` +
    `- refund_request: requests for a refund or money back\n` +
    `- billing_inquiry: questions about charges, invoices, subscriptions, or pricing\n` +
    `- feature_request: suggestions or requests for new features\n\n` +
    `Priority (pick exactly one):\n` +
    `- low: routine questions, minor feature requests, no urgency signals\n` +
    `- normal: standard support issues (default when nothing else fits)\n` +
    `- high: active problems impacting the customer's work, repeated reports, time-sensitive billing\n` +
    `- urgent: account lockouts, payment failures, data loss, security concerns, total outages\n\n` +
    `Subject: ${data.subject}\n` +
    `Message: ${data.body}`;

  let output: { category: TicketCategory; priority: TicketPriority };
  try {
    ({ output } = await generateText({
      model: google("gemini-2.5-flash-lite"),
      output: Output.object({ schema: classificationSchema }),
      prompt,
      timeout: 30_000,
    }));
  } catch (err) {
    log.error({ err, ticketId: data.id }, "classify-ticket generateText failed");
    Sentry.captureException(err);
    return;
  }

  await prisma.ticket.update({
    where: { id: data.id },
    data: { category: output.category, priority: output.priority },
  });
}

export async function classifyTicketWorker([job]: Job<ClassifyTicketJobData>[]) {
  const log = logger.child({
    reqId: job.data._requestId ?? randomUUID(),
    job: CLASSIFY_TICKET_QUEUE,
    ticketId: job.data.id,
  });
  await runClassification(job.data, log);
}
