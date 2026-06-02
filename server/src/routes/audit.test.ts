import { AuditEventType } from "@helpdesk/core";
import { generateId } from "better-auth";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import app from "../app";
import { initAiUserId } from "../lib/ai-user";
import { auth } from "../lib/auth";
import { prisma } from "../lib/prisma";

// Stable timestamps for the date-range assertions (UTC, deterministic).
const D_CREATED = new Date("2026-05-05T10:00:00Z"); // system (null actor)
const D_STATUS = new Date("2026-05-01T10:00:00Z"); // human actor
const D_REPLY = new Date("2026-05-10T10:00:00Z"); // human actor
const D_ASSIGN = new Date("2026-05-20T10:00:00Z"); // human actor
const D_AI = new Date("2026-05-15T10:00:00Z"); // AI actor
const D_DELETED = new Date("2026-05-25T10:00:00Z"); // deleted human → folds to system

describe("GET /api/audit-events", () => {
  let adminCookie: string;
  let agentCookie: string;
  let adminId: string;
  let agentId: string;
  let actorId: string; // dedicated human actor for deterministic per-actor queries
  let aiUserId: string;
  let ticketId: number;
  // ids of the human-actor events, for ordering assertions
  let statusEventId: string;
  let deletedActorEventId: string;
  let systemEventId: string;
  let aiEventId: string;

  async function createUser(email: string, role: "admin" | "agent"): Promise<string> {
    const ctx = await auth.$context;
    const hashedPassword = await ctx.password.hash("Testpassword1!");
    const now = new Date();
    const id = generateId();
    await prisma.user.create({
      data: {
        id,
        name: email,
        email,
        emailVerified: true,
        role,
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
    return id;
  }

  async function signIn(email: string): Promise<string> {
    const res = await request(app)
      .post("/api/auth/sign-in/email")
      .send({ email, password: "Testpassword1!" });
    const cookies = res.headers["set-cookie"] as string[] | string;
    return Array.isArray(cookies) ? cookies.join("; ") : cookies;
  }

  beforeAll(async () => {
    adminId = await createUser("test-audit-admin@example.com", "admin");
    agentId = await createUser("test-audit-agent@example.com", "agent");
    adminCookie = await signIn("test-audit-admin@example.com");
    agentCookie = await signIn("test-audit-agent@example.com");

    // Dedicated human actor (no credential) — used as the deterministic filter.
    actorId = await createUser("test-audit-actor@example.com", "agent");

    const now = new Date();
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
    aiUserId = (await prisma.user.findUnique({
      where: { email: "ai@helpdesk.internal" },
    }))!.id;
    await initAiUserId();

    const ticket = await prisma.ticket.create({
      data: {
        fromName: "Audit Test",
        fromEmail: "audit-test@example.com",
        subject: "Audit log test ticket",
        body: "body",
      },
    });
    ticketId = ticket.id;

    // A user that will be deleted so its event folds into the System filter.
    const tempActorId = await createUser("test-audit-temp@example.com", "agent");

    const made = await prisma.$transaction([
      prisma.auditEvent.create({
        data: {
          ticketId,
          actorId,
          type: AuditEventType.status_changed,
          createdAt: D_STATUS,
        },
      }),
      prisma.auditEvent.create({
        data: { ticketId, actorId, type: AuditEventType.reply_added, createdAt: D_REPLY },
      }),
      prisma.auditEvent.create({
        data: {
          ticketId,
          actorId,
          type: AuditEventType.assignee_changed,
          createdAt: D_ASSIGN,
        },
      }),
      prisma.auditEvent.create({
        data: {
          ticketId,
          actorId: aiUserId,
          type: AuditEventType.auto_resolved,
          createdAt: D_AI,
        },
      }),
      prisma.auditEvent.create({
        data: {
          ticketId,
          actorId: null,
          type: AuditEventType.ticket_created,
          createdAt: D_CREATED,
        },
      }),
      prisma.auditEvent.create({
        data: {
          ticketId,
          actorId: tempActorId,
          type: AuditEventType.priority_changed,
          createdAt: D_DELETED,
        },
      }),
    ]);
    statusEventId = made[0].id;
    aiEventId = made[3].id;
    systemEventId = made[4].id;
    deletedActorEventId = made[5].id;

    // Delete the temp actor → its event's actorId is SetNull (folds into System).
    await prisma.user.delete({ where: { id: tempActorId } });
  });

  afterAll(async () => {
    await prisma.ticket.delete({ where: { id: ticketId } }); // cascades audit events
    for (const id of [adminId, agentId, actorId]) {
      await prisma.session.deleteMany({ where: { userId: id } });
      await prisma.account.deleteMany({ where: { userId: id } });
      await prisma.user.delete({ where: { id } });
    }
    await prisma.user.deleteMany({ where: { email: "ai@helpdesk.internal" } });
  });

  it("returns 401 when not authenticated", async () => {
    const res = await request(app).get("/api/audit-events");
    expect(res.status).toBe(401);
  });

  it("returns 403 for a non-admin agent", async () => {
    const res = await request(app).get("/api/audit-events").set("Cookie", agentCookie);
    expect(res.status).toBe(403);
  });

  it("returns paginated shape and newest-first ordering", async () => {
    const res = await request(app)
      .get("/api/audit-events")
      .query({ actorId })
      .set("Cookie", adminCookie);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(3);
    expect(res.body.page).toBe(1);
    expect(typeof res.body.pageSize).toBe("number");
    expect(res.body.data.map((e: { type: string }) => e.type)).toEqual([
      AuditEventType.assignee_changed,
      AuditEventType.reply_added,
      AuditEventType.status_changed,
    ]);
    expect(res.body.data[0].actorName).toBe("test-audit-actor@example.com");
    expect(res.body.data[0].ticketSubject).toBe("Audit log test ticket");
  });

  it("filters by event type", async () => {
    const res = await request(app)
      .get("/api/audit-events")
      .query({ actorId, type: AuditEventType.status_changed })
      .set("Cookie", adminCookie);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.data[0].id).toBe(statusEventId);
  });

  it("filters by actorId=ai (server-resolved)", async () => {
    const res = await request(app)
      .get("/api/audit-events")
      .query({ actorId: "ai" })
      .set("Cookie", adminCookie);
    expect(res.status).toBe(200);
    const ids = res.body.data.map((e: { id: string }) => e.id);
    expect(ids).toContain(aiEventId);
    for (const row of res.body.data) expect(row.actorName).toBe("AI");
  });

  it("filters by actorId=system, including a deleted actor's events", async () => {
    const res = await request(app)
      .get("/api/audit-events")
      .query({ actorId: "system" })
      .set("Cookie", adminCookie);
    expect(res.status).toBe(200);
    const ids = res.body.data.map((e: { id: string }) => e.id);
    expect(ids).toContain(systemEventId);
    expect(ids).toContain(deletedActorEventId);
    for (const row of res.body.data) expect(row.actorName).toBeNull();
  });

  it("treats the date range as inclusive of the `to` day", async () => {
    const res = await request(app)
      .get("/api/audit-events")
      .query({ actorId, from: "2026-05-10", to: "2026-05-10" })
      .set("Cookie", adminCookie);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.data[0].type).toBe(AuditEventType.reply_added);
  });

  it("paginates with a stable total", async () => {
    const page1 = await request(app)
      .get("/api/audit-events")
      .query({ actorId, pageSize: 2, page: 1 })
      .set("Cookie", adminCookie);
    const page2 = await request(app)
      .get("/api/audit-events")
      .query({ actorId, pageSize: 2, page: 2 })
      .set("Cookie", adminCookie);
    expect(page1.body.total).toBe(3);
    expect(page2.body.total).toBe(3);
    expect(page1.body.data).toHaveLength(2);
    expect(page2.body.data).toHaveLength(1);
  });

  it("returns 400 on an invalid pageSize", async () => {
    const res = await request(app)
      .get("/api/audit-events")
      .query({ pageSize: 0 })
      .set("Cookie", adminCookie);
    expect(res.status).toBe(400);
  });

  it("returns an empty result when nothing matches", async () => {
    const res = await request(app)
      .get("/api/audit-events")
      .query({ actorId, type: AuditEventType.auto_closed })
      .set("Cookie", adminCookie);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(0);
    expect(res.body.data).toEqual([]);
  });
});
