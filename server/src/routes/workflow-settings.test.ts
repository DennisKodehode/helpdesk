import { AutoAssignMode, NotificationType, TicketStatus } from "@helpdesk/core";
import { generateId } from "better-auth";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import app from "../app";
import { auth } from "../lib/auth";
import { prisma } from "../lib/prisma";
import {
  seedWorkflowSettings,
  WORKFLOW_SETTINGS_DEFAULTS,
  WORKFLOW_SETTINGS_ID,
} from "../lib/workflow-settings";

describe("workflow-settings API", () => {
  let agentId: string;
  let adminId: string;
  let agentCookie: string;
  let adminCookie: string;

  async function createUserWithSession(role: "agent" | "admin", email: string) {
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
    const signIn = await request(app)
      .post("/api/auth/sign-in/email")
      .send({ email, password: "Testpassword1!" });
    const cookies = signIn.headers["set-cookie"] as string[] | string;
    return { id, cookie: Array.isArray(cookies) ? cookies.join("; ") : cookies };
  }

  beforeAll(async () => {
    await seedWorkflowSettings();
    const agent = await createUserWithSession("agent", "wf-route-agent@example.com");
    agentId = agent.id;
    agentCookie = agent.cookie;
    const admin = await createUserWithSession("admin", "wf-route-admin@example.com");
    adminId = admin.id;
    adminCookie = admin.cookie;
  });

  afterAll(async () => {
    await prisma.session.deleteMany({ where: { userId: { in: [agentId, adminId] } } });
    await prisma.account.deleteMany({ where: { userId: { in: [agentId, adminId] } } });
    await prisma.user.deleteMany({ where: { id: { in: [agentId, adminId] } } });
    // Restore defaults in case a test mutated the singleton.
    await prisma.workflowSettings.upsert({
      where: { id: WORKFLOW_SETTINGS_ID },
      create: { id: WORKFLOW_SETTINGS_ID, ...WORKFLOW_SETTINGS_DEFAULTS },
      update: { ...WORKFLOW_SETTINGS_DEFAULTS },
    });
  });

  describe("GET /api/workflow-settings", () => {
    it("returns 401 when not authenticated", async () => {
      const res = await request(app).get("/api/workflow-settings");
      expect(res.status).toBe(401);
    });

    it("returns the settings shape for an authenticated agent (admin not required)", async () => {
      const res = await request(app)
        .get("/api/workflow-settings")
        .set("Cookie", agentCookie);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        autoAssignOn: expect.any(Boolean),
        autoAssignMode: expect.any(String),
        autoResolveOn: expect.any(Boolean),
        autoResolveThreshold: expect.any(Number),
        requireCategory: expect.any(Boolean),
        requireAssignee: expect.any(Boolean),
        autoCloseOn: expect.any(Boolean),
        autoCloseDays: expect.any(Number),
        reopenOnReply: expect.any(Boolean),
        lockClosed: expect.any(Boolean),
        slaGreenMin: expect.any(Number),
        slaYellowMin: expect.any(Number),
      });
      expect(typeof res.body.updatedAt).toBe("string");
      // Internal round-robin cursor is never exposed.
      expect(res.body).not.toHaveProperty("roundRobinCursor");
    });
  });

  describe("PATCH /api/workflow-settings", () => {
    it("returns 401 when not authenticated", async () => {
      const res = await request(app)
        .patch("/api/workflow-settings")
        .send({ autoAssignOn: true });
      expect(res.status).toBe(401);
    });

    it("returns 403 for a non-admin agent", async () => {
      const res = await request(app)
        .patch("/api/workflow-settings")
        .set("Cookie", agentCookie)
        .send({ autoAssignOn: true });
      expect(res.status).toBe(403);
    });

    it("returns 400 for an empty body", async () => {
      const res = await request(app)
        .patch("/api/workflow-settings")
        .set("Cookie", adminCookie)
        .send({});
      expect(res.status).toBe(400);
      expect(typeof res.body.error).toBe("string");
    });

    it("returns 400 when autoResolveThreshold is out of range", async () => {
      const res = await request(app)
        .patch("/api/workflow-settings")
        .set("Cookie", adminCookie)
        .send({ autoResolveThreshold: 30 });
      expect(res.status).toBe(400);
    });

    it("returns 400 for an unknown autoAssignMode", async () => {
      const res = await request(app)
        .patch("/api/workflow-settings")
        .set("Cookie", adminCookie)
        .send({ autoAssignMode: "spread_evenly" });
      expect(res.status).toBe(400);
    });

    it("updates a subset of fields and persists them", async () => {
      const res = await request(app)
        .patch("/api/workflow-settings")
        .set("Cookie", adminCookie)
        .send({
          autoAssignOn: true,
          autoAssignMode: AutoAssignMode.least_loaded,
          autoResolveThreshold: 92,
        });
      expect(res.status).toBe(200);
      expect(res.body.autoAssignOn).toBe(true);
      expect(res.body.autoAssignMode).toBe(AutoAssignMode.least_loaded);
      expect(res.body.autoResolveThreshold).toBe(92);
      // Untouched fields keep their values.
      expect(res.body.requireCategory).toBe(true);

      const row = await prisma.workflowSettings.findUnique({
        where: { id: WORKFLOW_SETTINGS_ID },
      });
      expect(row!.autoAssignOn).toBe(true);
      expect(row!.autoResolveThreshold).toBe(92);
    });

    it("returns 400 when slaGreenMin is out of range", async () => {
      const res = await request(app)
        .patch("/api/workflow-settings")
        .set("Cookie", adminCookie)
        .send({ slaGreenMin: 150 });
      expect(res.status).toBe(400);
    });

    it("returns 400 when both thresholds are sent inverted", async () => {
      const res = await request(app)
        .patch("/api/workflow-settings")
        .set("Cookie", adminCookie)
        .send({ slaGreenMin: 50, slaYellowMin: 60 });
      expect(res.status).toBe(400);
    });

    it("returns 400 when a single-field patch inverts the merged ordering", async () => {
      // Green is 90 (default); raising yellow to 95 alone breaks green > yellow.
      const res = await request(app)
        .patch("/api/workflow-settings")
        .set("Cookie", adminCookie)
        .send({ slaYellowMin: 95 });
      expect(res.status).toBe(400);
    });

    it("backfills open, unassigned tickets when saved with auto-assign on", async () => {
      // The seeded route-agent is the only active human agent here, so round-robin
      // hands this ticket to them.
      const ticket = await prisma.ticket.create({
        data: {
          fromName: "Backfill",
          fromEmail: "backfill@example.com",
          subject: "Needs an owner",
          body: "",
          status: TicketStatus.open,
          assignedToId: null,
        },
      });

      const res = await request(app)
        .patch("/api/workflow-settings")
        .set("Cookie", adminCookie)
        .send({ autoAssignOn: true, autoAssignMode: AutoAssignMode.round_robin });
      expect(res.status).toBe(200);
      expect(res.body.assignedCount).toBeGreaterThanOrEqual(1);

      const row = await prisma.ticket.findUnique({ where: { id: ticket.id } });
      expect(row!.assignedToId).toBe(agentId);

      const notif = await prisma.notification.findFirst({
        where: { ticketId: ticket.id, type: NotificationType.ticket_assigned },
      });
      expect(notif).not.toBeNull();

      // Cleanup the ticket and its derived rows.
      await prisma.notification.deleteMany({ where: { ticketId: ticket.id } });
      await prisma.auditEvent.deleteMany({ where: { ticketId: ticket.id } });
      await prisma.ticket.delete({ where: { id: ticket.id } });
    });

    it("updates the compliance thresholds and persists them", async () => {
      const res = await request(app)
        .patch("/api/workflow-settings")
        .set("Cookie", adminCookie)
        .send({ slaGreenMin: 80, slaYellowMin: 50 });
      expect(res.status).toBe(200);
      expect(res.body.slaGreenMin).toBe(80);
      expect(res.body.slaYellowMin).toBe(50);

      const row = await prisma.workflowSettings.findUnique({
        where: { id: WORKFLOW_SETTINGS_ID },
      });
      expect(row!.slaGreenMin).toBe(80);
      expect(row!.slaYellowMin).toBe(50);
    });
  });
});
