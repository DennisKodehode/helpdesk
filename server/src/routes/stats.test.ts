import { SenderType, TicketStatus } from "@helpdesk/core";
import { generateId } from "better-auth";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import app from "../app";
import { initAiUserId } from "../lib/ai-user";
import { auth } from "../lib/auth";
import { prisma } from "../lib/prisma";

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
      data: {
        id,
        name: "Stats Test User",
        email: "test-stats@example.com",
        emailVerified: true,
        role: "agent",
        createdAt: now,
        updatedAt: now,
      },
    });
    await prisma.account.create({
      data: {
        id: generateId(),
        accountId: id,
        providerId: "credential",
        userId: id,
        password: hashedPassword,
        createdAt: now,
        updatedAt: now,
      },
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
      create: {
        id: aiId,
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
    expect(
      res.body.avgResolutionMinutes === null ||
        typeof res.body.avgResolutionMinutes === "number",
    ).toBe(true);
  });

  it("increments totalTickets when a new ticket is created", async () => {
    const before = (await request(app).get("/api/stats").set("Cookie", authCookie)).body
      .totalTickets as number;

    const ticket = await prisma.ticket.create({
      data: {
        fromName: "Test",
        fromEmail: "test-total@example.com",
        subject: "Total test",
        body: "Body",
        status: TicketStatus.open,
      },
    });
    createdTicketIds.push(ticket.id);

    const after = (await request(app).get("/api/stats").set("Cookie", authCookie)).body
      .totalTickets as number;
    expect(after).toBe(before + 1);
  });

  it("counts AI-resolved tickets and percentResolvedByAILast30d correctly", async () => {
    const before = await request(app).get("/api/stats").set("Cookie", authCookie);
    const beforeAI = before.body.resolvedByAI as number;

    const ticket = await prisma.ticket.create({
      data: {
        fromName: "AI Test",
        fromEmail: "ai-test@example.com",
        subject: "AI resolved ticket",
        body: "Body",
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
        fromName: "Avg Test",
        fromEmail: "avg-test@example.com",
        subject: "Avg resolution test",
        body: "Body",
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

describe("GET /api/stats/me", () => {
  let meCookie: string;
  let meId: string;
  let otherId: string;
  let createdTicketIds: number[] = [];

  beforeAll(async () => {
    const ctx = await auth.$context;
    const hashedPassword = await ctx.password.hash("Testpassword1!");
    const now = new Date();

    meId = generateId();
    await prisma.user.create({
      data: {
        id: meId,
        name: "Personal Stats Me",
        email: "test-personal-stats-me@example.com",
        emailVerified: true,
        role: "agent",
        createdAt: now,
        updatedAt: now,
      },
    });
    await prisma.account.create({
      data: {
        id: generateId(),
        accountId: meId,
        providerId: "credential",
        userId: meId,
        password: hashedPassword,
        createdAt: now,
        updatedAt: now,
      },
    });

    const signInRes = await request(app)
      .post("/api/auth/sign-in/email")
      .send({ email: "test-personal-stats-me@example.com", password: "Testpassword1!" });
    const cookies = signInRes.headers["set-cookie"] as string[] | string;
    meCookie = Array.isArray(cookies) ? cookies.join("; ") : cookies;

    otherId = generateId();
    await prisma.user.create({
      data: {
        id: otherId,
        name: "Personal Stats Other",
        email: "test-personal-stats-other@example.com",
        emailVerified: true,
        role: "agent",
        createdAt: now,
        updatedAt: now,
      },
    });
  });

  afterAll(async () => {
    if (createdTicketIds.length > 0) {
      await prisma.reply.deleteMany({ where: { ticketId: { in: createdTicketIds } } });
      await prisma.ticket.deleteMany({ where: { id: { in: createdTicketIds } } });
    }
    await prisma.session.deleteMany({ where: { userId: meId } });
    await prisma.account.deleteMany({ where: { userId: meId } });
    await prisma.user.delete({ where: { id: meId } });
    await prisma.user.delete({ where: { id: otherId } });
  });

  afterEach(async () => {
    if (createdTicketIds.length > 0) {
      await prisma.reply.deleteMany({ where: { ticketId: { in: createdTicketIds } } });
      await prisma.ticket.deleteMany({ where: { id: { in: createdTicketIds } } });
      createdTicketIds = [];
    }
  });

  it("returns 401 when not authenticated", async () => {
    const res = await request(app).get("/api/stats/me");
    expect(res.status).toBe(401);
  });

  it("returns the expected shape with zeros and nulls for a fresh agent", async () => {
    const res = await request(app).get("/api/stats/me").set("Cookie", meCookie);
    expect(res.status).toBe(200);
    expect(res.body.openOnMyPlate).toBe(0);
    expect(res.body.resolvedLifetime).toBe(0);
    expect(res.body.resolved30d).toBe(0);
    expect(res.body.avgResolutionMinutes).toBeNull();
    expect(res.body.avgFirstResponseMinutes).toBeNull();
    expect(res.body.repliesLifetime).toBe(0);
    expect(res.body.replies30d).toBe(0);
  });

  it("counts only my tickets and respects the 30-day window for resolved30d", async () => {
    const now = new Date();
    const oldResolved = new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000);

    const t1 = await prisma.ticket.create({
      data: {
        fromName: "A",
        fromEmail: "a@example.com",
        subject: "A",
        body: "",
        status: TicketStatus.resolved,
        assignedToId: meId,
        resolvedAt: now,
      },
    });
    const t2 = await prisma.ticket.create({
      data: {
        fromName: "B",
        fromEmail: "b@example.com",
        subject: "B",
        body: "",
        status: TicketStatus.closed,
        assignedToId: meId,
        resolvedAt: now,
        closedAt: now,
      },
    });
    const tOld = await prisma.ticket.create({
      data: {
        fromName: "Old",
        fromEmail: "old@example.com",
        subject: "Old",
        body: "",
        status: TicketStatus.resolved,
        assignedToId: meId,
        resolvedAt: oldResolved,
        createdAt: oldResolved,
      },
    });
    const tOther = await prisma.ticket.create({
      data: {
        fromName: "Other",
        fromEmail: "other@example.com",
        subject: "Other",
        body: "",
        status: TicketStatus.resolved,
        assignedToId: otherId,
        resolvedAt: now,
      },
    });
    const tOpen = await prisma.ticket.create({
      data: {
        fromName: "Open",
        fromEmail: "open@example.com",
        subject: "Open",
        body: "",
        status: TicketStatus.open,
        assignedToId: meId,
      },
    });
    createdTicketIds.push(t1.id, t2.id, tOld.id, tOther.id, tOpen.id);

    const res = await request(app).get("/api/stats/me").set("Cookie", meCookie);
    expect(res.body.openOnMyPlate).toBe(1);
    expect(res.body.resolvedLifetime).toBe(3);
    expect(res.body.resolved30d).toBe(2);
  });

  it("computes avgResolutionMinutes for my tickets only", async () => {
    const createdAt = new Date(Date.now() - 60 * 60 * 1000); // 60 min ago
    const resolvedAt = new Date();

    const mine = await prisma.ticket.create({
      data: {
        fromName: "Mine",
        fromEmail: "mine@example.com",
        subject: "Mine",
        body: "",
        status: TicketStatus.resolved,
        assignedToId: meId,
        createdAt,
        resolvedAt,
      },
    });
    // Other agent's quickly resolved ticket — must NOT affect my average.
    const theirs = await prisma.ticket.create({
      data: {
        fromName: "Theirs",
        fromEmail: "theirs@example.com",
        subject: "Theirs",
        body: "",
        status: TicketStatus.resolved,
        assignedToId: otherId,
        createdAt: new Date(Date.now() - 60 * 1000),
        resolvedAt,
      },
    });
    createdTicketIds.push(mine.id, theirs.id);

    const res = await request(app).get("/api/stats/me").set("Cookie", meCookie);
    expect(res.body.avgResolutionMinutes).not.toBeNull();
    expect(res.body.avgResolutionMinutes).toBeGreaterThanOrEqual(59);
    expect(res.body.avgResolutionMinutes).toBeLessThanOrEqual(61);
  });

  it("computes avgFirstResponseMinutes only when my reply was the first one", async () => {
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
    const now = new Date();

    // Ticket where I replied first (10-minute first response).
    const t1 = await prisma.ticket.create({
      data: {
        fromName: "T1",
        fromEmail: "t1@example.com",
        subject: "T1",
        body: "",
        status: TicketStatus.open,
        createdAt: tenMinutesAgo,
      },
    });
    await prisma.reply.create({
      data: {
        ticketId: t1.id,
        authorId: meId,
        senderType: SenderType.agent,
        body: "Hi",
        createdAt: now,
      },
    });

    // Ticket where someone else replied first — must NOT be counted toward my average.
    const t2 = await prisma.ticket.create({
      data: {
        fromName: "T2",
        fromEmail: "t2@example.com",
        subject: "T2",
        body: "",
        status: TicketStatus.open,
        createdAt: new Date(Date.now() - 60 * 60 * 1000),
      },
    });
    await prisma.reply.create({
      data: {
        ticketId: t2.id,
        authorId: otherId,
        senderType: SenderType.agent,
        body: "First",
        createdAt: new Date(Date.now() - 50 * 60 * 1000),
      },
    });
    await prisma.reply.create({
      data: {
        ticketId: t2.id,
        authorId: meId,
        senderType: SenderType.agent,
        body: "Second",
        createdAt: now,
      },
    });

    createdTicketIds.push(t1.id, t2.id);

    const res = await request(app).get("/api/stats/me").set("Cookie", meCookie);
    expect(res.body.avgFirstResponseMinutes).not.toBeNull();
    expect(res.body.avgFirstResponseMinutes).toBeGreaterThanOrEqual(9);
    expect(res.body.avgFirstResponseMinutes).toBeLessThanOrEqual(11);
  });

  it("counts replies authored by me, respecting the 30-day window", async () => {
    const now = new Date();
    const fortyDaysAgo = new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000);

    const ticket = await prisma.ticket.create({
      data: {
        fromName: "RT",
        fromEmail: "rt@example.com",
        subject: "RT",
        body: "",
        status: TicketStatus.open,
      },
    });
    createdTicketIds.push(ticket.id);

    await prisma.reply.create({
      data: {
        ticketId: ticket.id,
        authorId: meId,
        senderType: SenderType.agent,
        body: "today",
        createdAt: now,
      },
    });
    await prisma.reply.create({
      data: {
        ticketId: ticket.id,
        authorId: meId,
        senderType: SenderType.agent,
        body: "old",
        createdAt: fortyDaysAgo,
      },
    });
    await prisma.reply.create({
      data: {
        ticketId: ticket.id,
        authorId: otherId,
        senderType: SenderType.agent,
        body: "from other agent",
        createdAt: now,
      },
    });
    await prisma.reply.create({
      data: {
        ticketId: ticket.id,
        authorId: null,
        senderType: SenderType.customer,
        body: "from customer",
        createdAt: now,
      },
    });

    const res = await request(app).get("/api/stats/me").set("Cookie", meCookie);
    expect(res.body.repliesLifetime).toBe(2);
    expect(res.body.replies30d).toBe(1);
  });
});
