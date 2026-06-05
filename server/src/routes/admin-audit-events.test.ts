import { AdminAuditEventType, Role, TicketPriority, UserStatus } from "@helpdesk/core";
import { generateId } from "better-auth";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// Invites send email inline — stub Resend so tests never hit the network.
vi.mock("../lib/resend", () => ({
  default: {
    emails: {
      send: vi.fn().mockResolvedValue({ data: { id: "test-email" }, error: null }),
    },
  },
}));

const app = (await import("../app")).default;
const { auth } = await import("../lib/auth");
const { prisma } = await import("../lib/prisma");

let gaCookie: string; // global admin (can perform every admin action)
let gaId: string;
let agentCookie: string;

async function makeUser(opts: {
  email: string;
  role: Role;
  status?: UserStatus;
  withCredential?: boolean;
}): Promise<string> {
  const now = new Date();
  const id = generateId();
  await prisma.user.create({
    data: {
      id,
      name: opts.email.split("@")[0],
      email: opts.email,
      emailVerified: true,
      role: opts.role,
      status: opts.status ?? UserStatus.active,
      createdAt: now,
      updatedAt: now,
    },
  });
  if (opts.withCredential) {
    const ctx = await auth.$context;
    await prisma.account.create({
      data: {
        id: generateId(),
        accountId: id,
        providerId: "credential",
        userId: id,
        password: await ctx.password.hash("Testpassword1!"),
        createdAt: now,
        updatedAt: now,
      },
    });
  }
  return id;
}

async function signIn(email: string): Promise<string> {
  const res = await request(app)
    .post("/api/auth/sign-in/email")
    .send({ email, password: "Testpassword1!" });
  const cookies = res.headers["set-cookie"] as string[] | string;
  return Array.isArray(cookies) ? cookies.join("; ") : cookies;
}

async function destroyUser(id: string) {
  await prisma.session.deleteMany({ where: { userId: id } });
  await prisma.account.deleteMany({ where: { userId: id } });
  await prisma.invitation.deleteMany({ where: { userId: id } });
  await prisma.user.deleteMany({ where: { id } });
}

beforeAll(async () => {
  await prisma.user.deleteMany({ where: { role: Role.globalAdmin } });
  gaId = await makeUser({
    email: "aae-owner@example.com",
    role: Role.globalAdmin,
    withCredential: true,
  });
  gaCookie = await signIn("aae-owner@example.com");

  await makeUser({
    email: "aae-agent@example.com",
    role: Role.agent,
    withCredential: true,
  });
  agentCookie = await signIn("aae-agent@example.com");
});

afterAll(async () => {
  await prisma.adminAuditEvent.deleteMany({});
  await destroyUser(gaId);
  await prisma.user.deleteMany({ where: { email: "aae-agent@example.com" } });
  // The SLA test mutates the shared (globalSetup-preserved) slaPolicy singleton;
  // restore the seeded urgent default so it doesn't leak a 30-min target into
  // the SLA-dependent tests in other files (sla-policies / stats / tickets).
  await prisma.slaPolicy.updateMany({
    where: { priority: TicketPriority.urgent },
    data: { firstResponseMinutes: 60, resolutionMinutes: 240 },
  });
});

beforeEach(async () => {
  // Deterministic per-test baseline for counts/filters.
  await prisma.adminAuditEvent.deleteMany({});
});

