import * as Sentry from "@sentry/node";
import type { Job } from "pg-boss";
import { TicketStatus } from "@helpdesk/core";
import { prisma } from "./prisma";

export const AUTO_CLOSE_TICKETS_QUEUE = "auto-close-tickets";
export const AUTO_CLOSE_AGE_HOURS = 96;
export const AUTO_CLOSE_CRON = "*/15 * * * *";

export async function runAutoCloseTickets(): Promise<{ closedCount: number }> {
  const cutoff = new Date(Date.now() - AUTO_CLOSE_AGE_HOURS * 60 * 60 * 1000);
  const now = new Date();

  const result = await prisma.ticket.updateMany({
    where: {
      status: TicketStatus.resolved,
      resolvedAt: { not: null, lt: cutoff },
    },
    data: { status: TicketStatus.closed, closedAt: now },
  });

  if (result.count > 0) {
    console.log(`auto-close-tickets: closed ${result.count} resolved ticket(s) older than ${AUTO_CLOSE_AGE_HOURS}h`);
  }
  return { closedCount: result.count };
}

export async function autoCloseTicketsWorker(_jobs: Job<unknown>[]) {
  try {
    await runAutoCloseTickets();
  } catch (err) {
    console.error("auto-close-tickets failed:", err);
    Sentry.captureException(err);
    throw err;
  }
}
