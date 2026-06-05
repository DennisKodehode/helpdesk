import { KbSuggestionStatus, TicketCategory, TicketStatus } from "@helpdesk/core";
import { generateId } from "better-auth";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const generateTextMock = vi.fn();
vi.mock("ai", async () => {
  const actual = await vi.importActual<typeof import("ai")>("ai");
  return {
    generateText: (...args: unknown[]) => generateTextMock(...args),
    Output: actual.Output,
  };
});
vi.mock("@ai-sdk/google", () => ({ google: () => "mock-model" }));

const app = (await import("../app")).default;
const { auth } = await import("../lib/auth");
const { prisma } = await import("../lib/prisma");

describe("POST /api/tickets/:id/suggest-kb", () => {
  let agentId: string;
  let agentCookie: string;
  const createdTicketIds: number[] = [];
  const createdSuggestionIds: string[] = [];

  beforeAll(async () => {
    const ctx = await auth.$context;
    const hashedPassword = await ctx.password.hash("Testpassword1!");
    const now = new Date();
    agentId = generateId();
    await prisma.user.create({
      data: {
        id: agentId,
        name: "suggest-kb-agent",
        email: "suggest-kb-agent@example.com",
        emailVerified: true,
        role: "agent",
        createdAt: now,
        updatedAt: now,
      },
    });
    await prisma.account.create({
      data: {
        id: generateId(),
        accountId: agentId,
        providerId: "credential",
        userId: agentId,
        password: hashedPassword,
        createdAt: now,
        updatedAt: now,
      },
    });
    const signIn = await request(app)
      .post("/api/auth/sign-in/email")
      .send({ email: "suggest-kb-agent@example.com", password: "Testpassword1!" });
    const cookies = signIn.headers["set-cookie"] as string[] | string;
    agentCookie = Array.isArray(cookies) ? cookies.join("; ") : cookies;
  });

  afterEach(async () => {
    generateTextMock.mockReset();
    if (createdSuggestionIds.length > 0) {
      await prisma.kbSuggestion.deleteMany({
        where: { id: { in: createdSuggestionIds } },
      });
      createdSuggestionIds.length = 0;
    }
    if (createdTicketIds.length > 0) {
      await prisma.ticket.deleteMany({ where: { id: { in: createdTicketIds } } });
      createdTicketIds.length = 0;
    }
  });

  afterAll(async () => {
    await prisma.session.deleteMany({ where: { userId: agentId } });
    await prisma.account.deleteMany({ where: { userId: agentId } });
    await prisma.user.deleteMany({ where: { id: agentId } });
  });

  async function seedTicket() {
    const t = await prisma.ticket.create({
      data: {
        fromName: "Cust",
        fromEmail: "c@example.com",
        subject: "Refund please",
        body: "I want a refund",
        category: TicketCategory.refund_request,
        status: TicketStatus.resolved,
        resolvedAt: new Date(),
      },
    });
    createdTicketIds.push(t.id);
    return t;
  }

  it("returns 401 when unauthenticated", async () => {
    const t = await seedTicket();
    const res = await request(app).post(`/api/tickets/${t.id}/suggest-kb`);
    expect(res.status).toBe(401);
  });

  it("returns 404 for an unknown ticket", async () => {
    const res = await request(app)
      .post("/api/tickets/99999999/suggest-kb")
      .set("Cookie", agentCookie);
    expect(res.status).toBe(404);
  });

  it("drafts and files a pending agent-sourced suggestion", async () => {
    const t = await seedTicket();
    generateTextMock.mockResolvedValue({
      output: {
        title: "Refund requests",
        question: "How do I get a refund?",
        answer: "Contact support within 30 days.",
      },
    });

    const res = await request(app)
      .post(`/api/tickets/${t.id}/suggest-kb`)
      .set("Cookie", agentCookie);
    expect(res.status).toBe(201);
    createdSuggestionIds.push(res.body.id);

    const suggestion = await prisma.kbSuggestion.findUnique({
      where: { id: res.body.id },
    });
    expect(suggestion?.status).toBe(KbSuggestionStatus.pending);
    expect(suggestion?.source).toBe("agent");
    expect(suggestion?.requestedById).toBe(agentId);
    expect(suggestion?.category).toBe(TicketCategory.refund_request);
    expect(suggestion?.sourceTicketIds).toEqual([t.id]);
  });
});
