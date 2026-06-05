import { randomUUID } from "node:crypto";
import { NotificationType, Role, SlaMetric, TicketStatus } from "@helpdesk/core";
import * as Sentry from "@sentry/node";
import type { Job } from "pg-boss";
import { isAiAssigned } from "./ai-user";
import { logger } from "./logger";
import { prisma } from "./prisma";

export const SLA_BREACH_CHECK_QUEUE = "sla-breach-check";
export const SLA_BREACH_CHECK_CRON = "*/5 * * * *";

// Map keyed by the raw priority string to sidestep the nominal mismatch
// between core's TS string-enum `TicketPriority` and Prisma's generated
// union of string literals — values are identical at runtime.
type Policy = {
  firstResponseMinutes: number | null;
  resolutionMinutes: number | null;
};

type CandidateTicket = {
  id: number;
  priority: string;
  createdAt: Date;
  firstAgentReplyAt: Date | null;
  assignedToId: string | null;
};

function isBreached(
  metric: SlaMetric,
  ticket: CandidateTicket,
  policy: Policy,
  now: Date,
): { breached: true; policyMinutes: number } | { breached: false } {
  const minutes =
    metric === SlaMetric.first_response
      ? policy.firstResponseMinutes
      : policy.resolutionMinutes;
  if (minutes == null) return { breached: false };

  // First-response clock stops as soon as an agent replies.
  if (metric === SlaMetric.first_response && ticket.firstAgentReplyAt != null) {
    return { breached: false };
  }

  const elapsedMinutes = (now.getTime() - ticket.createdAt.getTime()) / 60_000;
  if (elapsedMinutes <= minutes) return { breached: false };
  return { breached: true, policyMinutes: minutes };
}

async function resolveRecipientIds(ticket: CandidateTicket): Promise<string[]> {
  if (ticket.assignedToId && !isAiAssigned(ticket.assignedToId)) {
    const assignee = await prisma.user.findUnique({
      where: { id: ticket.assignedToId },
      select: { id: true, deletedAt: true },
    });
    if (assignee && assignee.deletedAt == null) return [assignee.id];
  }
  // Breaches fan out to everyone with admin access — both admins and the global
  // admin (the owner shouldn't go dark on breaches after being promoted).
  const admins = await prisma.user.findMany({
    where: { role: { in: [Role.admin, Role.globalAdmin] }, deletedAt: null },
    select: { id: true },
  });
  return admins.map((a) => a.id);
}

export async function runSlaBreachCheck(): Promise<{ notified: number }> {
  const now = new Date();

  const policyRows = await prisma.slaPolicy.findMany();
  if (policyRows.length === 0) return { notified: 0 };
  const policies = new Map<string, Policy>(
    policyRows.map((p) => [
      p.priority,
      {
        firstResponseMinutes: p.firstResponseMinutes,
        resolutionMinutes: p.resolutionMinutes,
      },
    ]),
  );

  const tickets = await prisma.ticket.findMany({
    // `open` only — triaging tickets (new/processing) have no finalized
    // priority yet, so SLA targets don't apply (see computeSlaState). Notifying
    // on them would fire breaches on the default `normal` policy before a human
    // can act.
    where: { status: TicketStatus.open },
    select: {
      id: true,
      priority: true,
      createdAt: true,
      firstAgentReplyAt: true,
      assignedToId: true,
    },
  });

  let notified = 0;

  for (const ticket of tickets) {
    const policy = policies.get(ticket.priority);
    if (!policy) continue;

    for (const metric of [SlaMetric.first_response, SlaMetric.resolution]) {
      const result = isBreached(metric, ticket, policy, now);
      if (!result.breached) continue;

      const existing = await prisma.notification.findFirst({
        where: {
          ticketId: ticket.id,
          type: NotificationType.sla_breach_warning,
          data: { path: ["metric"], equals: metric },
        },
        select: { id: true },
      });
      if (existing) continue;

      const recipientIds = await resolveRecipientIds(ticket);
      if (recipientIds.length === 0) continue;

      const data = {
        metric,
        policyMinutes: result.policyMinutes,
        breachedAt: now.toISOString(),
      };
      await prisma.notification.createMany({
        data: recipientIds.map((userId) => ({
          userId,
          type: NotificationType.sla_breach_warning,
          ticketId: ticket.id,
          data,
        })),
      });
      notified += recipientIds.length;
    }
  }

  if (notified > 0) {
    logger.info(
      { notifiedCount: notified, candidateCount: tickets.length },
      "sla-breach-check: created breach notifications",
    );
  }
  return { notified };
}

export async function slaBreachCheckWorker(_jobs: Job<unknown>[]) {
  const log = logger.child({ reqId: randomUUID(), job: SLA_BREACH_CHECK_QUEUE });
  try {
    await runSlaBreachCheck();
  } catch (err) {
    log.error({ err }, "sla-breach-check failed");
    Sentry.captureException(err);
    throw err;
  }
}
