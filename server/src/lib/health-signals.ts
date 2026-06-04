import {
  AuditEventType,
  type HealthSignal,
  type HealthSignalId,
  type HealthSignalsResponse,
} from "@helpdesk/core";
import { prisma as defaultPrisma } from "./prisma";

// Activity-page health signals (Watchlist). Computes five operational-health
// metrics from the audit stream over a trailing 7-day window, plus a 10-point
// weekly trend (the last point is the current week). Volume is small, so we
// load ~10 weeks of events/tickets once and bucket in memory.

const WINDOW_DAYS = 7;
const WEEK_MS = WINDOW_DAYS * 24 * 60 * 60 * 1000;
const WEEKS = 10;
const REOPEN_WINDOW_MS = 24 * 60 * 60 * 1000;

// A denominator below this is too small to read as a rate — render muted and
// suppress the alarming copy rather than flashing a false alert.
export const MIN_SAMPLE = 10;

// `ai_escalated` reasons that are system faults (pipeline health), not a
// knowledge-base content gap. Mirrors `escalateToOpen` in auto-resolve-ticket.ts.
export const HARD_FAILURE_REASONS = new Set(["ai_call_failed", "json_parse_failure"]);

// Alert/watch cutoffs per signal — research-grounded placeholders (see README;
// v2 could make these admin-configurable). Percent signals: `ok < watch`,
// `watch ≤ value ≤ alert`, `alert < value`. The `ai-failures` count signal uses
// inclusive alert (`value ≥ alert`).
export const THRESHOLDS: Record<HealthSignalId, { watch: number; alert: number }> = {
  "ai-escalation": { watch: 35, alert: 50 },
  reassignment: { watch: 8, alert: 15 },
  reopened: { watch: 5, alert: 10 },
  priority: { watch: 15, alert: 25 },
  "ai-failures": { watch: 1, alert: 5 },
};

type State = HealthSignal["state"];

function classify(
  value: number,
  id: HealthSignalId,
  lowSample: boolean,
  alertInclusive: boolean,
): State {
  if (lowSample) return "ok";
  const { watch, alert } = THRESHOLDS[id];
  if (alertInclusive ? value >= alert : value > alert) return "alert";
  if (value >= watch) return "watch";
  return "ok";
}

type EventRow = {
  ticketId: number;
  type: AuditEventType;
  data: unknown;
  createdAt: Date;
};
type TicketRow = { id: number; createdAt: Date; resolvedAt: Date | null };

const emptyCounts = () => Array.from({ length: WEEKS }, () => 0);
const emptySets = () => Array.from({ length: WEEKS }, () => new Set<number>());
const pct = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 100) : 0);

