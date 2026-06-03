import { SenderType, TicketStatus } from "@helpdesk/core";
import { generateId } from "better-auth";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { initAiUserId } from "./ai-user";
import { prisma } from "./prisma";
import { WORKFLOW_SETTINGS_DEFAULTS, WORKFLOW_SETTINGS_ID } from "./workflow-settings";

// Baseline that lets the "happy path" mock (action=resolve, no confidence → 50)
// auto-resolve: low threshold, gates off. Individual tests for the gates/
// threshold/auto-assign live in workflow-settings.test.ts and below.
async function setWorkflowSettings(overrides: Record<string, unknown> = {}) {
  const base = {
    autoResolveOn: true,
    autoResolveThreshold: 50,
    requireCategory: false,
    requireAssignee: false,
    autoAssignOn: false,
  };
  await prisma.workflowSettings.upsert({
    where: { id: WORKFLOW_SETTINGS_ID },
    create: {
      id: WORKFLOW_SETTINGS_ID,
      ...WORKFLOW_SETTINGS_DEFAULTS,
      ...base,
      ...overrides,
    },
    update: { ...base, ...overrides },
  });
}

const generateTextMock = vi.fn();
vi.mock("ai", async () => {
  const actual = await vi.importActual<typeof import("ai")>("ai");
  return {
    generateText: (...args: unknown[]) => generateTextMock(...args),
    Output: actual.Output,
  };
});
vi.mock("@ai-sdk/google", () => ({
  google: () => "mock-model",
}));
vi.mock("./boss", () => ({
  default: { send: vi.fn().mockResolvedValue("mock-job-id") },
}));

const { autoResolveTicketWorker } = await import("./auto-resolve-ticket");

