import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { generateId } from "better-auth";
import app from "../app";
import { auth } from "../lib/auth";
import { prisma } from "../lib/prisma";
import { initAiUserId } from "../lib/ai-user";
import { TicketStatus } from "@helpdesk/core";

describe("GET /api/stats", () => {
  let authCookie: string;
  let testUserId: string;
  let aiUserId: string;
  const createdTicketIds: number[] = [];

  beforeAll(async () => {
    const ctx = await auth.$context;
    const hashedPassword = await ctx.password.hash("Testpassword1!");
    const now = new Date();

    const id = generateId();
    await prisma.user.create({
      data: { id, name: "Stats Test User", email: "test-stats@example.com", emailVerified: true, role: "agent", createdAt: now, updatedAt: now },
    });
    await prisma.account.create({
      data: { id: generateId(), accountId: id, providerId: "credential", userId: id, password: hashedPassword, createdAt: now, updatedAt: now },
    });
    testUserId = id;

    const signInRes = await request(app)
      .post("/api/auth/sign-in/email")
      .send({ email: "test-stats@example.com", password: "Testpassword1!" });
    const cookies = signInRes.headers["set-cookie"] as string[] | string;
    authCookie = Array.isArray(cookies) ? cookies.join("; ") : cookies;

    const aiId = generateId();
    await prisma.user.upsert({
      where: { email: "ai@helpdesk.internal" },
      update: {},
      create: { id: aiId, name: "AI", email: "ai@helpdesk.internal", emailVerified: true, role: "agent", createdAt: now, updatedAt: now },
    });
    const aiUser = await prisma.user.findUnique({ where: { email: "ai@helpdesk.internal" } });
    aiUserId = aiUser!.id;
    await initAiUserId();
  });

  afterAll(async () => {
    if (createdTicketIds.length > 0) {
      await prisma.reply.deleteMany({ where: { ticketId: { in: createdTicketIds } } });
      await prisma.ticket.deleteMany({ where: { id: { in: createdTicketIds } } });
    }
    await prisma.session.deleteMany({ where: { userId: testUserId } });
    await prisma.account.deleteMany({ where: { userId: testUserId } });
    await prisma.user.delete({ where: { id: testUserId } });
    await prisma.user.deleteMany({ where: { email: "ai@helpdesk.internal" } });
  });

  it("returns 401 when not authenticated", async () => {
    const res = await request(app).get("/api/stats");
    expect(res.status).toBe(401);
  });

  it("returns 200 with the correct response shape", async () => {
    const res = await request(app).get("/api/stats").set("Cookie", authCookie);
    expect(res.status).toBe(200);
    expect(typeof res.body.totalTickets).toBe("number");
    expect(typeof res.body.openTickets).toBe("number");
    expect(typeof res.body.unassignedTickets).toBe("number");
    expect(typeof res.body.resolvedTickets).toBe("number");
    expect(typeof res.body.closedTickets).toBe("number");
    expect(typeof res.body.resolvedByAI).toBe("number");
    expect(typeof res.body.percentResolvedByAILast30d).toBe("number");
    expect(res.body.avgResolutionMinutes === null || typeof res.body.avgResolutionMinutes === "number").toBe(true);
  });

  it("increments totalTickets when a new ticket is created", async () => {
    const before = (await request(app).get("/api/stats").set("Cookie", authCookie)).body.totalTickets as number;

    const ticket = await prisma.ticket.create({
      data: { fromName: "Test", fromEmail: "test-total@example.com", subject: "Total test", body: "Body", status: TicketStatus.open },
    });
    createdTicketIds.push(ticket.id);

    const after = (await request(app).get("/api/stats").set("Cookie", authCookie)).body.totalTickets as number;
    expect(after).toBe(before + 1);
  });

  it("counts AI-resolved tickets and percentResolvedByAILast30d correctly", async () => {
    const before = await request(app).get("/api/stats").set("Cookie", authCookie);
    const beforeAI = before.body.resolvedByAI as number;

    const ticket = await prisma.ticket.create({
      data: {
        fromName: "AI Test", fromEmail: "ai-test@example.com",
        subject: "AI resolved ticket", body: "Body",
        status: TicketStatus.resolved,
        assignedToId: aiUserId,
        resolvedAt: new Date(),
      },
    });
    createdTicketIds.push(ticket.id);

    const after = await request(app).get("/api/stats").set("Cookie", authCookie);
    expect(after.body.resolvedByAI).toBe(beforeAI + 1);
    expect(after.body.percentResolvedByAILast30d).toBeGreaterThan(0);
  });

  it("keeps percentResolvedByAILast30d in the [0, 100] range", async () => {
    const res = await request(app).get("/api/stats").set("Cookie", authCookie);
    expect(res.body.percentResolvedByAILast30d).toBeGreaterThanOrEqual(0);
    expect(res.body.percentResolvedByAILast30d).toBeLessThanOrEqual(100);
  });

  it("computes avgResolutionMinutes from resolvedAt timestamps", async () => {
    const createdAt = new Date(Date.now() - 30 * 60 * 1000); // 30 min ago
    const resolvedAt = new Date();

    const ticket = await prisma.ticket.create({
      data: {
        fromName: "Avg Test", fromEmail: "avg-test@example.com",
        subject: "Avg resolution test", body: "Body",
        status: TicketStatus.resolved,
        createdAt,
        resolvedAt,
      },
    });
    createdTicketIds.push(ticket.id);

    const res = await request(app).get("/api/stats").set("Cookie", authCookie);
    expect(res.body.avgResolutionMinutes).not.toBeNull();
    expect(typeof res.body.avgResolutionMinutes).toBe("number");
    expect(res.body.avgResolutionMinutes).toBeGreaterThan(0);
  });
});
