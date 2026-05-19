import { SlaMetric, type TicketPriority, TicketStatus } from "./types";

// computeSlaState only needs the two per-metric targets — typing the param
// narrowly keeps server callers from having to fake `priority`/`updatedAt`
// when constructing a policy lookup.
export type SlaTarget = {
  firstResponseMinutes: number | null;
  resolutionMinutes: number | null;
};

// SLA badge: 'ok' renders nothing (no chrome on healthy tickets); 'at_risk'
// fires at >=75% of the target window elapsed (purely visual, no server
// notification); 'breached' once the window has elapsed.
export type SlaState = "ok" | "at_risk" | "breached";

export const AT_RISK_THRESHOLD = 0.75;

export type SlaComputation =
  | { state: "ok" }
  | { state: "at_risk" | "breached"; metric: SlaMetric; dueAt: Date };

export type TicketForSla = {
  createdAt: string;
  firstAgentReplyAt: string | null;
  resolvedAt: string | null;
  priority: TicketPriority;
  status: TicketStatus;
};

// Returns the more severe of the two per-metric breach states. Tickets that
// have been resolved/closed never carry an SLA badge — done is done. The
// policy may have a null target for a given metric (e.g. low priority has no
// resolution target), in which case that metric is skipped entirely.
export function computeSlaState(
  ticket: TicketForSla,
  policy: SlaTarget | undefined,
): SlaComputation {
  if (!policy) return { state: "ok" };
  if (ticket.status === TicketStatus.resolved) return { state: "ok" };
  if (ticket.status === TicketStatus.closed) return { state: "ok" };
  if (ticket.resolvedAt != null) return { state: "ok" };

  const now = Date.now();
  const created = new Date(ticket.createdAt).getTime();

  function evaluate(
    minutes: number | null,
    metric: SlaMetric,
    alreadySatisfied: boolean,
  ): SlaComputation | null {
    if (minutes == null || alreadySatisfied) return null;
    const dueMs = created + minutes * 60_000;
    if (now >= dueMs) {
      return { state: "breached", metric, dueAt: new Date(dueMs) };
    }
    const elapsed = now - created;
    if (elapsed >= minutes * 60_000 * AT_RISK_THRESHOLD) {
      return { state: "at_risk", metric, dueAt: new Date(dueMs) };
    }
    return null;
  }

  const fr = evaluate(
    policy.firstResponseMinutes,
    SlaMetric.first_response,
    ticket.firstAgentReplyAt != null,
  );
  const res = evaluate(policy.resolutionMinutes, SlaMetric.resolution, false);
  const candidates = [fr, res].filter((c): c is SlaComputation => c !== null);
  if (candidates.length === 0) return { state: "ok" };
  // Breached > at_risk; tie-broken by earliest dueAt.
  candidates.sort((a, b) => {
    const aBreached = a.state === "breached" ? 1 : 0;
    const bBreached = b.state === "breached" ? 1 : 0;
    if (aBreached !== bBreached) return bBreached - aBreached;
    // Both have dueAt at this point (only "ok" lacks it, and we filtered).
    const aDue = "dueAt" in a ? a.dueAt.getTime() : Number.POSITIVE_INFINITY;
    const bDue = "dueAt" in b ? b.dueAt.getTime() : Number.POSITIVE_INFINITY;
    return aDue - bDue;
  });
  return candidates[0];
}
