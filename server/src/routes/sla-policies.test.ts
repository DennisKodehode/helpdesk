import { TicketPriority } from "@helpdesk/core";
import { generateId } from "better-auth";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import app from "../app";
import { auth } from "../lib/auth";
import { prisma } from "../lib/prisma";
import { seedSlaPolicies } from "../lib/sla-defaults";

describe("sla-policies API", () => {
  let agentId: string;
  let adminId: string;
  let agentCookie: string;
  let adminCookie: string;

  beforeAll(async () => {
    await seedSlaPolicies();
    const ctx = await auth.$context;
    const hashedPassword = await ctx.password.hash("Testpassword1!");
    const now = new Date();

    agentId = generateId();
    await prisma.user.create({
      data: {
        id: agentId,
        name: "SLA Test Agent",
        email: "sla-route-agent@example.com",
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
    const agentSignIn = await request(app)
      .post("/api/auth/sign-in/email")
      .send({ email: "sla-route-agent@example.com", password: "Testpassword1!" });
    const agentCookies = agentSignIn.headers["set-cookie"] as string[] | string;
    agentCookie = Array.isArray(agentCookies) ? agentCookies.join("; ") : agentCookies;

    adminId = generateId();
    await prisma.user.create({
      data: {
        id: adminId,
        name: "SLA Test Admin",
        email: "sla-route-admin@example.com",
        emailVerified: true,
        role: "admin",
        createdAt: now,
        updatedAt: now,
      },
    });
    await prisma.account.create({
      data: {
        id: generateId(),
        accountId: adminId,
        providerId: "credential",
        userId: adminId,
        password: hashedPassword,
        createdAt: now,
        updatedAt: now,
      },
    });
    const adminSignIn = await request(app)
      .post("/api/auth/sign-in/email")
      .send({ email: "sla-route-admin@example.com", password: "Testpassword1!" });
    const adminCookies = adminSignIn.headers["set-cookie"] as string[] | string;
    adminCookie = Array.isArray(adminCookies) ? adminCookies.join("; ") : adminCookies;
  });

  afterAll(async () => {
    await prisma.session.deleteMany({ where: { userId: { in: [agentId, adminId] } } });
    await prisma.account.deleteMany({ where: { userId: { in: [agentId, adminId] } } });
    await prisma.user.deleteMany({ where: { id: { in: [agentId, adminId] } } });
    // Restore default policy values in case a test mutated them. Idempotent.
    await seedSlaPolicies();
    await prisma.slaPolicy.update({
      where: { priority: TicketPriority.urgent },
      data: { firstResponseMinutes: 60, resolutionMinutes: 240 },
    });
  });

  describe("GET /api/sla-policies", () => {
    it("returns 401 when not authenticated", async () => {
      const res = await request(app).get("/api/sla-policies");
      expect(res.status).toBe(401);
    });

    it("returns all four policies for an authenticated agent (admin not required)", async () => {
      const res = await request(app).get("/api/sla-policies").set("Cookie", agentCookie);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body).toHaveLength(4);
      const priorities = res.body.map((p: { priority: string }) => p.priority).sort();
      expect(priorities).toEqual(["high", "low", "normal", "urgent"]);
      const urgent = res.body.find(
        (p: { priority: string }) => p.priority === TicketPriority.urgent,
      );
      expect(urgent.firstResponseMinutes).toBe(60);
      expect(urgent.resolutionMinutes).toBe(240);
      expect(typeof urgent.updatedAt).toBe("string");
    });
  });

  describe("PATCH /api/sla-policies/:priority", () => {
    it("returns 401 when not authenticated", async () => {
      const res = await request(app)
        .patch(`/api/sla-policies/${TicketPriority.urgent}`)
        .send({ firstResponseMinutes: 30 });
      expect(res.status).toBe(401);
    });

    it("returns 403 when authenticated as a non-admin agent", async () => {
      const res = await request(app)
        .patch(`/api/sla-policies/${TicketPriority.urgent}`)
        .set("Cookie", agentCookie)
        .send({ firstResponseMinutes: 30 });
      expect(res.status).toBe(403);
    });

    it("returns 404 for an unknown priority value", async () => {
      const res = await request(app)
        .patch("/api/sla-policies/nonsense")
        .set("Cookie", adminCookie)
        .send({ firstResponseMinutes: 30 });
      expect(res.status).toBe(404);
    });

    it("returns 400 when both minutes fields are omitted", async () => {
      const res = await request(app)
        .patch(`/api/sla-policies/${TicketPriority.urgent}`)
        .set("Cookie", adminCookie)
        .send({});
      expect(res.status).toBe(400);
      expect(typeof res.body.error).toBe("string");
    });

    it("returns 400 when firstResponseMinutes is negative", async () => {
      const res = await request(app)
        .patch(`/api/sla-policies/${TicketPriority.urgent}`)
        .set("Cookie", adminCookie)
        .send({ firstResponseMinutes: -1 });
      expect(res.status).toBe(400);
    });

    it("returns 400 when firstResponseMinutes is not an integer", async () => {
      const res = await request(app)
        .patch(`/api/sla-policies/${TicketPriority.urgent}`)
        .set("Cookie", adminCookie)
        .send({ firstResponseMinutes: 5.5 });
      expect(res.status).toBe(400);
    });

    it("updates firstResponseMinutes when admin sends a valid payload", async () => {
      const res = await request(app)
        .patch(`/api/sla-policies/${TicketPriority.urgent}`)
        .set("Cookie", adminCookie)
        .send({ firstResponseMinutes: 45 });
      expect(res.status).toBe(200);
      expect(res.body.firstResponseMinutes).toBe(45);
      // Resolution minutes untouched.
      expect(res.body.resolutionMinutes).toBe(240);
      const refreshed = await prisma.slaPolicy.findUnique({
        where: { priority: TicketPriority.urgent },
      });
      expect(refreshed!.firstResponseMinutes).toBe(45);
    });

    it("accepts null to drop the resolution target", async () => {
      const res = await request(app)
        .patch(`/api/sla-policies/${TicketPriority.urgent}`)
        .set("Cookie", adminCookie)
        .send({ resolutionMinutes: null });
      expect(res.status).toBe(200);
      expect(res.body.resolutionMinutes).toBeNull();
    });
  });
});