describe("auto-resolve-ticket worker", () => {
  const createdIds: number[] = [];
  let aiUserId: string;

  beforeAll(async () => {
    const id = generateId();
    const now = new Date();
    await prisma.user.upsert({
      where: { email: "ai@helpdesk.internal" },
      update: {},
      create: {
        id,
        name: "AI",
        email: "ai@helpdesk.internal",
        emailVerified: true,
        role: "agent",
        createdAt: now,
        updatedAt: now,
      },
    });
    const aiUser = await prisma.user.findUnique({
      where: { email: "ai@helpdesk.internal" },
    });
    aiUserId = aiUser!.id;
    await initAiUserId();
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: "ai@helpdesk.internal" } });
    // Restore defaults so later suites reading the singleton see them.
    await prisma.workflowSettings.upsert({
      where: { id: WORKFLOW_SETTINGS_ID },
      create: { id: WORKFLOW_SETTINGS_ID, ...WORKFLOW_SETTINGS_DEFAULTS },
      update: { ...WORKFLOW_SETTINGS_DEFAULTS },
    });
  });

  beforeEach(async () => {
    generateTextMock.mockReset();
    await setWorkflowSettings();
  });

  afterEach(async () => {
    if (createdIds.length > 0) {
      // Cascade deletes audit_event + reply rows
      await prisma.ticket.deleteMany({ where: { id: { in: createdIds } } });
      createdIds.length = 0;
    }
  });

  async function seedTicket() {
    const ticket = await prisma.ticket.create({
      data: {
        fromName: "Auto Resolve Test",
        fromEmail: "auto-resolve@example.com",
        subject: "Test subject",
        body: "Test body",
        status: TicketStatus.new,
      },
    });
    createdIds.push(ticket.id);
    return ticket;
  }

  function jobFor(ticket: {
    id: number;
    fromName: string;
    subject: string;
    body: string;
  }) {
    return [
      {
        data: {
          id: ticket.id,
          fromName: ticket.fromName,
          subject: ticket.subject,
          body: ticket.body,
        },
      } as never,
    ];
  }

  it("records an auto_resolved event linking to the AI reply on success", async () => {
    const ticket = await seedTicket();
    generateTextMock.mockResolvedValue({
      text: JSON.stringify({ action: "resolve", reply: "Here is your answer." }),
    });

    await autoResolveTicketWorker(jobFor(ticket));

    const refreshed = await prisma.ticket.findUnique({
      where: { id: ticket.id },
      select: { status: true, lastReplySenderType: true },
    });
    expect(refreshed!.status).toBe(TicketStatus.resolved);
    expect(refreshed!.lastReplySenderType).toBe(SenderType.agent);

    const reply = await prisma.reply.findFirst({
      where: { ticketId: ticket.id },
      select: { id: true, authorId: true, body: true },
    });
    expect(reply).not.toBeNull();
    expect(reply!.authorId).toBe(aiUserId);
    expect(reply!.body).toBe("Here is your answer.");

    const events = await prisma.auditEvent.findMany({ where: { ticketId: ticket.id } });
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("auto_resolved");
    expect(events[0].actorId).toBe(aiUserId);
    expect(events[0].data).toEqual({ replyId: reply!.id });
  });

  it("records an ai_escalated event with reason=ai_chose_escalate when the AI declines", async () => {
    const ticket = await seedTicket();
    generateTextMock.mockResolvedValue({
      text: JSON.stringify({ action: "escalate" }),
    });

    await autoResolveTicketWorker(jobFor(ticket));

    const refreshed = await prisma.ticket.findUnique({
      where: { id: ticket.id },
      select: { status: true, assignedToId: true },
    });
    expect(refreshed!.status).toBe(TicketStatus.open);
    expect(refreshed!.assignedToId).toBeNull();

    const events = await prisma.auditEvent.findMany({ where: { ticketId: ticket.id } });
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("ai_escalated");
    expect(events[0].actorId).toBe(aiUserId);
    expect(events[0].data).toEqual({ reason: "ai_chose_escalate" });
  });

  it("records an ai_escalated event with reason=ai_call_failed when generateText throws", async () => {
    const ticket = await seedTicket();
    generateTextMock.mockRejectedValue(new Error("Gemini timeout"));

    await autoResolveTicketWorker(jobFor(ticket));

    const refreshed = await prisma.ticket.findUnique({
      where: { id: ticket.id },
      select: { status: true, assignedToId: true },
    });
    expect(refreshed!.status).toBe(TicketStatus.open);
    expect(refreshed!.assignedToId).toBeNull();

    const events = await prisma.auditEvent.findMany({ where: { ticketId: ticket.id } });
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("ai_escalated");
    expect(events[0].data).toEqual({ reason: "ai_call_failed" });
  });

  it("records an ai_escalated event with reason=json_parse_failure when the AI returns invalid JSON", async () => {
    const ticket = await seedTicket();
    generateTextMock.mockResolvedValue({ text: "not json at all {" });

    await autoResolveTicketWorker(jobFor(ticket));

    const refreshed = await prisma.ticket.findUnique({
      where: { id: ticket.id },
      select: { status: true, assignedToId: true },
    });
    expect(refreshed!.status).toBe(TicketStatus.open);
    expect(refreshed!.assignedToId).toBeNull();

    const events = await prisma.auditEvent.findMany({ where: { ticketId: ticket.id } });
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("ai_escalated");
    expect(events[0].data).toEqual({ reason: "json_parse_failure" });
  });

  it("escalates (below_confidence_threshold) when confidence is under the threshold", async () => {
    await setWorkflowSettings({ autoResolveThreshold: 85 });
    const ticket = await seedTicket();
    generateTextMock.mockResolvedValue({
      text: JSON.stringify({ action: "resolve", reply: "Answer", confidence: 70 }),
    });

    await autoResolveTicketWorker(jobFor(ticket));

    const refreshed = await prisma.ticket.findUnique({
      where: { id: ticket.id },
      select: { status: true },
    });
    expect(refreshed!.status).toBe(TicketStatus.open);
    const events = await prisma.auditEvent.findMany({ where: { ticketId: ticket.id } });
    expect(events).toHaveLength(1);
    expect(events[0].data).toEqual({ reason: "below_confidence_threshold" });
    // No reply was sent.
    expect(await prisma.reply.count({ where: { ticketId: ticket.id } })).toBe(0);
  });

  it("escalates (auto_resolve_disabled) and never sends when auto-resolve is off", async () => {
    await setWorkflowSettings({ autoResolveOn: false });
    const ticket = await seedTicket();
    generateTextMock.mockResolvedValue({
      text: JSON.stringify({ action: "resolve", reply: "Answer", confidence: 99 }),
    });

    await autoResolveTicketWorker(jobFor(ticket));

    const refreshed = await prisma.ticket.findUnique({
      where: { id: ticket.id },
      select: { status: true },
    });
    expect(refreshed!.status).toBe(TicketStatus.open);
    const events = await prisma.auditEvent.findMany({ where: { ticketId: ticket.id } });
    expect(events[0].data).toEqual({ reason: "auto_resolve_disabled" });
    expect(await prisma.reply.count({ where: { ticketId: ticket.id } })).toBe(0);
  });

  it("escalates (resolution_gate_category) when requireCategory is on and category is null", async () => {
    await setWorkflowSettings({ requireCategory: true, autoResolveThreshold: 50 });
    const ticket = await seedTicket(); // seeded with no category
    generateTextMock.mockResolvedValue({
      text: JSON.stringify({ action: "resolve", reply: "Answer", confidence: 95 }),
    });

    await autoResolveTicketWorker(jobFor(ticket));

    const refreshed = await prisma.ticket.findUnique({
      where: { id: ticket.id },
      select: { status: true },
    });
    expect(refreshed!.status).toBe(TicketStatus.open);
    const events = await prisma.auditEvent.findMany({ where: { ticketId: ticket.id } });
    expect(events[0].data).toEqual({ reason: "resolution_gate_category" });
  });

  it("auto-assigns the escalated ticket to an active agent when autoAssignOn is true", async () => {
    const agentId = generateId();
    const now = new Date();
    await prisma.user.create({
      data: {
        id: agentId,
        name: "RR Agent",
        email: "auto-assign-agent@example.com",
        emailVerified: true,
        role: "agent",
        status: "active",
        createdAt: now,
        updatedAt: now,
      },
    });
    await setWorkflowSettings({ autoAssignOn: true, autoResolveOn: false });
    const ticket = await seedTicket();
    generateTextMock.mockResolvedValue({
      text: JSON.stringify({ action: "resolve", reply: "Answer", confidence: 99 }),
    });

    try {
      await autoResolveTicketWorker(jobFor(ticket));

      const refreshed = await prisma.ticket.findUnique({
        where: { id: ticket.id },
        select: { status: true, assignedToId: true },
      });
      expect(refreshed!.status).toBe(TicketStatus.open);
      // The only active human agent is the one created above.
      expect(refreshed!.assignedToId).toBe(agentId);

      const events = await prisma.auditEvent.findMany({
        where: { ticketId: ticket.id },
        orderBy: { createdAt: "asc" },
      });
      expect(events.map((e) => e.type)).toContain("assignee_changed");
      const notif = await prisma.notification.findFirst({
        where: {
          ticketId: ticket.id,
          userId: refreshed!.assignedToId!,
          type: "ticket_assigned",
        },
      });
      expect(notif).not.toBeNull();
    } finally {
      await prisma.notification.deleteMany({ where: { ticketId: ticket.id } });
      await prisma.user.deleteMany({ where: { id: agentId } });
    }
  });
});