export async function computeHealthSignals(
  db: typeof defaultPrisma = defaultPrisma,
  now: number = Date.now(),
): Promise<HealthSignalsResponse> {
  const since = new Date(now - WEEKS * WEEK_MS);

  const [events, tickets] = await Promise.all([
    db.auditEvent.findMany({
      where: {
        createdAt: { gte: since },
        type: {
          in: [
            AuditEventType.ai_escalated,
            AuditEventType.auto_resolved,
            AuditEventType.assignee_changed,
            AuditEventType.priority_changed,
            AuditEventType.auto_reopened,
          ],
        },
      },
      select: { ticketId: true, type: true, data: true, createdAt: true },
    }),
    db.ticket.findMany({
      where: {
        OR: [{ createdAt: { gte: since } }, { resolvedAt: { gte: since } }],
      },
      select: { id: true, createdAt: true, resolvedAt: true },
    }),
  ]);

  // Bucket index 0..9 oldest→newest; bucket 9 is the current 7-day window.
  // Returns -1 for timestamps outside the 10-week window.
  const weekIndex = (date: Date): number => {
    const age = now - date.getTime();
    if (age < 0 || age >= WEEKS * WEEK_MS) return -1;
    return WEEKS - 1 - Math.floor(age / WEEK_MS);
  };

  // ── Event-based signals (ai-escalation, ai-failures) ──
  const escalatedTickets = emptySets(); // distinct tickets with an escalation
  const handledTickets = emptySets(); // distinct AI-handled tickets (escalate|resolve)
  const escalationsCount = emptyCounts();
  const hardFailures = emptyCounts();

  // ── Per-ticket aggregates from all loaded events ──
  const assignmentsByTicket = new Map<number, number>(); // assignee_changed → non-null assignee
  const priorityChangedTickets = new Set<number>();
  const reopenTimesByTicket = new Map<number, number[]>();

  for (const e of events) {
    const data = (e.data ?? {}) as Record<string, unknown>;
    if (e.type === AuditEventType.ai_escalated) {
      const wi = weekIndex(e.createdAt);
      if (wi >= 0) {
        escalatedTickets[wi].add(e.ticketId);
        handledTickets[wi].add(e.ticketId);
        escalationsCount[wi]++;
        if (typeof data.reason === "string" && HARD_FAILURE_REASONS.has(data.reason)) {
          hardFailures[wi]++;
        }
      }
    } else if (e.type === AuditEventType.auto_resolved) {
      const wi = weekIndex(e.createdAt);
      if (wi >= 0) handledTickets[wi].add(e.ticketId);
    } else if (e.type === AuditEventType.assignee_changed) {
      if (data.to != null) {
        assignmentsByTicket.set(
          e.ticketId,
          (assignmentsByTicket.get(e.ticketId) ?? 0) + 1,
        );
      }
    } else if (e.type === AuditEventType.priority_changed) {
      priorityChangedTickets.add(e.ticketId);
    } else if (e.type === AuditEventType.auto_reopened) {
      const arr = reopenTimesByTicket.get(e.ticketId) ?? [];
      arr.push(e.createdAt.getTime());
      reopenTimesByTicket.set(e.ticketId, arr);
    }
  }

  // ── Ticket-based signals (reassignment, priority by createdAt; reopened by resolvedAt) ──
  const churnNum = emptyCounts();
  const churnDen = emptyCounts();
  const churnAssignTotal = emptyCounts();
  const priorityNum = emptyCounts();
  const priorityDen = emptyCounts();
  const reopenedNum = emptyCounts();
  const reopenedDen = emptyCounts();

  for (const t of tickets) {
    const ci = weekIndex(t.createdAt);
    if (ci >= 0) {
      const assigns = assignmentsByTicket.get(t.id) ?? 0;
      churnDen[ci]++;
      churnAssignTotal[ci] += assigns;
      if (assigns >= 2) churnNum[ci]++;

      priorityDen[ci]++;
      if (priorityChangedTickets.has(t.id)) priorityNum[ci]++;
    }
    if (t.resolvedAt) {
      const ri = weekIndex(t.resolvedAt);
      if (ri >= 0) {
        reopenedDen[ri]++;
        const resolvedMs = t.resolvedAt.getTime();
        const reopens = reopenTimesByTicket.get(t.id) ?? [];
        if (reopens.some((r) => r >= resolvedMs && r - resolvedMs <= REOPEN_WINDOW_MS)) {
          reopenedNum[ri]++;
        }
      }
    }
  }

  // ── Assemble a signal from its 10-week numerator/denominator arrays ──
  const last = WEEKS - 1;
  const percentSignal = (
    id: HealthSignalId,
    num: number[],
    den: number[],
    avgHandoffs: number | null = null,
  ): HealthSignal => {
    const spark = num.map((n, i) => pct(n, den[i]));
    const lowSample = den[last] < MIN_SAMPLE;
    return {
      id,
      value: spark[last],
      numerator: num[last],
      denominator: den[last],
      state: classify(spark[last], id, lowSample, false),
      delta: spark[last] - spark[last - 1],
      spark,
      lowSample,
      avgHandoffs,
    };
  };

  const avgHandoffs =
    churnDen[last] > 0
      ? Math.round((churnAssignTotal[last] / churnDen[last]) * 10) / 10
      : null;

  const aiFailures: HealthSignal = {
    id: "ai-failures",
    value: hardFailures[last],
    numerator: hardFailures[last],
    denominator: escalationsCount[last],
    state: classify(hardFailures[last], "ai-failures", false, true),
    delta: hardFailures[last] - hardFailures[last - 1],
    spark: hardFailures,
    lowSample: false,
    avgHandoffs: null,
  };

  const signals: HealthSignal[] = [
    percentSignal(
      "ai-escalation",
      escalatedTickets.map((s) => s.size),
      handledTickets.map((s) => s.size),
    ),
    aiFailures,
    percentSignal("reassignment", churnNum, churnDen, avgHandoffs),
    percentSignal("reopened", reopenedNum, reopenedDen),
    percentSignal("priority", priorityNum, priorityDen),
  ];

  return { signals, windowDays: WINDOW_DAYS };
}
