import { randomUUID } from "node:crypto";
import { AuditEventType, TicketStatus } from "@helpdesk/core";
import * as Sentry from "@sentry/node";
import type { Job } from "pg-boss";
import { recordAuditEvent } from "./audit";
import { logger } from "./logger";
import { prisma } from "./prisma";

export const AUTO_CLOSE_TICKETS_QUEUE = "auto-close-tickets";
export const AUTO_CLOSE_AGE_HOURS = 96;
export const AUTO_CLOSE_CRON = "*/15 * * * *";

export async function runAutoCloseTickets(): Promise<{ closedCount: number }> {
  const cutoff = new Date(Date.now() - AUTO_CLOSE_AGE_HOURS * 60 * 60 * 1000);
  const now = new Date();

  // Per-ticket transactions so each closed ticket gets its own auto_closed
  // audit event committed atomically with the status flip. Bulk updateMany
  // would let us skip the loop, but we'd lose per-ticket audit granularity.
  const ticketsToClose = await prisma.ticket.findMany({
    where: {
      status: TicketStatus.resolved,
      resolvedAt: { not: null, lt: cutoff },
    },
    select: { id: true },
  });

  for (const { id } of ticketsToClose) {
    await prisma.$transaction(async (tx) => {
      await tx.ticket.update({
        where: { id },
        data: { status: TicketStatus.closed, closedAt: now },
      });
      await recordAuditEvent(tx, {
        ticketId: id,
        actorId: null,
        type: AuditEventType.auto_closed,
      });
    });
  }

  if (ticketsToClose.length > 0) {
    logger.info(
      { closedCount: ticketsToClose.length, ageHours: AUTO_CLOSE_AGE_HOURS },
      "auto-close-tickets: closed resolved tickets older than threshold",
    );
  }
  return { closedCount: ticketsToClose.length };
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
