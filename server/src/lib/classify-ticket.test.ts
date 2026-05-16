import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { prisma } from "./prisma";
import { TicketStatus, TicketCategory, TicketPriority } from "@helpdesk/core";

const generateObjectMock = vi.fn();
vi.mock("ai", () => ({
  generateObject: (...args: unknown[]) => generateObjectMock(...args),
}));
vi.mock("@ai-sdk/google", () => ({
  google: () => "mock-model",
}));

const { classifyTicketWorker } = await import("./classify-ticket");

describe("classify-ticket worker", () => {
  const createdIds: number[] = [];

  beforeEach(() => {
    generateObjectMock.mockReset();
  });

  afterEach(async () => {
    if (createdIds.length > 0) {
      await prisma.ticket.deleteMany({ where: { id: { in: createdIds } } });
      createdIds.length = 0;
    }
  });

  async function seedTicket() {
    const ticket = await prisma.ticket.create({
      data: {
        fromName: "Classify Test",
        fromEmail: "classify-test@example.com",
        subject: "Account locked, please help",
        body: "I cannot log in to my paid account.",
        status: TicketStatus.new,
      },
    });
    createdIds.push(ticket.id);
    return ticket;
  }

  it("writes both category and priority returned by Gemini", async () => {
    const ticket = await seedTicket();
    generateObjectMock.mockResolvedValue({
      object: { category: TicketCategory.billing_inquiry, priority: TicketPriority.urgent },
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

  it("leaves the ticket untouched when Gemini throws", async () => {
    const ticket = await seedTicket();
    generateObjectMock.mockRejectedValue(new Error("Gemini down"));

    await classifyTicketWorker([
      { data: { id: ticket.id, subject: ticket.subject, body: ticket.body } } as never,
    ]);

    const refreshed = await prisma.ticket.findUnique({
      where: { id: ticket.id },
      select: { category: true, priority: true },
    });
    expect(refreshed!.category).toBeNull();
    // priority defaults to normal at the DB layer and stays put on failure
    expect(refreshed!.priority).toBe(TicketPriority.normal);
  });
});
