import {
  AuditEventType,
  AutoAssignMode,
  NotificationType,
  Role,
  TicketStatus,
  UserStatus,
} from "@helpdesk/core";
import type { Prisma } from "../generated/prisma/client";
import { recordAuditEvent } from "./audit";
import { WORKFLOW_SETTINGS_ID, type WorkflowSettingsRow } from "./workflow-settings";

const AI_USER_EMAIL = "ai@helpdesk.internal";

// Chooses a human agent to auto-assign a ticket leaving triage, per the
// `autoAssignMode` strategy. Only ACTIVE human agents are eligible — never the
// AI user, and never invited/inactive accounts (they can't act on tickets).
// Returns null when there's no eligible agent (caller leaves the ticket
// unassigned). Must run inside a transaction because round-robin advances a
// persisted cursor on the settings row.
export async function pickAssignee(
  tx: Prisma.TransactionClient,
  settings: WorkflowSettingsRow,
): Promise<string | null> {
  const agents = await tx.user.findMany({
    where: {
      role: Role.agent,
      deletedAt: null,
      status: UserStatus.active,
      NOT: { email: AI_USER_EMAIL },
    },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  if (agents.length === 0) return null;

  if (settings.autoAssignMode === AutoAssignMode.least_loaded) {
    const counts = await tx.ticket.groupBy({
      by: ["assignedToId"],
      where: {
        status: TicketStatus.open,
        assignedToId: { in: agents.map((a) => a.id) },
      },
      _count: { _all: true },
    });
    const load = new Map(counts.map((c) => [c.assignedToId, c._count._all]));
    // Iterate in createdAt order, replacing only on a strictly-smaller load, so
    // the earliest-created agent wins ties — deterministic and testable.
    let best = agents[0].id;
    let bestLoad = load.get(best) ?? 0;
    for (const a of agents) {
      const l = load.get(a.id) ?? 0;
      if (l < bestLoad) {
        best = a.id;
        bestLoad = l;
      }
    }
    return best;
  }

  // round_robin: pick at the cursor, then advance it (modulo the live agent
  // set, which can grow/shrink between assignments).
  const chosen = agents[settings.roundRobinCursor % agents.length].id;
  const nextCursor = settings.roundRobinCursor + 1;
  await tx.workflowSettings.upsert({
    where: { id: WORKFLOW_SETTINGS_ID },
    create: { id: WORKFLOW_SETTINGS_ID, roundRobinCursor: nextCursor },
    update: { roundRobinCursor: nextCursor },
  });
  return chosen;
}

// Backfills every open, unassigned ticket onto an active agent using the current
// auto-assign strategy. Invoked when an admin saves the Workflow screen with
// auto-assign enabled, so the *existing* queue obeys the rule too — not only the
// tickets that exit triage afterward. Each assignment mirrors a manual one
// (assignee_changed audit + ticket_assigned notification) with the admin as
// actor, and shares the same persisted round-robin cursor as triage-exit
// assignment so the two stay fair. Returns how many tickets were assigned.
// Must run inside a transaction: round-robin advances the settings cursor, and
// least-loaded re-reads live load as tickets are assigned within the same tx.
export async function assignUnassignedTickets(
  tx: Prisma.TransactionClient,
  settings: WorkflowSettingsRow,
  actorId: string,
): Promise<number> {
  const unassigned = await tx.ticket.findMany({
    where: { status: TicketStatus.open, assignedToId: null },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });

  // pickAssignee reads the round-robin cursor off the passed settings object;
  // advance a local copy each pick so successive tickets don't all land on the
  // same agent (the DB cursor is advanced by pickAssignee in lockstep).
  // least-loaded ignores the cursor and self-balances off live in-tx load.
  let cursor = settings.roundRobinCursor;
  let assigned = 0;
  for (const ticket of unassigned) {
    const agentId = await pickAssignee(tx, { ...settings, roundRobinCursor: cursor });
    if (!agentId) break; // no eligible agent — leave the remainder unassigned
    cursor += 1;
    await tx.ticket.update({
      where: { id: ticket.id },
      data: { assignedToId: agentId },
    });
    await recordAuditEvent(tx, {
      ticketId: ticket.id,
      actorId,
      type: AuditEventType.assignee_changed,
      data: { from: null, to: agentId, autoAssigned: true },
    });
    await tx.notification.create({
      data: {
        userId: agentId,
        actorId,
        type: NotificationType.ticket_assigned,
        ticketId: ticket.id,
      },
    });
    assigned += 1;
  }
  return assigned;
}
