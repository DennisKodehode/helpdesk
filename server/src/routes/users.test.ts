import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import request from "supertest";
import { generateId } from "better-auth";
import app from "../app";
import { auth } from "../lib/auth";
import { prisma } from "../lib/prisma";
import { Role } from "@helpdesk/core";

let adminCookie: string;
let agentCookie: string;
let adminId: string;
let agentId: string;

beforeAll(async () => {
  const ctx = await auth.$context;
  const hashedPassword = await ctx.password.hash("Testpassword1!");
  const now = new Date();

  adminId = generateId();
  await prisma.user.create({
    data: { id: adminId, name: "Users Admin", email: "users-admin@example.com", emailVerified: true, role: Role.admin, createdAt: now, updatedAt: now },
  });
  await prisma.account.create({
    data: { id: generateId(), accountId: adminId, providerId: "credential", userId: adminId, password: hashedPassword, createdAt: now, updatedAt: now },
  });
  const adminRes = await request(app)
    .post("/api/auth/sign-in/email")
    .send({ email: "users-admin@example.com", password: "Testpassword1!" });
  const adminCookies = adminRes.headers["set-cookie"] as string[] | string;
  adminCookie = Array.isArray(adminCookies) ? adminCookies.join("; ") : adminCookies;

  agentId = generateId();
  await prisma.user.create({
    data: { id: agentId, name: "Users Agent", email: "users-agent@example.com", emailVerified: true, role: Role.agent, createdAt: now, updatedAt: now },
  });
  await prisma.account.create({
    data: { id: generateId(), accountId: agentId, providerId: "credential", userId: agentId, password: hashedPassword, createdAt: now, updatedAt: now },
  });
  const agentRes = await request(app)
    .post("/api/auth/sign-in/email")
    .send({ email: "users-agent@example.com", password: "Testpassword1!" });
  const agentCookies = agentRes.headers["set-cookie"] as string[] | string;
  agentCookie = Array.isArray(agentCookies) ? agentCookies.join("; ") : agentCookies;
});

afterAll(async () => {
  await prisma.session.deleteMany({ where: { userId: adminId } });
  await prisma.account.deleteMany({ where: { userId: adminId } });
  await prisma.user.delete({ where: { id: adminId } });
  await prisma.session.deleteMany({ where: { userId: agentId } });
  await prisma.account.deleteMany({ where: { userId: agentId } });
  await prisma.user.delete({ where: { id: agentId } });
});

// ─── GET /api/users ───────────────────────────────────────────────────────────

