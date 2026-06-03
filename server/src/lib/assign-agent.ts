import { AutoAssignMode, Role, TicketStatus, UserStatus } from "@helpdesk/core";
import type { Prisma } from "../generated/prisma/client";
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
