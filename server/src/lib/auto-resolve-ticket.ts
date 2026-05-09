import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import type { Job } from "pg-boss";
import { google } from "@ai-sdk/google";
import { generateText } from "ai";
import { SenderType, TicketStatus } from "@helpdesk/core";
import { prisma } from "./prisma";

export const AUTO_RESOLVE_TICKET_QUEUE = "auto-resolve-ticket";

type AutoResolveJobData = { id: number; fromName: string; subject: string; body: string };

const KNOWLEDGE_BASE = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../../knowledge-base.md"), "utf-8");

async function runAutoResolve(data: AutoResolveJobData) {
  await prisma.ticket.update({ where: { id: data.id }, data: { status: TicketStatus.processing } });

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
    console.error("auto-resolve generateText failed:", err);
    await prisma.ticket.update({ where: { id: data.id }, data: { status: TicketStatus.open } });
    return;
  }

  let parsed: { action: string; reply?: string };
  try {
    parsed = JSON.parse(text.trim());
  } catch {
    await prisma.ticket.update({ where: { id: data.id }, data: { status: TicketStatus.open } });
    return;
  }

  if (parsed.action === "resolve" && parsed.reply) {
    await prisma.$transaction([
      prisma.reply.create({
        data: {
          ticketId: data.id,
          authorId: null,
          senderType: SenderType.agent,
          body: parsed.reply,
        },
      }),
      prisma.ticket.update({
        where: { id: data.id },
        data: { status: TicketStatus.resolved },
      }),
    ]);
  } else {
    await prisma.ticket.update({ where: { id: data.id }, data: { status: TicketStatus.open } });
  }
}

export async function autoResolveTicketWorker([job]: Job<AutoResolveJobData>[]) {
  await runAutoResolve(job.data);
}
