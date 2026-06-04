import {
  AuditEventType,
  type HealthSignal,
  type HealthSignalId,
  TicketCategory,
} from "@helpdesk/core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { computeHealthSignals } from "./health-signals";
import { prisma } from "./prisma";

// Fixed "now" far from any other suite's seed data, so the 70-day window
// isolates exactly the rows this test creates (real test data sits in ~2026,
// >70 days before this NOW, and is excluded).
const NOW = new Date("2030-06-15T12:00:00Z").getTime();
const DAY = 24 * 60 * 60 * 1000;
const cw = new Date(NOW - 2 * DAY); // a moment inside the current 7-day window
const outside = new Date(NOW - 80 * DAY); // older than the 10-week window for createdAt

const ticketIds: number[] = [];

async function makeTicket(
  createdAt: Date,
  resolvedAt: Date | null = null,
): Promise<number> {
  const t = await prisma.ticket.create({
    data: {
      fromName: "HS Test",
      fromEmail: "hs-test@example.com",
      subject: "health-signals test",
      body: "body",
      // Set a category so these long-lived rows don't surface as a null-category
      // row in the parallel /stats/categories test (shared test DB).
      category: TicketCategory.general_question,
      createdAt,
      ...(resolvedAt ? { resolvedAt } : {}),
    },
  });
  ticketIds.push(t.id);
  return t.id;
}

function event(ticketId: number, type: AuditEventType, createdAt: Date, data?: object) {
  return prisma.auditEvent.create({ data: { ticketId, type, createdAt, data } });
}

function byId(signals: HealthSignal[], id: HealthSignalId): HealthSignal {
  const s = signals.find((x) => x.id === id);
  if (!s) throw new Error(`missing signal ${id}`);
  return s;
}

let signals: HealthSignal[];

beforeAll(async () => {
  // 12 tickets created this week — the createdAt-bucketed base (priority, churn).
  const p: number[] = [];
  for (let i = 0; i < 12; i++) p.push(await makeTicket(cw));
  // 4 of them had their priority re-graded after intake.
  for (let i = 0; i < 4; i++)
    await event(p[i], AuditEventType.priority_changed, cw, { to: "high" });
  // 1 of them bounced between agents (≥2 assignments to a real owner).
  await event(p[0], AuditEventType.assignee_changed, cw, { to: "agent-a" });
  await event(p[0], AuditEventType.assignee_changed, cw, { to: "agent-b" });

  // AI-handled tickets (event-bucketed): 2 escalated, 1 auto-resolved → 67%.
  const tA = await makeTicket(outside);
  const tB = await makeTicket(outside);
  const tC = await makeTicket(outside);
  await event(tA, AuditEventType.ai_escalated, cw, { reason: "json_parse_failure" }); // hard failure
  await event(tB, AuditEventType.ai_escalated, cw, { reason: "ai_chose_escalate" });
  await event(tC, AuditEventType.auto_resolved, cw, {});

  // An out-of-window hard failure must NOT inflate the current week.
  const tOld = await makeTicket(outside);
  await event(tOld, AuditEventType.ai_escalated, outside, { reason: "ai_call_failed" });

  // Resolved-this-week tickets (resolvedAt-bucketed): 1 reopened in 24h, 1 after
  // 24h (excluded), 1 not reopened → 1 of 3.
  const tD = await makeTicket(outside, cw);
  const tE = await makeTicket(outside, cw);
  const tF = await makeTicket(outside, cw);
  await event(
    tD,
    AuditEventType.auto_reopened,
    new Date(cw.getTime() + 3 * 60 * 60 * 1000),
  );
  await event(
    tF,
    AuditEventType.auto_reopened,
    new Date(cw.getTime() + 30 * 60 * 60 * 1000),
  );
  void tE;

  signals = (await computeHealthSignals(prisma, NOW)).signals;
});

afterAll(async () => {
  // AuditEvents cascade on ticket delete.
  await prisma.ticket.deleteMany({ where: { id: { in: ticketIds } } });
});

describe("computeHealthSignals", () => {
  it("returns all five signals with a 10-point weekly spark", () => {
    expect(signals).toHaveLength(5);
    for (const s of signals) expect(s.spark).toHaveLength(10);
  });

  it("computes AI escalation rate from AI-handled tickets", () => {
    const s = byId(signals, "ai-escalation");
    expect(s.numerator).toBe(2); // 2 escalated tickets
    expect(s.denominator).toBe(3); // 3 AI-handled (2 escalated + 1 resolved)
    expect(s.value).toBe(67);
    expect(s.spark[9]).toBe(67); // last point = current week
    expect(s.lowSample).toBe(true); // <10 → muted to ok
    expect(s.state).toBe("ok");
  });

  it("counts only system-fault reasons as hard failures, ignoring old events", () => {
    const s = byId(signals, "ai-failures");
    expect(s.value).toBe(1); // only the in-window json_parse_failure
    expect(s.denominator).toBe(2); // of 2 in-window escalations
  });

  it("classifies priority re-triage above threshold once the sample is large enough", () => {
    const s = byId(signals, "priority");
    expect(s.numerator).toBe(4);
    expect(s.denominator).toBe(12);
    expect(s.value).toBe(33); // 4/12
    expect(s.lowSample).toBe(false);
    expect(s.state).toBe("alert"); // >25
  });

  it("flags reassignment churn (≥2 handoffs) and reports avg handoffs", () => {
    const s = byId(signals, "reassignment");
    expect(s.numerator).toBe(1); // 1 of 12 tickets bounced ≥2×
    expect(s.denominator).toBe(12);
    expect(s.value).toBe(8); // 1/12 → 8%
    expect(s.state).toBe("watch"); // 8–15
    expect(s.avgHandoffs).toBe(0.2); // 2 assignments / 12 tickets
  });

  it("counts only reopens within 24h of resolution", () => {
    const s = byId(signals, "reopened");
    expect(s.numerator).toBe(1); // 3h reopen counts; 30h does not
    expect(s.denominator).toBe(3);
    expect(s.value).toBe(33);
  });
});