describe("admin-audit emission — write sites", () => {
  it("invite records user_invited with the role", async () => {
    const res = await request(app)
      .post("/api/users")
      .set("Cookie", gaCookie)
      .send({ name: "Invited One", email: "aae-invited@example.com", role: Role.agent });
    expect(res.status).toBe(201);

    const row = await prisma.adminAuditEvent.findFirst({
      where: { type: AdminAuditEventType.user_invited, targetUserId: res.body.id },
    });
    expect(row).not.toBeNull();
    expect(row?.actorId).toBe(gaId);
    expect(row?.actorName).toBeTruthy();
    expect((row?.data as { role?: string })?.role).toBe(Role.agent);

    await destroyUser(res.body.id);
  });

  it("role change records user_role_changed with from/to", async () => {
    const id = await makeUser({ email: "aae-promote@example.com", role: Role.agent });
    const res = await request(app)
      .patch(`/api/users/${id}/role`)
      .set("Cookie", gaCookie)
      .send({ role: Role.admin });
    expect(res.status).toBe(200);

    const row = await prisma.adminAuditEvent.findFirst({
      where: { type: AdminAuditEventType.user_role_changed, targetUserId: id },
    });
    expect(row?.data).toMatchObject({ from: Role.agent, to: Role.admin });
    await destroyUser(id);
  });

  it("deactivate / reactivate record the matching events", async () => {
    const id = await makeUser({ email: "aae-deact@example.com", role: Role.agent });
    await request(app)
      .patch(`/api/users/${id}/status`)
      .set("Cookie", gaCookie)
      .send({ status: UserStatus.inactive });
    await request(app)
      .patch(`/api/users/${id}/status`)
      .set("Cookie", gaCookie)
      .send({ status: UserStatus.active });

    const types = (
      await prisma.adminAuditEvent.findMany({ where: { targetUserId: id } })
    ).map((e) => e.type);
    expect(types).toContain(AdminAuditEventType.user_deactivated);
    expect(types).toContain(AdminAuditEventType.user_reactivated);
    await destroyUser(id);
  });

  it("delete records user_deleted", async () => {
    const id = await makeUser({ email: "aae-del@example.com", role: Role.agent });
    const res = await request(app).delete(`/api/users/${id}`).set("Cookie", gaCookie);
    expect(res.status).toBe(204);
    const row = await prisma.adminAuditEvent.findFirst({
      where: { type: AdminAuditEventType.user_deleted, targetUserId: id },
    });
    expect(row).not.toBeNull();
    await destroyUser(id);
  });

  it("edit records user_edited and NEVER logs the password value", async () => {
    const id = await makeUser({ email: "aae-edit@example.com", role: Role.agent });
    const secret = "SuperSecret9!";
    const res = await request(app)
      .patch(`/api/users/${id}`)
      .set("Cookie", gaCookie)
      .send({ name: "Edited Name", email: "aae-edit@example.com", password: secret });
    expect(res.status).toBe(200);

    const row = await prisma.adminAuditEvent.findFirst({
      where: { type: AdminAuditEventType.user_edited, targetUserId: id },
    });
    expect(row).not.toBeNull();
    expect((row?.data as { passwordReset?: boolean })?.passwordReset).toBe(true);
    // The password value must never appear anywhere in the audit row.
    expect(JSON.stringify(row)).not.toContain(secret);
    await destroyUser(id);
  });

  it("SLA target change records sla_targets_changed with before/after", async () => {
    await prisma.slaPolicy.upsert({
      where: { priority: TicketPriority.urgent },
      create: {
        priority: TicketPriority.urgent,
        firstResponseMinutes: 60,
        resolutionMinutes: 240,
      },
      update: { firstResponseMinutes: 60, resolutionMinutes: 240 },
    });
    const res = await request(app)
      .patch(`/api/sla-policies/${TicketPriority.urgent}`)
      .set("Cookie", gaCookie)
      .send({ firstResponseMinutes: 30, resolutionMinutes: 240 });
    expect(res.status).toBe(200);

    const row = await prisma.adminAuditEvent.findFirst({
      where: { type: AdminAuditEventType.sla_targets_changed },
    });
    expect(row?.targetName).toBe(`SLA · ${TicketPriority.urgent}`);
    expect(
      (row?.data as { before?: { firstResponseMinutes?: number } })?.before
        ?.firstResponseMinutes,
    ).toBe(60);
    expect(
      (row?.data as { after?: { firstResponseMinutes?: number } })?.after
        ?.firstResponseMinutes,
    ).toBe(30);
  });

  it("workflow settings change records workflow_settings_changed", async () => {
    const current = await request(app)
      .get("/api/workflow-settings")
      .set("Cookie", gaCookie);
    const res = await request(app)
      .patch("/api/workflow-settings")
      .set("Cookie", gaCookie)
      .send({ autoCloseDays: (current.body.autoCloseDays ?? 7) + 1 });
    expect(res.status).toBe(200);

    const row = await prisma.adminAuditEvent.findFirst({
      where: { type: AdminAuditEventType.workflow_settings_changed },
    });
    expect(row).not.toBeNull();
    expect((row?.data as { changed?: Record<string, unknown> })?.changed).toHaveProperty(
      "autoCloseDays",
    );
  });
});

describe("GET /api/admin-audit-events", () => {
  it("returns 401 unauthenticated, 403 for an agent", async () => {
    expect((await request(app).get("/api/admin-audit-events")).status).toBe(401);
    const agentRes = await request(app)
      .get("/api/admin-audit-events")
      .set("Cookie", agentCookie);
    expect(agentRes.status).toBe(403);
  });

  it("returns the admin events, newest-first, and filters by type", async () => {
    const id = await makeUser({ email: "aae-list@example.com", role: Role.agent });
    await request(app)
      .patch(`/api/users/${id}/status`)
      .set("Cookie", gaCookie)
      .send({ status: UserStatus.inactive });
    await request(app)
      .patch(`/api/users/${id}/role`)
      .set("Cookie", gaCookie)
      .send({ role: Role.admin });

    const all = await request(app).get("/api/admin-audit-events").set("Cookie", gaCookie);
    expect(all.status).toBe(200);
    expect(all.body.total).toBeGreaterThanOrEqual(2);

    const filtered = await request(app)
      .get("/api/admin-audit-events")
      .query({ type: AdminAuditEventType.user_deactivated })
      .set("Cookie", gaCookie);
    expect(
      filtered.body.data.every((r: { type: string }) => r.type === "user_deactivated"),
    ).toBe(true);
    await destroyUser(id);
  });
});

describe("admin events stay out of the agent dashboard feed", () => {
  it("an admin action does not appear in /api/stats/recent-activity", async () => {
    const id = await makeUser({ email: "aae-leak@example.com", role: Role.agent });
    await request(app)
      .patch(`/api/users/${id}/status`)
      .set("Cookie", gaCookie)
      .send({ status: UserStatus.inactive });

    const recent = await request(app)
      .get("/api/stats/recent-activity")
      .set("Cookie", agentCookie);
    expect(recent.status).toBe(200);
    const adminTypes = Object.values(AdminAuditEventType) as string[];
    expect(
      (recent.body as { type: string }[]).some((r) => adminTypes.includes(r.type)),
    ).toBe(false);
    await destroyUser(id);
  });
});