describe("GET /api/users", () => {
  it("returns 401 when not authenticated", async () => {
    const res = await request(app).get("/api/users");
    expect(res.status).toBe(401);
  });

  it("returns 403 for a non-admin user", async () => {
    const res = await request(app).get("/api/users").set("Cookie", agentCookie);
    expect(res.status).toBe(403);
  });

  it("returns 200 with an array of users", async () => {
    const res = await request(app).get("/api/users").set("Cookie", adminCookie);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("returns id, name, email, role, and createdAt for each user", async () => {
    const res = await request(app).get("/api/users").set("Cookie", adminCookie);
    const user = (res.body as { id: string }[]).find(u => u.id === adminId);
    expect(user).toMatchObject({ id: adminId, name: "Users Admin", email: "users-admin@example.com", role: Role.admin });
    expect((user as { createdAt?: string })?.createdAt).toBeDefined();
  });

  it("does not include deleted users", async () => {
    const now = new Date();
    const deletedId = generateId();
    await prisma.user.create({
      data: { id: deletedId, name: "Deleted", email: "deleted-get-users@example.com", emailVerified: true, role: Role.agent, deletedAt: now, createdAt: now, updatedAt: now },
    });

    const res = await request(app).get("/api/users").set("Cookie", adminCookie);
    const ids = (res.body as { id: string }[]).map(u => u.id);
    expect(ids).not.toContain(deletedId);

    await prisma.user.delete({ where: { id: deletedId } });
  });
});

// ─── POST /api/users ──────────────────────────────────────────────────────────

describe("POST /api/users", () => {
  let createdId: string | undefined;

  afterEach(async () => {
    if (createdId) {
      await prisma.account.deleteMany({ where: { userId: createdId } });
      await prisma.user.deleteMany({ where: { id: createdId } });
      createdId = undefined;
    }
  });

  it("returns 401 when not authenticated", async () => {
    const res = await request(app).post("/api/users")
      .send({ name: "New User", email: "new@example.com", password: "password123" });
    expect(res.status).toBe(401);
  });

  it("returns 403 for a non-admin user", async () => {
    const res = await request(app).post("/api/users").set("Cookie", agentCookie)
      .send({ name: "New User", email: "new@example.com", password: "password123" });
    expect(res.status).toBe(403);
  });

  it("returns 400 when name is too short", async () => {
    const res = await request(app).post("/api/users").set("Cookie", adminCookie)
      .send({ name: "Ab", email: "new@example.com", password: "password123" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeTypeOf("string");
  });

  it("returns 400 when email is invalid", async () => {
    const res = await request(app).post("/api/users").set("Cookie", adminCookie)
      .send({ name: "New User", email: "not-an-email", password: "password123" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeTypeOf("string");
  });

  it("returns 400 when password is too short", async () => {
    const res = await request(app).post("/api/users").set("Cookie", adminCookie)
      .send({ name: "New User", email: "new@example.com", password: "short" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeTypeOf("string");
  });

  it("returns 409 when email is already in use", async () => {
    const res = await request(app).post("/api/users").set("Cookie", adminCookie)
      .send({ name: "Duplicate", email: "users-agent@example.com", password: "password123" });
    expect(res.status).toBe(409);
    expect(res.body.error).toBeTypeOf("string");
  });

  it("returns 201 with the created user", async () => {
    const res = await request(app).post("/api/users").set("Cookie", adminCookie)
      .send({ name: "New Agent", email: "new-agent-post-users@example.com", password: "password123" });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.name).toBe("New Agent");
    expect(res.body.email).toBe("new-agent-post-users@example.com");
    createdId = res.body.id;
  });

  it("always creates the user with role agent", async () => {
    const res = await request(app).post("/api/users").set("Cookie", adminCookie)
      .send({ name: "Always Agent", email: "always-agent-users@example.com", password: "password123" });
    expect(res.status).toBe(201);
    expect(res.body.role).toBe(Role.agent);
    createdId = res.body.id;
  });

  it("creates a fresh account when the email was previously used by a deleted user", async () => {
    const createRes = await request(app).post("/api/users").set("Cookie", adminCookie)
      .send({ name: "Old Agent", email: "reused-email-users@example.com", password: "password123" });
    expect(createRes.status).toBe(201);
    const oldId = createRes.body.id;

    await request(app).delete(`/api/users/${oldId}`).set("Cookie", adminCookie);

    const res = await request(app).post("/api/users").set("Cookie", adminCookie)
      .send({ name: "New Agent", email: "reused-email-users@example.com", password: "password123" });
    expect(res.status).toBe(201);
    expect(res.body.id).not.toBe(oldId);
    expect(res.body.email).toBe("reused-email-users@example.com");

    await prisma.user.deleteMany({ where: { id: oldId } });
    createdId = res.body.id;
  });
});

// ─── DELETE /api/users/:id ────────────────────────────────────────────────────

describe("DELETE /api/users/:id", () => {
  let targetId: string;

  beforeEach(async () => {
    const now = new Date();
    targetId = generateId();
    await prisma.user.create({
      data: { id: targetId, name: "Delete Target", email: "delete-target-users@example.com", emailVerified: true, role: Role.agent, createdAt: now, updatedAt: now },
    });
  });

  afterEach(async () => {
    await prisma.session.deleteMany({ where: { userId: targetId } });
    await prisma.account.deleteMany({ where: { userId: targetId } });
    await prisma.user.deleteMany({ where: { id: targetId } });
  });

  it("returns 401 when not authenticated", async () => {
    const res = await request(app).delete(`/api/users/${targetId}`);
    expect(res.status).toBe(401);
  });

  it("returns 403 for a non-admin user", async () => {
    const res = await request(app).delete(`/api/users/${targetId}`).set("Cookie", agentCookie);
    expect(res.status).toBe(403);
  });

  it("returns 403 when trying to delete own account", async () => {
    const res = await request(app).delete(`/api/users/${adminId}`).set("Cookie", adminCookie);
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/own/i);
  });

  it("returns 403 when trying to delete an admin account", async () => {
    const now = new Date();
    const secondAdminId = generateId();
    await prisma.user.create({
      data: { id: secondAdminId, name: "Second Admin", email: "second-admin-users@example.com", emailVerified: true, role: Role.admin, createdAt: now, updatedAt: now },
    });

    const res = await request(app).delete(`/api/users/${secondAdminId}`).set("Cookie", adminCookie);
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/admin/i);

    await prisma.user.delete({ where: { id: secondAdminId } });
  });

  it("returns 404 when user does not exist", async () => {
    const res = await request(app).delete("/api/users/nonexistent-id").set("Cookie", adminCookie);
    expect(res.status).toBe(404);
    expect(res.body.error).toBeTypeOf("string");
  });

  it("returns 204 and soft-deletes the user", async () => {
    const res = await request(app).delete(`/api/users/${targetId}`).set("Cookie", adminCookie);
    expect(res.status).toBe(204);

    const inDb = await prisma.user.findUnique({ where: { id: targetId } });
    expect(inDb?.deletedAt).not.toBeNull();
  });

  it("scrubs the email to deleted-{id}@deleted.invalid on delete", async () => {
    await request(app).delete(`/api/users/${targetId}`).set("Cookie", adminCookie);

    const inDb = await prisma.user.findUnique({ where: { id: targetId } });
    expect(inDb?.email).toBe(`deleted-${targetId}@deleted.invalid`);
  });

  it("unassigns all tickets assigned to the deleted user", async () => {
    const ticket = await prisma.ticket.create({
      data: { fromName: "Customer", fromEmail: "customer@example.com", subject: "Help", body: "Please help", assignedToId: targetId },
    });

    const res = await request(app).delete(`/api/users/${targetId}`).set("Cookie", adminCookie);
    expect(res.status).toBe(204);

    const updated = await prisma.ticket.findUnique({ where: { id: ticket.id } });
    expect(updated?.assignedToId).toBeNull();

    await prisma.ticket.delete({ where: { id: ticket.id } });
  });
});

// ─── PATCH /api/users/:id ─────────────────────────────────────────────────────

describe("PATCH /api/users/:id", () => {
  let targetId: string;

  beforeEach(async () => {
    const now = new Date();
    targetId = generateId();
    await prisma.user.create({
      data: { id: targetId, name: "Patch Target", email: "patch-target-users@example.com", emailVerified: true, role: Role.agent, createdAt: now, updatedAt: now },
    });
  });

  afterEach(async () => {
    await prisma.session.deleteMany({ where: { userId: targetId } });
    await prisma.account.deleteMany({ where: { userId: targetId } });
    await prisma.user.deleteMany({ where: { id: targetId } });
  });

  it("returns 401 when not authenticated", async () => {
    const res = await request(app).patch(`/api/users/${targetId}`)
      .send({ name: "Updated", email: "updated@example.com", password: "" });
    expect(res.status).toBe(401);
  });

  it("returns 403 for a non-admin user", async () => {
    const res = await request(app).patch(`/api/users/${targetId}`).set("Cookie", agentCookie)
      .send({ name: "Updated", email: "updated@example.com", password: "" });
    expect(res.status).toBe(403);
  });

  it("returns 400 when body is invalid", async () => {
    const res = await request(app).patch(`/api/users/${targetId}`).set("Cookie", adminCookie)
      .send({ name: "Ab", email: "not-an-email", password: "" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeTypeOf("string");
  });

  it("returns 409 when email is already in use by another user", async () => {
    const res = await request(app).patch(`/api/users/${targetId}`).set("Cookie", adminCookie)
      .send({ name: "Updated", email: "users-agent@example.com", password: "" });
    expect(res.status).toBe(409);
    expect(res.body.error).toBeTypeOf("string");
  });

  it("returns 200 and updates name and email", async () => {
    const res = await request(app).patch(`/api/users/${targetId}`).set("Cookie", adminCookie)
      .send({ name: "Updated Name", email: "updated-patch-users@example.com", password: "" });
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(targetId);
    expect(res.body.name).toBe("Updated Name");
    expect(res.body.email).toBe("updated-patch-users@example.com");
  });

  it("allows updating with the user's own current email", async () => {
    const res = await request(app).patch(`/api/users/${targetId}`).set("Cookie", adminCookie)
      .send({ name: "Same Email", email: "patch-target-users@example.com", password: "" });
    expect(res.status).toBe(200);
  });

  it("updates the password when a new password is provided", async () => {
    const ctx = await auth.$context;
    const hashedPassword = await ctx.password.hash("OldPassword1!");
    await prisma.account.create({
      data: { id: generateId(), accountId: targetId, providerId: "credential", userId: targetId, password: hashedPassword, createdAt: new Date(), updatedAt: new Date() },
    });

    const res = await request(app).patch(`/api/users/${targetId}`).set("Cookie", adminCookie)
      .send({ name: "Patch Target", email: "patch-target-users@example.com", password: "NewPassword1!" });
    expect(res.status).toBe(200);

    const signInRes = await request(app)
      .post("/api/auth/sign-in/email")
      .send({ email: "patch-target-users@example.com", password: "NewPassword1!" });
    expect(signInRes.status).toBe(200);
  });

  it("does not change the password when password is empty string", async () => {
    const ctx = await auth.$context;
    const hashedPassword = await ctx.password.hash("OriginalPassword1!");
    await prisma.account.create({
      data: { id: generateId(), accountId: targetId, providerId: "credential", userId: targetId, password: hashedPassword, createdAt: new Date(), updatedAt: new Date() },
    });

    await request(app).patch(`/api/users/${targetId}`).set("Cookie", adminCookie)
      .send({ name: "Patch Target", email: "patch-target-users@example.com", password: "" });

    const signInRes = await request(app)
      .post("/api/auth/sign-in/email")
      .send({ email: "patch-target-users@example.com", password: "OriginalPassword1!" });
    expect(signInRes.status).toBe(200);
  });
});
