import { TicketStatus } from "@helpdesk/core";
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
  });

  beforeEach(() => {
    generateTextMock.mockReset();
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
      select: { status: true },
    });
    expect(refreshed!.status).toBe(TicketStatus.resolved);

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
});
