import { randomUUID } from "node:crypto";
import { TicketStatus } from "@helpdesk/core";
import * as Sentry from "@sentry/node";
import type { Job } from "pg-boss";
import { logger } from "./logger";
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
    logger.info(
      { closedCount: result.count, ageHours: AUTO_CLOSE_AGE_HOURS },
      "auto-close-tickets: closed resolved tickets older than threshold",
    );
  }
  return { closedCount: result.count };
}

export async function autoCloseTicketsWorker(_jobs: Job<unknown>[]) {
  const log = logger.child({ reqId: randomUUID(), job: AUTO_CLOSE_TICKETS_QUEUE });
  try {
    await runAutoCloseTickets();
  } catch (err) {
    log.error({ err }, "auto-close-tickets failed");
    Sentry.captureException(err);
    throw err;
  }
}
