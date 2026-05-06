import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { generateId } from "better-auth";
import app from "../app";
import { auth } from "../lib/auth";
import { prisma } from "../lib/prisma";

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
    expect(Array.isArray(res.body)).toBe(true);
    const ids = (res.body as { id: number }[]).map((t) => t.id);
    expect(ids.indexOf(createdTicketIds[1])).toBeLessThan(ids.indexOf(createdTicketIds[0]));
  });

  it("sorts by subject asc", async () => {
    const res = await request(app)
      .get("/api/tickets?sortBy=subject&sortOrder=asc")
      .set("Cookie", authCookie);
    expect(res.status).toBe(200);
    const ids = (res.body as { id: number }[]).map((t) => t.id);
    // createdTicketIds[0] = "Apple subject", should appear before createdTicketIds[1] = "ZZZ subject"
    expect(ids.indexOf(createdTicketIds[0])).toBeLessThan(ids.indexOf(createdTicketIds[1]));
  });

  it("sorts by subject desc", async () => {
    const res = await request(app)
      .get("/api/tickets?sortBy=subject&sortOrder=desc")
      .set("Cookie", authCookie);
    expect(res.status).toBe(200);
    const ids = (res.body as { id: number }[]).map((t) => t.id);
    // createdTicketIds[1] = "Zebra subject", should appear before createdTicketIds[0] = "AAA subject"
    expect(ids.indexOf(createdTicketIds[1])).toBeLessThan(ids.indexOf(createdTicketIds[0]));
  });

  it("sorts by fromName asc", async () => {
    const res = await request(app)
      .get("/api/tickets?sortBy=fromName&sortOrder=asc")
      .set("Cookie", authCookie);
    expect(res.status).toBe(200);
    const ids = (res.body as { id: number }[]).map((t) => t.id);
    // createdTicketIds[0] = "Alice Smith", should appear before createdTicketIds[1] = "Zara Jones"
    expect(ids.indexOf(createdTicketIds[0])).toBeLessThan(ids.indexOf(createdTicketIds[1]));
  });

  it("returns 400 for an invalid sortBy value", async () => {
    const res = await request(app)
      .get("/api/tickets?sortBy=INVALID")
      .set("Cookie", authCookie);
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it("returns 400 for an invalid sortOrder value", async () => {
    const res = await request(app)
      .get("/api/tickets?sortBy=subject&sortOrder=sideways")
      .set("Cookie", authCookie);
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });
});
