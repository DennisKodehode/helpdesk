import { TicketCategory, TicketPriority, TicketStatus } from "@helpdesk/core";
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

const { classifyTicketWorker } = await import("./classify-ticket");

describe("classify-ticket worker", () => {
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
      // Ticket cascade-delete handles audit_event rows
      await prisma.ticket.deleteMany({ where: { id: { in: createdIds } } });
      createdIds.length = 0;
    }
  });

  async function seedTicket(overrides?: {
    category?: TicketCategory | null;
    priority?: TicketPriority;
  }) {
    const ticket = await prisma.ticket.create({
      data: {
        fromName: "Classify Test",
        fromEmail: "classify-test@example.com",
        subject: "Account locked, please help",
        body: "I cannot log in to my paid account.",
        status: TicketStatus.new,
        category: overrides?.category ?? null,
        priority: overrides?.priority ?? TicketPriority.normal,
      },
    });
    createdIds.push(ticket.id);
    return ticket;
  }

  it("writes both category and priority returned by Gemini", async () => {
    const ticket = await seedTicket();
    generateTextMock.mockResolvedValue({
      output: {
        category: TicketCategory.billing_inquiry,
        priority: TicketPriority.urgent,
      },
    });

    await classifyTicketWorker([
      { data: { id: ticket.id, subject: ticket.subject, body: ticket.body } } as never,
    ]);

    const refreshed = await prisma.ticket.findUnique({
      where: { id: ticket.id },
      select: { category: true, priority: true },
    });
    expect(refreshed!.category).toBe(TicketCategory.billing_inquiry);
    expect(refreshed!.priority).toBe(TicketPriority.urgent);
  });

  it("records category_changed and priority_changed audit events with AI as actor", async () => {
    const ticket = await seedTicket();
    generateTextMock.mockResolvedValue({
      output: {
        category: TicketCategory.refund_request,
        priority: TicketPriority.high,
      },
    });

    await classifyTicketWorker([
      { data: { id: ticket.id, subject: ticket.subject, body: ticket.body } } as never,
    ]);

    const events = await prisma.auditEvent.findMany({
      where: { ticketId: ticket.id },
      orderBy: { type: "asc" },
    });
    expect(events).toHaveLength(2);
    const byType = Object.fromEntries(events.map((e) => [e.type, e]));
    expect(byType.category_changed).toBeDefined();
    expect(byType.category_changed.actorId).toBe(aiUserId);
    expect(byType.category_changed.data).toEqual({
      from: null,
      to: "refund_request",
    });
    expect(byType.priority_changed).toBeDefined();
    expect(byType.priority_changed.actorId).toBe(aiUserId);
    expect(byType.priority_changed.data).toEqual({ from: "normal", to: "high" });
  });

  it("records no audit events when AI output matches current values", async () => {
    const ticket = await seedTicket({
      category: TicketCategory.general_question,
      priority: TicketPriority.normal,
    });
    generateTextMock.mockResolvedValue({
      output: {
        category: TicketCategory.general_question,
        priority: TicketPriority.normal,
      },
    });

    await classifyTicketWorker([
      { data: { id: ticket.id, subject: ticket.subject, body: ticket.body } } as never,
    ]);

    const events = await prisma.auditEvent.findMany({ where: { ticketId: ticket.id } });
    expect(events).toHaveLength(0);
  });

  it("leaves the ticket untouched and records no audit events when Gemini throws", async () => {
    const ticket = await seedTicket();
    generateTextMock.mockRejectedValue(new Error("Gemini down"));

    await classifyTicketWorker([
      { data: { id: ticket.id, subject: ticket.subject, body: ticket.body } } as never,
    ]);

    const refreshed = await prisma.ticket.findUnique({
      where: { id: ticket.id },
      select: { category: true, priority: true },
    });
    expect(refreshed!.category).toBeNull();
    expect(refreshed!.priority).toBe(TicketPriority.normal);

    const events = await prisma.auditEvent.findMany({ where: { ticketId: ticket.id } });
    expect(events).toHaveLength(0);
  });
});
