import {
  NotificationType,
  TicketCategory,
  TicketPriority,
  TicketStatus,
} from "@helpdesk/core";
import { generateId } from "better-auth";
import request from "supertest";
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
import app from "../app";
import { initAiUserId } from "../lib/ai-user";
import { auth } from "../lib/auth";
import boss from "../lib/boss";
import { prisma } from "../lib/prisma";
import { SEND_REPLY_EMAIL_QUEUE } from "../lib/send-reply-email-job";

vi.mock("../lib/boss", () => ({
  default: { send: vi.fn().mockResolvedValue("mock-job-id") },
}));

// Mock Vercel AI SDK so polish-reply and summarize don't hit Gemini in tests.
// Default to a successful resolve; per-test overrides use mockRejectedValueOnce.
const generateTextMock = vi.fn().mockResolvedValue({ text: "" });
vi.mock("ai", async () => {
  const actual = await vi.importActual<typeof import("ai")>("ai");
  return {
    ...actual,
    generateText: (...args: unknown[]) => generateTextMock(...args),
  };
});

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
      data: {
        id,
        name: "Test Agent",
        email: "test-sorting@example.com",
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
      data: {
        fromName: "Alice Smith",
        fromEmail: "alice@example.com",
        subject: "Apple subject",
        body: "",
        status: TicketStatus.open,
        createdAt: earlier,
      },
    });
    const b = await prisma.ticket.create({
      data: {
        fromName: "Zara Jones",
        fromEmail: "zara@example.com",
        subject: "Zebra subject",
        body: "",
        status: TicketStatus.open,
        createdAt: now,
      },
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
    expect(ids.indexOf(createdTicketIds[1])).toBeLessThan(
      ids.indexOf(createdTicketIds[0]),
    );
  });

  it("sorts by subject asc", async () => {
    const res = await request(app)
      .get("/api/tickets?sortBy=subject&sortOrder=asc")
      .set("Cookie", authCookie);
    expect(res.status).toBe(200);
    const ids = (res.body.data as { id: number }[]).map((t) => t.id);
    // createdTicketIds[0] = "Apple subject", should appear before createdTicketIds[1] = "ZZZ subject"
    expect(ids.indexOf(createdTicketIds[0])).toBeLessThan(
      ids.indexOf(createdTicketIds[1]),
    );
  });

  it("sorts by subject desc", async () => {
    const res = await request(app)
      .get("/api/tickets?sortBy=subject&sortOrder=desc")
      .set("Cookie", authCookie);
    expect(res.status).toBe(200);
    const ids = (res.body.data as { id: number }[]).map((t) => t.id);
    // createdTicketIds[1] = "Zebra subject", should appear before createdTicketIds[0] = "AAA subject"
    expect(ids.indexOf(createdTicketIds[1])).toBeLessThan(
      ids.indexOf(createdTicketIds[0]),
    );
  });

  it("sorts by fromName asc", async () => {
    const res = await request(app)
      .get("/api/tickets?sortBy=fromName&sortOrder=asc")
      .set("Cookie", authCookie);
    expect(res.status).toBe(200);
    const ids = (res.body.data as { id: number }[]).map((t) => t.id);
    // createdTicketIds[0] = "Alice Smith", should appear before createdTicketIds[1] = "Zara Jones"
    expect(ids.indexOf(createdTicketIds[0])).toBeLessThan(
      ids.indexOf(createdTicketIds[1]),
    );
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
      data: {
        fromName: "Filter Test",
        fromEmail: "filter@example.com",
        subject: "Open ticket",
        body: "",
        status: TicketStatus.open,
      },
    });
    const resolvedTicket = await prisma.ticket.create({
      data: {
        fromName: "Filter Test",
        fromEmail: "filter@example.com",
        subject: "Resolved ticket",
        body: "",
        status: TicketStatus.resolved,
      },
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

  it("includes triaging tickets in the default list", async () => {
    const newTicket = await prisma.ticket.create({
      data: {
        fromName: "Triage Test",
        fromEmail: "triage@example.com",
        subject: "Fresh triaging",
        body: "",
        status: TicketStatus.new,
      },
    });
    const processingTicket = await prisma.ticket.create({
      data: {
        fromName: "Triage Test",
        fromEmail: "triage@example.com",
        subject: "AI processing",
        body: "",
        status: TicketStatus.processing,
      },
    });
    createdTicketIds.push(newTicket.id, processingTicket.id);

    const res = await request(app)
      .get("/api/tickets?pageSize=100")
      .set("Cookie", authCookie);
    expect(res.status).toBe(200);
    const ids = (res.body.data as { id: number }[]).map((t) => t.id);
    expect(ids).toContain(newTicket.id);
    expect(ids).toContain(processingTicket.id);
  });

  it("filters to only triaging tickets when status=triaging", async () => {
    const newTicket = await prisma.ticket.create({
      data: {
        fromName: "Triage Test",
        fromEmail: "triage@example.com",
        subject: "Fresh triaging",
        body: "",
        status: TicketStatus.new,
      },
    });
    const processingTicket = await prisma.ticket.create({
      data: {
        fromName: "Triage Test",
        fromEmail: "triage@example.com",
        subject: "AI processing",
        body: "",
        status: TicketStatus.processing,
      },
    });
    const openTicket = await prisma.ticket.create({
      data: {
        fromName: "Triage Test",
        fromEmail: "triage@example.com",
        subject: "Already open",
        body: "",
        status: TicketStatus.open,
      },
    });
    createdTicketIds.push(newTicket.id, processingTicket.id, openTicket.id);

    const res = await request(app)
      .get("/api/tickets?status=triaging&pageSize=100")
      .set("Cookie", authCookie);
    expect(res.status).toBe(200);
    const ids = (res.body.data as { id: number }[]).map((t) => t.id);
    expect(ids).toEqual(expect.arrayContaining([newTicket.id, processingTicket.id]));
    expect(ids).not.toContain(openTicket.id);
  });

  it("status=open excludes triaging tickets", async () => {
    const newTicket = await prisma.ticket.create({
      data: {
        fromName: "Triage Test",
        fromEmail: "triage@example.com",
        subject: "Fresh triaging",
        body: "",
        status: TicketStatus.new,
      },
    });
    const openTicket = await prisma.ticket.create({
      data: {
        fromName: "Triage Test",
        fromEmail: "triage@example.com",
        subject: "Already open",
        body: "",
        status: TicketStatus.open,
      },
    });
    createdTicketIds.push(newTicket.id, openTicket.id);

    const res = await request(app)
      .get(`/api/tickets?status=${TicketStatus.open}&pageSize=100`)
      .set("Cookie", authCookie);
    expect(res.status).toBe(200);
    const ids = (res.body.data as { id: number }[]).map((t) => t.id);
    expect(ids).toContain(openTicket.id);
    expect(ids).not.toContain(newTicket.id);
  });

  it("filters by category", async () => {
    const technicalTicket = await prisma.ticket.create({
      data: {
        fromName: "Filter Test",
        fromEmail: "filter@example.com",
        subject: "Technical ticket",
        body: "",
        status: TicketStatus.open,
        category: TicketCategory.technical_question,
      },
    });
    const refundTicket = await prisma.ticket.create({
      data: {
        fromName: "Filter Test",
        fromEmail: "filter@example.com",
        subject: "Refund ticket",
        body: "",
        status: TicketStatus.open,
        category: TicketCategory.refund_request,
      },
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

  it("filters by priority", async () => {
    const urgentTicket = await prisma.ticket.create({
      data: {
        fromName: "Filter Test",
        fromEmail: "filter@example.com",
        subject: "Urgent ticket",
        body: "",
        status: TicketStatus.open,
        priority: TicketPriority.urgent,
      },
    });
    const normalTicket = await prisma.ticket.create({
      data: {
        fromName: "Filter Test",
        fromEmail: "filter@example.com",
        subject: "Normal ticket",
        body: "",
        status: TicketStatus.open,
        priority: TicketPriority.normal,
      },
    });
    createdTicketIds.push(urgentTicket.id, normalTicket.id);

    const res = await request(app)
      .get(`/api/tickets?priority=${TicketPriority.urgent}`)
      .set("Cookie", authCookie);
    expect(res.status).toBe(200);
    const ids = (res.body.data as { id: number }[]).map((t) => t.id);
    expect(ids).toContain(urgentTicket.id);
    expect(ids).not.toContain(normalTicket.id);
  });

  it("sorts by priority asc and desc", async () => {
    const urgentTicket = await prisma.ticket.create({
      data: {
        fromName: "Sort Test",
        fromEmail: "sortprio@example.com",
        subject: "Sort prio urgent",
        body: "",
        status: TicketStatus.open,
        priority: TicketPriority.urgent,
      },
    });
    const lowTicket = await prisma.ticket.create({
      data: {
        fromName: "Sort Test",
        fromEmail: "sortprio@example.com",
        subject: "Sort prio low",
        body: "",
        status: TicketStatus.open,
        priority: TicketPriority.low,
      },
    });
    createdTicketIds.push(urgentTicket.id, lowTicket.id);

    const asc = await request(app)
      .get("/api/tickets?sortBy=priority&sortOrder=asc&pageSize=100")
      .set("Cookie", authCookie);
    expect(asc.status).toBe(200);
    const ascIds = (asc.body.data as { id: number }[]).map((t) => t.id);
    // Postgres enums sort by declaration order: low < normal < high < urgent.
    expect(ascIds.indexOf(lowTicket.id)).toBeLessThan(ascIds.indexOf(urgentTicket.id));

    const desc = await request(app)
      .get("/api/tickets?sortBy=priority&sortOrder=desc&pageSize=100")
      .set("Cookie", authCookie);
    expect(desc.status).toBe(200);
    const descIds = (desc.body.data as { id: number }[]).map((t) => t.id);
    expect(descIds.indexOf(urgentTicket.id)).toBeLessThan(descIds.indexOf(lowTicket.id));
  });

  it("returns priority defaulting to normal in the list payload", async () => {
    const res = await request(app)
      .get("/api/tickets?pageSize=100")
      .set("Cookie", authCookie);
    expect(res.status).toBe(200);
    const seed = (res.body.data as { id: number; priority: string }[]).find(
      (t) => t.id === createdTicketIds[0],
    );
    expect(seed?.priority).toBe(TicketPriority.normal);
  });

  it("includes assigneeType on every list row", async () => {
    const res = await request(app)
      .get("/api/tickets?pageSize=100")
      .set("Cookie", authCookie);
    expect(res.status).toBe(200);
    for (const row of res.body.data as { assigneeType: string }[]) {
      expect(["human", "ai", "none"]).toContain(row.assigneeType);
    }
    const seed = (res.body.data as { id: number; assigneeType: string }[]).find(
      (t) => t.id === createdTicketIds[0],
    );
    expect(seed?.assigneeType).toBe("none");
  });

  it("filters by search term across subject, fromName, and fromEmail", async () => {
    const matchTicket = await prisma.ticket.create({
      data: {
        fromName: "Unique Person",
        fromEmail: "unique@example.com",
        subject: "Unique subject",
        body: "",
        status: TicketStatus.open,
      },
    });
    const noMatchTicket = await prisma.ticket.create({
      data: {
        fromName: "Other Person",
        fromEmail: "other@example.com",
        subject: "Other subject",
        body: "",
        status: TicketStatus.open,
      },
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
      data: {
        fromName: "Alice Smith",
        fromEmail: "alice@example.com",
        subject: "Printer on fire",
        body: "",
        status: TicketStatus.open,
      },
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
      data: {
        id,
        name: "Detail Test Agent",
        email: "test-detail@example.com",
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
    expect(res.body.assigneeType).toBe("none");
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
    const res = await request(app).get("/api/tickets/abc").set("Cookie", authCookie);
    expect(res.status).toBe(400);
    expect(res.body.error).toBeTypeOf("string");
  });
});

describe("PATCH /api/tickets/:id", () => {
  let authCookie: string;
  let adminCookie: string;
  let testUserId: string;
  let assigneeId: string;
  let adminId: string;
  let aiUserId: string;
  let ticketId: number;

  beforeAll(async () => {
    const ctx = await auth.$context;
    const hashedPassword = await ctx.password.hash("Testpassword1!");
    const now = new Date();

    const actorId = generateId();
    await prisma.user.create({
      data: {
        id: actorId,
        name: "Patch Actor",
        email: "test-patch-actor@example.com",
        emailVerified: true,
        role: "agent",
        createdAt: now,
        updatedAt: now,
      },
    });
    await prisma.account.create({
      data: {
        id: generateId(),
        accountId: actorId,
        providerId: "credential",
        userId: actorId,
        password: hashedPassword,
        createdAt: now,
        updatedAt: now,
      },
    });
    testUserId = actorId;

    const signInRes = await request(app)
      .post("/api/auth/sign-in/email")
      .send({ email: "test-patch-actor@example.com", password: "Testpassword1!" });
    const cookies = signInRes.headers["set-cookie"] as string[] | string;
    authCookie = Array.isArray(cookies) ? cookies.join("; ") : cookies;

    const assigneeUserId = generateId();
    await prisma.user.create({
      data: {
        id: assigneeUserId,
        name: "Assignee Agent",
        email: "test-patch-assignee@example.com",
        emailVerified: true,
        role: "agent",
        createdAt: now,
        updatedAt: now,
      },
    });
    assigneeId = assigneeUserId;

    const adminUserId = generateId();
    await prisma.user.create({
      data: {
        id: adminUserId,
        name: "Patch Admin",
        email: "test-patch-admin@example.com",
        emailVerified: true,
        role: "admin",
        createdAt: now,
        updatedAt: now,
      },
    });
    await prisma.account.create({
      data: {
        id: generateId(),
        accountId: adminUserId,
        providerId: "credential",
        userId: adminUserId,
        password: hashedPassword,
        createdAt: now,
        updatedAt: now,
      },
    });
    adminId = adminUserId;

    const adminSignInRes = await request(app)
      .post("/api/auth/sign-in/email")
      .send({ email: "test-patch-admin@example.com", password: "Testpassword1!" });
    const adminCookies = adminSignInRes.headers["set-cookie"] as string[] | string;
    adminCookie = Array.isArray(adminCookies) ? adminCookies.join("; ") : adminCookies;

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
    await prisma.session.deleteMany({ where: { userId: testUserId } });
    await prisma.account.deleteMany({ where: { userId: testUserId } });
    await prisma.user.delete({ where: { id: testUserId } });
    await prisma.user.delete({ where: { id: assigneeId } });
    await prisma.session.deleteMany({ where: { userId: adminId } });
    await prisma.account.deleteMany({ where: { userId: adminId } });
    await prisma.user.delete({ where: { id: adminId } });
    await prisma.user.deleteMany({ where: { email: "ai@helpdesk.internal" } });
  });

  beforeEach(async () => {
    const ticket = await prisma.ticket.create({
      data: {
        fromName: "Patch Test",
        fromEmail: "patch@example.com",
        subject: "Patch subject",
        body: "",
        status: TicketStatus.open,
      },
    });
    ticketId = ticket.id;
  });

  afterEach(async () => {
    await prisma.ticket.deleteMany({ where: { id: ticketId } });
  });

  it("returns 401 when not authenticated", async () => {
    const res = await request(app)
      .patch(`/api/tickets/${ticketId}`)
      .send({ assignedToId: assigneeId });
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

  it("returns 400 when body has an invalid status value", async () => {
    const res = await request(app)
      .patch(`/api/tickets/${ticketId}`)
      .set("Cookie", authCookie)
      .send({ status: "invalid_status" });
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
    expect(res.body.assignedTo).toMatchObject({
      id: assigneeId,
      name: "Assignee Agent",
      email: "test-patch-assignee@example.com",
    });
  });

  it("unassigns the ticket when assignedToId is null", async () => {
    await prisma.ticket.update({
      where: { id: ticketId },
      data: { assignedToId: assigneeId },
    });

    const res = await request(app)
      .patch(`/api/tickets/${ticketId}`)
      .set("Cookie", authCookie)
      .send({ assignedToId: null });
    expect(res.status).toBe(200);
    expect(res.body.assignedToId).toBeNull();
    expect(res.body.assignedTo).toBeNull();
  });

  it("returns 200 and changes status from open to resolved", async () => {
    const res = await request(app)
      .patch(`/api/tickets/${ticketId}`)
      .set("Cookie", authCookie)
      .send({ status: TicketStatus.resolved });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe(TicketStatus.resolved);
  });

  it("returns 403 when non-admin tries to close an open ticket", async () => {
    const res = await request(app)
      .patch(`/api/tickets/${ticketId}`)
      .set("Cookie", authCookie)
      .send({ status: TicketStatus.closed });
    expect(res.status).toBe(403);
    expect(res.body.error).toBeTypeOf("string");
  });

  it("returns 422 when ticket is already closed (terminal state)", async () => {
    await prisma.ticket.update({
      where: { id: ticketId },
      data: { status: TicketStatus.closed },
    });

    const res = await request(app)
      .patch(`/api/tickets/${ticketId}`)
      .set("Cookie", authCookie)
      .send({ status: TicketStatus.resolved });
    expect(res.status).toBe(422);
    expect(res.body.error).toBeTypeOf("string");
  });

  it("returns 403 when agent tries to close a resolved ticket", async () => {
    await prisma.ticket.update({
      where: { id: ticketId },
      data: { status: TicketStatus.resolved },
    });

    const res = await request(app)
      .patch(`/api/tickets/${ticketId}`)
      .set("Cookie", authCookie)
      .send({ status: TicketStatus.closed });
    expect(res.status).toBe(403);
    expect(res.body.error).toBeTypeOf("string");
  });

  it("returns 200 when admin closes a resolved ticket", async () => {
    await prisma.ticket.update({
      where: { id: ticketId },
      data: { status: TicketStatus.resolved },
    });

    const res = await request(app)
      .patch(`/api/tickets/${ticketId}`)
      .set("Cookie", adminCookie)
      .send({ status: TicketStatus.closed });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe(TicketStatus.closed);
  });

  it("returns 200 when admin closes an open ticket directly", async () => {
    const res = await request(app)
      .patch(`/api/tickets/${ticketId}`)
      .set("Cookie", adminCookie)
      .send({ status: TicketStatus.closed });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe(TicketStatus.closed);
  });

  it("returns 200 when admin reopens a resolved ticket", async () => {
    await prisma.ticket.update({
      where: { id: ticketId },
      data: { status: TicketStatus.resolved },
    });

    const res = await request(app)
      .patch(`/api/tickets/${ticketId}`)
      .set("Cookie", adminCookie)
      .send({ status: TicketStatus.open });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe(TicketStatus.open);
  });

  it("returns 200 when admin reopens a closed ticket", async () => {
    await prisma.ticket.update({
      where: { id: ticketId },
      data: { status: TicketStatus.closed },
    });

    const res = await request(app)
      .patch(`/api/tickets/${ticketId}`)
      .set("Cookie", adminCookie)
      .send({ status: TicketStatus.open });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe(TicketStatus.open);
  });

  it("returns 422 when agent tries an invalid transition (resolved → open)", async () => {
    await prisma.ticket.update({
      where: { id: ticketId },
      data: { status: TicketStatus.resolved },
    });

    const res = await request(app)
      .patch(`/api/tickets/${ticketId}`)
      .set("Cookie", authCookie)
      .send({ status: TicketStatus.open });
    expect(res.status).toBe(422);
    expect(res.body.error).toBeTypeOf("string");
  });

  it("returns 200 and sets the category", async () => {
    const res = await request(app)
      .patch(`/api/tickets/${ticketId}`)
      .set("Cookie", authCookie)
      .send({ category: TicketCategory.billing_inquiry });
    expect(res.status).toBe(200);
    expect(res.body.category).toBe(TicketCategory.billing_inquiry);
  });

  it("returns 200 and sets the priority", async () => {
    const res = await request(app)
      .patch(`/api/tickets/${ticketId}`)
      .set("Cookie", authCookie)
      .send({ priority: TicketPriority.urgent });
    expect(res.status).toBe(200);
    expect(res.body.priority).toBe(TicketPriority.urgent);
  });

  it("returns 400 when priority is invalid", async () => {
    const res = await request(app)
      .patch(`/api/tickets/${ticketId}`)
      .set("Cookie", authCookie)
      .send({ priority: "ASAP" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeTypeOf("string");
  });

  it("returns 200 and clears the category", async () => {
    await prisma.ticket.update({
      where: { id: ticketId },
      data: { category: TicketCategory.refund_request },
    });

    const res = await request(app)
      .patch(`/api/tickets/${ticketId}`)
      .set("Cookie", authCookie)
      .send({ category: null });
    expect(res.status).toBe(200);
    expect(res.body.category).toBeNull();
  });

  it("returns 422 when trying to reassign a resolved ticket", async () => {
    await prisma.ticket.update({
      where: { id: ticketId },
      data: { status: TicketStatus.resolved, assignedToId: assigneeId },
    });

    const res = await request(app)
      .patch(`/api/tickets/${ticketId}`)
      .set("Cookie", adminCookie)
      .send({ assignedToId: null });
    expect(res.status).toBe(422);
    expect(res.body.error).toBeTypeOf("string");
  });

  it("returns 422 when trying to reassign a closed ticket", async () => {
    await prisma.ticket.update({
      where: { id: ticketId },
      data: { status: TicketStatus.closed, assignedToId: assigneeId },
    });

    const res = await request(app)
      .patch(`/api/tickets/${ticketId}`)
      .set("Cookie", adminCookie)
      .send({ assignedToId: assigneeId });
    expect(res.status).toBe(422);
    expect(res.body.error).toBeTypeOf("string");
  });

  it("auto-unassigns AI when admin reopens a resolved ticket assigned to AI", async () => {
    await prisma.ticket.update({
      where: { id: ticketId },
      data: { status: TicketStatus.resolved, assignedToId: aiUserId },
    });

    const res = await request(app)
      .patch(`/api/tickets/${ticketId}`)
      .set("Cookie", adminCookie)
      .send({ status: TicketStatus.open });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe(TicketStatus.open);
    expect(res.body.assignedToId).toBeNull();
  });

  it("preserves human assignment when admin reopens a resolved ticket assigned to a human", async () => {
    await prisma.ticket.update({
      where: { id: ticketId },
      data: { status: TicketStatus.resolved, assignedToId: assigneeId },
    });

    const res = await request(app)
      .patch(`/api/tickets/${ticketId}`)
      .set("Cookie", adminCookie)
      .send({ status: TicketStatus.open });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe(TicketStatus.open);
    expect(res.body.assignedToId).toBe(assigneeId);
  });

  it("auto-unassigns AI when admin reopens a closed ticket assigned to AI", async () => {
    await prisma.ticket.update({
      where: { id: ticketId },
      data: { status: TicketStatus.closed, assignedToId: aiUserId },
    });

    const res = await request(app)
      .patch(`/api/tickets/${ticketId}`)
      .set("Cookie", adminCookie)
      .send({ status: TicketStatus.open });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe(TicketStatus.open);
    expect(res.body.assignedToId).toBeNull();
  });

  it("creates a ticket_assigned notification for the new assignee", async () => {
    const res = await request(app)
      .patch(`/api/tickets/${ticketId}`)
      .set("Cookie", adminCookie)
      .send({ assignedToId: assigneeId });
    expect(res.status).toBe(200);

    const notif = await prisma.notification.findFirst({
      where: { userId: assigneeId, ticketId, type: NotificationType.ticket_assigned },
      include: { actor: { select: { id: true } } },
    });
    expect(notif).not.toBeNull();
    expect(notif!.actor?.id).toBe(adminId);
    await prisma.notification.deleteMany({ where: { userId: assigneeId } });
  });

  it("does not notify when an agent assigns the ticket to themselves", async () => {
    const res = await request(app)
      .patch(`/api/tickets/${ticketId}`)
      .set("Cookie", authCookie)
      .send({ assignedToId: testUserId });
    expect(res.status).toBe(200);

    const notif = await prisma.notification.findFirst({
      where: { userId: testUserId, ticketId },
    });
    expect(notif).toBeNull();
  });

  it("does not notify when the same assignee is re-set", async () => {
    await prisma.ticket.update({
      where: { id: ticketId },
      data: { assignedToId: assigneeId },
    });

    const res = await request(app)
      .patch(`/api/tickets/${ticketId}`)
      .set("Cookie", adminCookie)
      .send({ assignedToId: assigneeId });
    expect(res.status).toBe(200);

    const notifs = await prisma.notification.findMany({
      where: { userId: assigneeId, ticketId },
    });
    expect(notifs).toHaveLength(0);
  });
});

describe("GET /api/tickets/:id/replies", () => {
  let authCookie: string;
  let testUserId: string;
  let ticketId: number;

  beforeAll(async () => {
    const ctx = await auth.$context;
    const hashedPassword = await ctx.password.hash("Testpassword1!");
    const id = generateId();
    const now = new Date();

    await prisma.user.create({
      data: {
        id,
        name: "Replies Get Agent",
        email: "test-replies-get@example.com",
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
      .send({ email: "test-replies-get@example.com", password: "Testpassword1!" });
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
        fromName: "Replies Test",
        fromEmail: "replies@example.com",
        subject: "Reply subject",
        body: "",
      },
    });
    ticketId = ticket.id;
  });

  afterEach(async () => {
    await prisma.reply.deleteMany({ where: { ticketId } });
    await prisma.ticket.delete({ where: { id: ticketId } });
  });

  it("returns 401 when not authenticated", async () => {
    const res = await request(app).get(`/api/tickets/${ticketId}/replies`);
    expect(res.status).toBe(401);
  });

  it("returns 404 when ticket does not exist", async () => {
    const res = await request(app)
      .get("/api/tickets/999999999/replies")
      .set("Cookie", authCookie);
    expect(res.status).toBe(404);
    expect(res.body.error).toBeTypeOf("string");
  });

  it("returns 200 with an empty array when no replies exist", async () => {
    const res = await request(app)
      .get(`/api/tickets/${ticketId}/replies`)
      .set("Cookie", authCookie);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("returns replies ordered by createdAt asc", async () => {
    const now = new Date();
    const earlier = new Date(now.getTime() - 1000);
    const first = await prisma.reply.create({
      data: {
        ticketId,
        authorId: testUserId,
        senderType: "agent",
        body: "First reply",
        createdAt: earlier,
      },
    });
    const second = await prisma.reply.create({
      data: {
        ticketId,
        authorId: testUserId,
        senderType: "agent",
        body: "Second reply",
        createdAt: now,
      },
    });

    const res = await request(app)
      .get(`/api/tickets/${ticketId}/replies`)
      .set("Cookie", authCookie);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].id).toBe(first.id);
    expect(res.body[1].id).toBe(second.id);
  });
});

describe("POST /api/tickets/:id/replies", () => {
  let authCookie: string;
  let testUserId: string;
  let ticketId: number;

  beforeAll(async () => {
    const ctx = await auth.$context;
    const hashedPassword = await ctx.password.hash("Testpassword1!");
    const id = generateId();
    const now = new Date();

    await prisma.user.create({
      data: {
        id,
        name: "Replies Post Agent",
        email: "test-replies-post@example.com",
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
      .send({ email: "test-replies-post@example.com", password: "Testpassword1!" });
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
        fromName: "Post Reply Test",
        fromEmail: "postreply@example.com",
        subject: "Post reply subject",
        body: "",
      },
    });
    ticketId = ticket.id;
  });

  afterEach(async () => {
    await prisma.reply.deleteMany({ where: { ticketId } });
    await prisma.ticket.delete({ where: { id: ticketId } });
  });

  it("returns 401 when not authenticated", async () => {
    const res = await request(app)
      .post(`/api/tickets/${ticketId}/replies`)
      .send({ body: "Hello" });
    expect(res.status).toBe(401);
  });

  it("returns 400 for an empty body", async () => {
    const res = await request(app)
      .post(`/api/tickets/${ticketId}/replies`)
      .set("Cookie", authCookie)
      .send({ body: "" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeTypeOf("string");
  });

  it("returns 404 when ticket does not exist", async () => {
    const res = await request(app)
      .post("/api/tickets/999999999/replies")
      .set("Cookie", authCookie)
      .send({ body: "Hello" });
    expect(res.status).toBe(404);
    expect(res.body.error).toBeTypeOf("string");
  });

  it("returns 201 and creates a reply with senderType agent and author info", async () => {
    const res = await request(app)
      .post(`/api/tickets/${ticketId}/replies`)
      .set("Cookie", authCookie)
      .send({ body: "This is my reply." });
    expect(res.status).toBe(201);
    expect(res.body.ticketId).toBe(ticketId);
    expect(res.body.body).toBe("This is my reply.");
    expect(res.body.senderType).toBe("agent");
    expect(res.body.author).toMatchObject({ id: testUserId, name: "Replies Post Agent" });
    expect(typeof res.body.createdAt).toBe("string");
  });

  it("enqueues a send-reply-email job with the ticket's email and reply body", async () => {
    vi.mocked(boss.send).mockClear();

    await request(app)
      .post(`/api/tickets/${ticketId}/replies`)
      .set("Cookie", authCookie)
      .send({ body: "Here is your answer." });

    expect(vi.mocked(boss.send)).toHaveBeenCalledOnce();
    expect(vi.mocked(boss.send)).toHaveBeenCalledWith(
      SEND_REPLY_EMAIL_QUEUE,
      expect.objectContaining({
        to: "postreply@example.com",
        replyBody: "Here is your answer.",
      }),
      // Third arg is the pg-boss adapter for atomic enqueue in the same tx.
      expect.objectContaining({ db: expect.anything() }),
    );
  });

  it("rolls back the reply when the queue enqueue fails (atomicity)", async () => {
    vi.mocked(boss.send).mockClear();
    vi.mocked(boss.send).mockRejectedValueOnce(new Error("queue unreachable"));

    const repliesBefore = await prisma.reply.count({ where: { ticketId } });

    const res = await request(app)
      .post(`/api/tickets/${ticketId}/replies`)
      .set("Cookie", authCookie)
      .send({ body: "This reply must NOT persist." });

    expect(res.status).toBe(500);

    const repliesAfter = await prisma.reply.count({ where: { ticketId } });
    expect(repliesAfter).toBe(repliesBefore);
  });

  it("bumps the parent ticket's updatedAt when an agent posts a reply", async () => {
    const before = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { updatedAt: true },
    });
    await new Promise((r) => setTimeout(r, 5));

    await request(app)
      .post(`/api/tickets/${ticketId}/replies`)
      .set("Cookie", authCookie)
      .send({ body: "Bumping update timestamp." });

    const after = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { updatedAt: true },
    });
    expect(after!.updatedAt.getTime()).toBeGreaterThan(before!.updatedAt.getTime());
  });

  it("sets firstAgentReplyAt on the first agent reply and does not overwrite on subsequent replies", async () => {
    await request(app)
      .post(`/api/tickets/${ticketId}/replies`)
      .set("Cookie", authCookie)
      .send({ body: "First reply." });

    const afterFirst = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { firstAgentReplyAt: true },
    });
    expect(afterFirst!.firstAgentReplyAt).not.toBeNull();
    const firstTimestamp = afterFirst!.firstAgentReplyAt!.getTime();

    await new Promise((r) => setTimeout(r, 5));
    await request(app)
      .post(`/api/tickets/${ticketId}/replies`)
      .set("Cookie", authCookie)
      .send({ body: "Second reply." });

    const afterSecond = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: { firstAgentReplyAt: true },
    });
    expect(afterSecond!.firstAgentReplyAt!.getTime()).toBe(firstTimestamp);
  });
});

describe("POST /api/tickets/:id/polish-reply", () => {
  let authCookie: string;
  let testUserId: string;
  let ticketId: number;

  beforeAll(async () => {
    const ctx = await auth.$context;
    const hashedPassword = await ctx.password.hash("Testpassword1!");
    const id = generateId();
    const now = new Date();

    await prisma.user.create({
      data: {
        id,
        name: "Polish Test Agent",
        email: "test-polish@example.com",
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
      .send({ email: "test-polish@example.com", password: "Testpassword1!" });
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
        fromName: "Polish Test",
        fromEmail: "polish@example.com",
        subject: "Polish subject",
        body: "Help me please.",
      },
    });
    ticketId = ticket.id;
  });

  afterEach(async () => {
    await prisma.ticket.delete({ where: { id: ticketId } });
  });

  it("returns 401 when not authenticated", async () => {
    const res = await request(app)
      .post(`/api/tickets/${ticketId}/polish-reply`)
      .send({ body: "draft" });
    expect(res.status).toBe(401);
  });

  it("returns 400 for a non-numeric ticket ID", async () => {
    const res = await request(app)
      .post("/api/tickets/abc/polish-reply")
      .set("Cookie", authCookie)
      .send({ body: "draft" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeTypeOf("string");
  });

  it("returns 400 when body is empty", async () => {
    const res = await request(app)
      .post(`/api/tickets/${ticketId}/polish-reply`)
      .set("Cookie", authCookie)
      .send({ body: "" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeTypeOf("string");
  });

  it("returns 404 when ticket does not exist", async () => {
    const res = await request(app)
      .post("/api/tickets/999999999/polish-reply")
      .set("Cookie", authCookie)
      .send({ body: "draft" });
    expect(res.status).toBe(404);
    expect(res.body.error).toBeTypeOf("string");
  });

  it("returns 200 and the polished body on success", async () => {
    generateTextMock.mockResolvedValueOnce({ text: "Polished reply text." });

    const res = await request(app)
      .post(`/api/tickets/${ticketId}/polish-reply`)
      .set("Cookie", authCookie)
      .send({ body: "rough draft" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ body: "Polished reply text." });
  });

  it("returns 500 when the AI call fails", async () => {
    generateTextMock.mockRejectedValueOnce(new Error("Gemini down"));

    const res = await request(app)
      .post(`/api/tickets/${ticketId}/polish-reply`)
      .set("Cookie", authCookie)
      .send({ body: "rough draft" });

    expect(res.status).toBe(500);
  });
});

describe("POST /api/tickets/:id/summarize", () => {
  let authCookie: string;
  let testUserId: string;
  let ticketId: number;

  beforeAll(async () => {
    const ctx = await auth.$context;
    const hashedPassword = await ctx.password.hash("Testpassword1!");
    const id = generateId();
    const now = new Date();

    await prisma.user.create({
      data: {
        id,
        name: "Summarize Test Agent",
        email: "test-summarize@example.com",
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
      .send({ email: "test-summarize@example.com", password: "Testpassword1!" });
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
        fromName: "Summarize Test",
        fromEmail: "summarize@example.com",
        subject: "Summarize subject",
        body: "Help me please.",
      },
    });
    ticketId = ticket.id;
  });

  afterEach(async () => {
    await prisma.ticket.delete({ where: { id: ticketId } });
  });

  it("returns 401 when not authenticated", async () => {
    const res = await request(app).post(`/api/tickets/${ticketId}/summarize`);
    expect(res.status).toBe(401);
  });

  it("returns 400 for a non-numeric ticket ID", async () => {
    const res = await request(app)
      .post("/api/tickets/abc/summarize")
      .set("Cookie", authCookie);
    expect(res.status).toBe(400);
    expect(res.body.error).toBeTypeOf("string");
  });

  it("returns 404 when ticket does not exist", async () => {
    const res = await request(app)
      .post("/api/tickets/999999999/summarize")
      .set("Cookie", authCookie);
    expect(res.status).toBe(404);
    expect(res.body.error).toBeTypeOf("string");
  });

  it("returns 200 and the summary on success", async () => {
    generateTextMock.mockResolvedValueOnce({ text: "Ticket summary." });

    const res = await request(app)
      .post(`/api/tickets/${ticketId}/summarize`)
      .set("Cookie", authCookie);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ summary: "Ticket summary." });
  });

  it("returns 500 when the AI call fails", async () => {
    generateTextMock.mockRejectedValueOnce(new Error("Gemini down"));

    const res = await request(app)
      .post(`/api/tickets/${ticketId}/summarize`)
      .set("Cookie", authCookie);

    expect(res.status).toBe(500);
  });
});

describe("GET /api/tickets — assignee=me filter & /my-open-count", () => {
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
        name: "Me Agent",
        email: "test-me-agent@example.com",
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
      .send({ email: "test-me-agent@example.com", password: "Testpassword1!" });
    const cookies = signInRes.headers["set-cookie"] as string[] | string;
    meCookie = Array.isArray(cookies) ? cookies.join("; ") : cookies;

    otherId = generateId();
    await prisma.user.create({
      data: {
        id: otherId,
        name: "Other Agent",
        email: "test-other-agent@example.com",
        emailVerified: true,
        role: "agent",
        createdAt: now,
        updatedAt: now,
      },
    });
  });

  afterAll(async () => {
    await prisma.session.deleteMany({ where: { userId: meId } });
    await prisma.account.deleteMany({ where: { userId: meId } });
    await prisma.user.delete({ where: { id: meId } });
    await prisma.user.delete({ where: { id: otherId } });
  });

  afterEach(async () => {
    if (createdTicketIds.length > 0) {
      await prisma.ticket.deleteMany({ where: { id: { in: createdTicketIds } } });
      createdTicketIds = [];
    }
  });

  it("assignee=me returns only tickets assigned to the session user", async () => {
    const mine = await prisma.ticket.create({
      data: {
        fromName: "X",
        fromEmail: "x@example.com",
        subject: "Mine",
        body: "",
        status: TicketStatus.open,
        assignedToId: meId,
      },
    });
    const theirs = await prisma.ticket.create({
      data: {
        fromName: "Y",
        fromEmail: "y@example.com",
        subject: "Theirs",
        body: "",
        status: TicketStatus.open,
        assignedToId: otherId,
      },
    });
    const unassigned = await prisma.ticket.create({
      data: {
        fromName: "Z",
        fromEmail: "z@example.com",
        subject: "Unassigned",
        body: "",
        status: TicketStatus.open,
      },
    });
    createdTicketIds.push(mine.id, theirs.id, unassigned.id);

    const res = await request(app)
      .get("/api/tickets?assignee=me")
      .set("Cookie", meCookie);
    expect(res.status).toBe(200);
    const ids = (res.body.data as { id: number }[]).map((t) => t.id);
    expect(ids).toContain(mine.id);
    expect(ids).not.toContain(theirs.id);
    expect(ids).not.toContain(unassigned.id);
  });

  it("assignee=me returns an empty list when the user has no assignments", async () => {
    const theirs = await prisma.ticket.create({
      data: {
        fromName: "Y",
        fromEmail: "y@example.com",
        subject: "Theirs",
        body: "",
        status: TicketStatus.open,
        assignedToId: otherId,
      },
    });
    createdTicketIds.push(theirs.id);

    const res = await request(app)
      .get("/api/tickets?assignee=me")
      .set("Cookie", meCookie);
    expect(res.status).toBe(200);
    const ids = (res.body.data as { id: number }[]).map((t) => t.id);
    expect(ids).not.toContain(theirs.id);
    expect(res.body.total).toBe(0);
  });

  it("returns 400 for an unknown assignee value", async () => {
    const res = await request(app)
      .get("/api/tickets?assignee=somebody")
      .set("Cookie", meCookie);
    expect(res.status).toBe(400);
    expect(res.body.error).toBeTypeOf("string");
  });

  it("GET /my-open-count returns 401 when not authenticated", async () => {
    const res = await request(app).get("/api/tickets/my-open-count");
    expect(res.status).toBe(401);
  });

  it("GET /my-open-count counts only open tickets assigned to the session user", async () => {
    const openMine = await prisma.ticket.create({
      data: {
        fromName: "A",
        fromEmail: "a@example.com",
        subject: "Open mine",
        body: "",
        status: TicketStatus.open,
        assignedToId: meId,
      },
    });
    const resolvedMine = await prisma.ticket.create({
      data: {
        fromName: "B",
        fromEmail: "b@example.com",
        subject: "Resolved mine",
        body: "",
        status: TicketStatus.resolved,
        assignedToId: meId,
      },
    });
    const closedMine = await prisma.ticket.create({
      data: {
        fromName: "C",
        fromEmail: "c@example.com",
        subject: "Closed mine",
        body: "",
        status: TicketStatus.closed,
        assignedToId: meId,
      },
    });
    const openTheirs = await prisma.ticket.create({
      data: {
        fromName: "D",
        fromEmail: "d@example.com",
        subject: "Open theirs",
        body: "",
        status: TicketStatus.open,
        assignedToId: otherId,
      },
    });
    createdTicketIds.push(openMine.id, resolvedMine.id, closedMine.id, openTheirs.id);

    const res = await request(app)
      .get("/api/tickets/my-open-count")
      .set("Cookie", meCookie);
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(1);
  });
});
