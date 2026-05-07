import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { generateId } from "better-auth";
import app from "../app";
import { auth } from "../lib/auth";
import { prisma } from "../lib/prisma";
import { TicketStatus, TicketCategory } from "@helpdesk/core";

describe("GET /api/tickets", () => {
  it("returns 401 when not authenticated", async () => {
    const res = await request(app).get("/api/tickets");
    expect(res.status).toBe(401);
  });
});

describe("GET /api/tickets — sorting", () => {
  let authCookie: string;
  let testUserId: string;
  let createdTicketIds: number[] = [];

  beforeAll(async () => {
    const ctx = await auth.$context;
    const hashedPassword = await ctx.password.hash("Testpassword1!");
    const id = generateId();
    const now = new Date();

    await prisma.user.create({
      data: { id, name: "Test Agent", email: "test-sorting@example.com", emailVerified: true, role: "agent", createdAt: now, updatedAt: now },
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
      .send({ email: "test-sorting@example.com", password: "Testpassword1!" });

    const cookies = signInRes.headers["set-cookie"] as string[] | string;
    authCookie = Array.isArray(cookies) ? cookies.join("; ") : cookies;
  });

  afterAll(async () => {
    await prisma.session.deleteMany({ where: { userId: testUserId } });
    await prisma.account.deleteMany({ where: { userId: testUserId } });
    await prisma.user.delete({ where: { id: testUserId } });
  });

  beforeEach(async () => {
    const now = new Date();
    const earlier = new Date(now.getTime() - 1000);
    const a = await prisma.ticket.create({
      data: { fromName: "Alice Smith", fromEmail: "alice@example.com", subject: "Apple subject", body: "", createdAt: earlier },
    });
    const b = await prisma.ticket.create({
      data: { fromName: "Zara Jones", fromEmail: "zara@example.com", subject: "Zebra subject", body: "", createdAt: now },
    });
    createdTicketIds = [a.id, b.id];
  });

  afterEach(async () => {
    await prisma.ticket.deleteMany({ where: { id: { in: createdTicketIds } } });
    createdTicketIds = [];
  });

  it("returns 200 with default sort (createdAt desc)", async () => {
    const res = await request(app).get("/api/tickets").set("Cookie", authCookie);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(typeof res.body.total).toBe("number");
    expect(res.body.page).toBe(1);
    expect(res.body.pageSize).toBe(10);
    const ids = (res.body.data as { id: number }[]).map((t) => t.id);
    expect(ids.indexOf(createdTicketIds[1])).toBeLessThan(ids.indexOf(createdTicketIds[0]));
  });

  it("sorts by subject asc", async () => {
    const res = await request(app)
      .get("/api/tickets?sortBy=subject&sortOrder=asc")
      .set("Cookie", authCookie);
    expect(res.status).toBe(200);
    const ids = (res.body.data as { id: number }[]).map((t) => t.id);
    // createdTicketIds[0] = "Apple subject", should appear before createdTicketIds[1] = "ZZZ subject"
    expect(ids.indexOf(createdTicketIds[0])).toBeLessThan(ids.indexOf(createdTicketIds[1]));
  });

  it("sorts by subject desc", async () => {
    const res = await request(app)
      .get("/api/tickets?sortBy=subject&sortOrder=desc")
      .set("Cookie", authCookie);
    expect(res.status).toBe(200);
    const ids = (res.body.data as { id: number }[]).map((t) => t.id);
    // createdTicketIds[1] = "Zebra subject", should appear before createdTicketIds[0] = "AAA subject"
    expect(ids.indexOf(createdTicketIds[1])).toBeLessThan(ids.indexOf(createdTicketIds[0]));
  });

  it("sorts by fromName asc", async () => {
    const res = await request(app)
      .get("/api/tickets?sortBy=fromName&sortOrder=asc")
      .set("Cookie", authCookie);
    expect(res.status).toBe(200);
    const ids = (res.body.data as { id: number }[]).map((t) => t.id);
    // createdTicketIds[0] = "Alice Smith", should appear before createdTicketIds[1] = "Zara Jones"
    expect(ids.indexOf(createdTicketIds[0])).toBeLessThan(ids.indexOf(createdTicketIds[1]));
  });

  it("returns only the requested page of results", async () => {
    const res = await request(app)
      .get("/api/tickets?page=1&pageSize=1")
      .set("Cookie", authCookie);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.page).toBe(1);
    expect(res.body.pageSize).toBe(1);
    expect(res.body.total).toBeGreaterThanOrEqual(2);
  });

  it("returns second page of results", async () => {
    const page1 = await request(app)
      .get("/api/tickets?sortBy=createdAt&sortOrder=desc&page=1&pageSize=1")
      .set("Cookie", authCookie);
    const page2 = await request(app)
      .get("/api/tickets?sortBy=createdAt&sortOrder=desc&page=2&pageSize=1")
      .set("Cookie", authCookie);
    expect(page1.status).toBe(200);
    expect(page2.status).toBe(200);
    expect(page1.body.data[0].id).not.toBe(page2.body.data[0].id);
  });

  it("filters by status", async () => {
    const openTicket = await prisma.ticket.create({
      data: { fromName: "Filter Test", fromEmail: "filter@example.com", subject: "Open ticket", body: "", status: TicketStatus.open },
    });
    const resolvedTicket = await prisma.ticket.create({
      data: { fromName: "Filter Test", fromEmail: "filter@example.com", subject: "Resolved ticket", body: "", status: TicketStatus.resolved },
    });
    createdTicketIds.push(openTicket.id, resolvedTicket.id);

    const res = await request(app)
      .get(`/api/tickets?status=${TicketStatus.open}`)
      .set("Cookie", authCookie);
    expect(res.status).toBe(200);
    const ids = (res.body.data as { id: number }[]).map((t) => t.id);
    expect(ids).toContain(openTicket.id);
    expect(ids).not.toContain(resolvedTicket.id);
  });

  it("filters by category", async () => {
    const technicalTicket = await prisma.ticket.create({
      data: { fromName: "Filter Test", fromEmail: "filter@example.com", subject: "Technical ticket", body: "", category: TicketCategory.technical_question },
    });
    const refundTicket = await prisma.ticket.create({
      data: { fromName: "Filter Test", fromEmail: "filter@example.com", subject: "Refund ticket", body: "", category: TicketCategory.refund_request },
    });
    createdTicketIds.push(technicalTicket.id, refundTicket.id);

    const res = await request(app)
      .get(`/api/tickets?category=${TicketCategory.technical_question}`)
      .set("Cookie", authCookie);
    expect(res.status).toBe(200);
    const ids = (res.body.data as { id: number }[]).map((t) => t.id);
    expect(ids).toContain(technicalTicket.id);
    expect(ids).not.toContain(refundTicket.id);
  });

  it("filters by search term across subject, fromName, and fromEmail", async () => {
    const matchTicket = await prisma.ticket.create({
      data: { fromName: "Unique Person", fromEmail: "unique@example.com", subject: "Unique subject", body: "" },
    });
    const noMatchTicket = await prisma.ticket.create({
      data: { fromName: "Other Person", fromEmail: "other@example.com", subject: "Other subject", body: "" },
    });
    createdTicketIds.push(matchTicket.id, noMatchTicket.id);

    const res = await request(app)
      .get("/api/tickets?search=unique")
      .set("Cookie", authCookie);
    expect(res.status).toBe(200);
    const ids = (res.body.data as { id: number }[]).map((t) => t.id);
    expect(ids).toContain(matchTicket.id);
    expect(ids).not.toContain(noMatchTicket.id);
  });

  it("search is case-insensitive", async () => {
    const ticket = await prisma.ticket.create({
      data: { fromName: "Alice Smith", fromEmail: "alice@example.com", subject: "Printer on fire", body: "" },
    });
    createdTicketIds.push(ticket.id);

    const res = await request(app)
      .get("/api/tickets?search=PRINTER")
      .set("Cookie", authCookie);
    expect(res.status).toBe(200);
    const ids = (res.body.data as { id: number }[]).map((t) => t.id);
    expect(ids).toContain(ticket.id);
  });

  it("returns 400 for an invalid status value", async () => {
    const res = await request(app)
      .get("/api/tickets?status=pending")
      .set("Cookie", authCookie);
    expect(res.status).toBe(400);
    expect(res.body.error).toBeTypeOf("string");
  });

  it("returns 400 for an invalid sortBy value", async () => {
    const res = await request(app)
      .get("/api/tickets?sortBy=INVALID")
      .set("Cookie", authCookie);
    expect(res.status).toBe(400);
    expect(res.body.error).toBeTypeOf("string");
  });

  it("returns 400 for an invalid sortOrder value", async () => {
    const res = await request(app)
      .get("/api/tickets?sortBy=subject&sortOrder=sideways")
      .set("Cookie", authCookie);
    expect(res.status).toBe(400);
    expect(res.body.error).toBeTypeOf("string");
  });
});

describe("GET /api/tickets/:id", () => {
  let authCookie: string;
  let testUserId: string;
  let ticketId: number;

  beforeAll(async () => {
    const ctx = await auth.$context;
    const hashedPassword = await ctx.password.hash("Testpassword1!");
    const id = generateId();
    const now = new Date();

    await prisma.user.create({
      data: { id, name: "Detail Test Agent", email: "test-detail@example.com", emailVerified: true, role: "agent", createdAt: now, updatedAt: now },
    });
    await prisma.account.create({
      data: { id: generateId(), accountId: id, providerId: "credential", userId: id, password: hashedPassword, createdAt: now, updatedAt: now },
    });
    testUserId = id;

    const signInRes = await request(app)
      .post("/api/auth/sign-in/email")
      .send({ email: "test-detail@example.com", password: "Testpassword1!" });

    const cookies = signInRes.headers["set-cookie"] as string[] | string;
    authCookie = Array.isArray(cookies) ? cookies.join("; ") : cookies;
  });

  afterAll(async () => {
    await prisma.session.deleteMany({ where: { userId: testUserId } });
    await prisma.account.deleteMany({ where: { userId: testUserId } });
    await prisma.user.delete({ where: { id: testUserId } });
  });

  beforeEach(async () => {
    const ticket = await prisma.ticket.create({
      data: {
        fromName: "Carol White",
        fromEmail: "carol@example.com",
        subject: "Printer on fire",
        body: "My printer caught fire, please help.",
        status: TicketStatus.open,
        category: TicketCategory.technical_question,
      },
    });
    ticketId = ticket.id;
  });

  afterEach(async () => {
    await prisma.ticket.deleteMany({ where: { id: ticketId } });
  });

  it("returns 401 when not authenticated", async () => {
    const res = await request(app).get(`/api/tickets/${ticketId}`);
    expect(res.status).toBe(401);
  });

  it("returns 200 with all ticket fields", async () => {
    const res = await request(app)
      .get(`/api/tickets/${ticketId}`)
      .set("Cookie", authCookie);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(ticketId);
    expect(res.body.fromName).toBe("Carol White");
    expect(res.body.fromEmail).toBe("carol@example.com");
    expect(res.body.subject).toBe("Printer on fire");
    expect(res.body.body).toBe("My printer caught fire, please help.");
    expect(res.body.status).toBe(TicketStatus.open);
    expect(res.body.category).toBe(TicketCategory.technical_question);
    expect(res.body.assignedTo).toBeNull();
    expect(typeof res.body.createdAt).toBe("string");
    expect(typeof res.body.updatedAt).toBe("string");
  });

  it("returns 404 when ticket does not exist", async () => {
    const res = await request(app)
      .get("/api/tickets/999999999")
      .set("Cookie", authCookie);
    expect(res.status).toBe(404);
    expect(res.body.error).toBeTypeOf("string");
  });

  it("returns 400 for a non-numeric ID", async () => {
    const res = await request(app)
      .get("/api/tickets/abc")
      .set("Cookie", authCookie);
    expect(res.status).toBe(400);
    expect(res.body.error).toBeTypeOf("string");
  });
});

describe("PATCH /api/tickets/:id", () => {
  let authCookie: string;
  let testUserId: string;
  let assigneeId: string;
  let adminId: string;
  let ticketId: number;

  beforeAll(async () => {
    const ctx = await auth.$context;
    const hashedPassword = await ctx.password.hash("Testpassword1!");
    const now = new Date();

    const actorId = generateId();
    await prisma.user.create({
      data: { id: actorId, name: "Patch Actor", email: "test-patch-actor@example.com", emailVerified: true, role: "agent", createdAt: now, updatedAt: now },
    });
    await prisma.account.create({
      data: { id: generateId(), accountId: actorId, providerId: "credential", userId: actorId, password: hashedPassword, createdAt: now, updatedAt: now },
    });
    testUserId = actorId;

    const signInRes = await request(app)
      .post("/api/auth/sign-in/email")
      .send({ email: "test-patch-actor@example.com", password: "Testpassword1!" });
    const cookies = signInRes.headers["set-cookie"] as string[] | string;
    authCookie = Array.isArray(cookies) ? cookies.join("; ") : cookies;

    const assigneeUserId = generateId();
    await prisma.user.create({
      data: { id: assigneeUserId, name: "Assignee Agent", email: "test-patch-assignee@example.com", emailVerified: true, role: "agent", createdAt: now, updatedAt: now },
    });
    assigneeId = assigneeUserId;

    const adminUserId = generateId();
    await prisma.user.create({
      data: { id: adminUserId, name: "Patch Admin", email: "test-patch-admin@example.com", emailVerified: true, role: "admin", createdAt: now, updatedAt: now },
    });
    adminId = adminUserId;
  });

  afterAll(async () => {
    await prisma.session.deleteMany({ where: { userId: testUserId } });
    await prisma.account.deleteMany({ where: { userId: testUserId } });
    await prisma.user.delete({ where: { id: testUserId } });
    await prisma.user.delete({ where: { id: assigneeId } });
    await prisma.user.delete({ where: { id: adminId } });
  });

  beforeEach(async () => {
    const ticket = await prisma.ticket.create({
      data: { fromName: "Patch Test", fromEmail: "patch@example.com", subject: "Patch subject", body: "" },
    });
    ticketId = ticket.id;
  });

  afterEach(async () => {
    await prisma.ticket.deleteMany({ where: { id: ticketId } });
  });

  it("returns 401 when not authenticated", async () => {
    const res = await request(app).patch(`/api/tickets/${ticketId}`).send({ assignedToId: assigneeId });
    expect(res.status).toBe(401);
  });

  it("returns 400 for invalid ticket ID", async () => {
    const res = await request(app)
      .patch("/api/tickets/abc")
      .set("Cookie", authCookie)
      .send({ assignedToId: assigneeId });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeTypeOf("string");
  });

  it("returns 400 when body is missing assignedToId", async () => {
    const res = await request(app)
      .patch(`/api/tickets/${ticketId}`)
      .set("Cookie", authCookie)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBeTypeOf("string");
  });

  it("returns 404 when ticket does not exist", async () => {
    const res = await request(app)
      .patch("/api/tickets/999999999")
      .set("Cookie", authCookie)
      .send({ assignedToId: assigneeId });
    expect(res.status).toBe(404);
    expect(res.body.error).toBeTypeOf("string");
  });

  it("returns 404 when assignedToId references an admin user", async () => {
    const res = await request(app)
      .patch(`/api/tickets/${ticketId}`)
      .set("Cookie", authCookie)
      .send({ assignedToId: adminId });
    expect(res.status).toBe(404);
    expect(res.body.error).toBeTypeOf("string");
  });

  it("returns 404 when assignedToId references a non-existent user", async () => {
    const res = await request(app)
      .patch(`/api/tickets/${ticketId}`)
      .set("Cookie", authCookie)
      .send({ assignedToId: "nonexistent-user-id" });
    expect(res.status).toBe(404);
    expect(res.body.error).toBeTypeOf("string");
  });

  it("assigns the ticket to a user and returns updated ticket", async () => {
    const res = await request(app)
      .patch(`/api/tickets/${ticketId}`)
      .set("Cookie", authCookie)
      .send({ assignedToId: assigneeId });
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(ticketId);
    expect(res.body.assignedToId).toBe(assigneeId);
    expect(res.body.assignedTo).toMatchObject({ id: assigneeId, name: "Assignee Agent", email: "test-patch-assignee@example.com" });
  });

  it("unassigns the ticket when assignedToId is null", async () => {
    await prisma.ticket.update({ where: { id: ticketId }, data: { assignedToId: assigneeId } });

    const res = await request(app)
      .patch(`/api/tickets/${ticketId}`)
      .set("Cookie", authCookie)
      .send({ assignedToId: null });
    expect(res.status).toBe(200);
    expect(res.body.assignedToId).toBeNull();
    expect(res.body.assignedTo).toBeNull();
  });
});
