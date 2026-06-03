import { randomUUID } from "node:crypto";
import { AuditEventType, TicketStatus } from "@helpdesk/core";
import * as Sentry from "@sentry/node";
import type { Job } from "pg-boss";
import { recordAuditEvent } from "./audit";
import { logger } from "./logger";
import { prisma } from "./prisma";
import { getWorkflowSettings } from "./workflow-settings";

export const AUTO_CLOSE_TICKETS_QUEUE = "auto-close-tickets";
export const AUTO_CLOSE_CRON = "*/15 * * * *";

export async function runAutoCloseTickets(): Promise<{ closedCount: number }> {
  const settings = await getWorkflowSettings();
  // Auto-close is a workflow rule: when off, resolved tickets stay resolved
  // until an admin closes them manually.
  if (!settings.autoCloseOn) {
    logger.info("auto-close-tickets: disabled by workflow settings — skipping");
    return { closedCount: 0 };
  }
  const cutoff = new Date(Date.now() - settings.autoCloseDays * 24 * 60 * 60 * 1000);
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
      { closedCount: ticketsToClose.length, ageDays: settings.autoCloseDays },
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
