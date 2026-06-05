import { Role, TicketStatus, UserStatus } from "@helpdesk/core";
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
import { auth } from "../lib/auth";
import { prisma } from "../lib/prisma";

// Invites send email inline — stub Resend so tests never hit the network.
vi.mock("../lib/resend", () => ({
  default: {
    emails: {
      send: vi.fn().mockResolvedValue({ data: { id: "test-email" }, error: null }),
    },
  },
}));

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
    data: {
      id: adminId,
      name: "Users Admin",
      email: "users-admin@example.com",
      emailVerified: true,
      role: Role.admin,
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
  const adminRes = await request(app)
    .post("/api/auth/sign-in/email")
    .send({ email: "users-admin@example.com", password: "Testpassword1!" });
  const adminCookies = adminRes.headers["set-cookie"] as string[] | string;
  adminCookie = Array.isArray(adminCookies) ? adminCookies.join("; ") : adminCookies;

  agentId = generateId();
  await prisma.user.create({
    data: {
      id: agentId,
      name: "Users Agent",
      email: "users-agent@example.com",
      emailVerified: true,
      role: Role.agent,
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
    const user = (res.body as { id: string }[]).find((u) => u.id === adminId);
    expect(user).toMatchObject({
      id: adminId,
      name: "Users Admin",
      email: "users-admin@example.com",
      role: Role.admin,
    });
    expect((user as { createdAt?: string })?.createdAt).toBeDefined();
  });

  it("does not include deleted users", async () => {
    const now = new Date();
    const deletedId = generateId();
    await prisma.user.create({
      data: {
        id: deletedId,
        name: "Deleted",
        email: "deleted-get-users@example.com",
        emailVerified: true,
        role: Role.agent,
        deletedAt: now,
        createdAt: now,
        updatedAt: now,
      },
    });

    const res = await request(app).get("/api/users").set("Cookie", adminCookie);
    const ids = (res.body as { id: string }[]).map((u) => u.id);
    expect(ids).not.toContain(deletedId);

    await prisma.user.delete({ where: { id: deletedId } });
  });
});

// ─── POST /api/users (invite) ─────────────────────────────────────────────────

describe("POST /api/users (invite)", () => {
  let createdId: string | undefined;

  afterEach(async () => {
    if (createdId) {
      await prisma.invitation.deleteMany({ where: { userId: createdId } });
      await prisma.account.deleteMany({ where: { userId: createdId } });
      await prisma.user.deleteMany({ where: { id: createdId } });
      createdId = undefined;
    }
  });

  it("returns 401 when not authenticated", async () => {
    const res = await request(app)
      .post("/api/users")
      .send({ name: "New User", email: "new@example.com", role: Role.agent });
    expect(res.status).toBe(401);
  });

  it("returns 403 for a non-admin user", async () => {
    const res = await request(app)
      .post("/api/users")
      .set("Cookie", agentCookie)
      .send({ name: "New User", email: "new@example.com", role: Role.agent });
    expect(res.status).toBe(403);
  });

  it("returns 400 when name is too short", async () => {
    const res = await request(app)
      .post("/api/users")
      .set("Cookie", adminCookie)
      .send({ name: "Ab", email: "new@example.com", role: Role.agent });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeTypeOf("string");
  });

  it("returns 400 when email is invalid", async () => {
    const res = await request(app)
      .post("/api/users")
      .set("Cookie", adminCookie)
      .send({ name: "New User", email: "not-an-email", role: Role.agent });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeTypeOf("string");
  });

  it("returns 409 when email is already in use", async () => {
    const res = await request(app).post("/api/users").set("Cookie", adminCookie).send({
      name: "Duplicate",
      email: "users-agent@example.com",
      role: Role.agent,
    });
    expect(res.status).toBe(409);
    expect(res.body.error).toBeTypeOf("string");
  });

  it("returns 201 with an invited, credential-less user + an Invitation row", async () => {
    const res = await request(app).post("/api/users").set("Cookie", adminCookie).send({
      name: "New Agent",
      email: "new-agent-post-users@example.com",
      role: Role.agent,
    });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.name).toBe("New Agent");
    expect(res.body.status).toBe(UserStatus.invited);
    createdId = res.body.id;

    // No credential yet — an invited user can't sign in.
    const accounts = await prisma.account.count({ where: { userId: createdId } });
    expect(accounts).toBe(0);
    // A pending invite exists.
    const invite = await prisma.invitation.findUnique({ where: { userId: createdId } });
    expect(invite).not.toBeNull();
  });

  // Inviting an admin is now global-admin-only (see the "global admin
  // authorization" suite for the allowed path). A regular admin is rejected.
  it("rejects a regular admin inviting an admin (403)", async () => {
    const res = await request(app).post("/api/users").set("Cookie", adminCookie).send({
      name: "Invited Admin",
      email: "invited-admin-users@example.com",
      role: Role.admin,
    });
    expect(res.status).toBe(403);
  });

  it("re-invites cleanly when the email was previously used by a deleted user", async () => {
    const createRes = await request(app)
      .post("/api/users")
      .set("Cookie", adminCookie)
      .send({
        name: "Old Agent",
        email: "reused-email-users@example.com",
        role: Role.agent,
      });
    expect(createRes.status).toBe(201);
    const oldId = createRes.body.id;

    await request(app).delete(`/api/users/${oldId}`).set("Cookie", adminCookie);

    const res = await request(app).post("/api/users").set("Cookie", adminCookie).send({
      name: "New Agent",
      email: "reused-email-users@example.com",
      role: Role.agent,
    });
    expect(res.status).toBe(201);
    expect(res.body.id).not.toBe(oldId);
    expect(res.body.email).toBe("reused-email-users@example.com");

    await prisma.user.deleteMany({ where: { id: oldId } });
    createdId = res.body.id;
  });
});

// ─── POST /api/users/:id/invite/resend ────────────────────────────────────────

describe("POST /api/users/:id/invite/resend", () => {
  let invitedId: string | undefined;

  afterEach(async () => {
    if (invitedId) {
      await prisma.invitation.deleteMany({ where: { userId: invitedId } });
      await prisma.account.deleteMany({ where: { userId: invitedId } });
      await prisma.user.deleteMany({ where: { id: invitedId } });
      invitedId = undefined;
    }
  });

  async function invite(email: string) {
    const res = await request(app)
      .post("/api/users")
      .set("Cookie", adminCookie)
      .send({ name: "Resend Target", email, role: Role.agent });
    invitedId = res.body.id;
    return res.body.id as string;
  }

  it("returns 403 for a non-admin user", async () => {
    const id = await invite("resend-403@example.com");
    const res = await request(app)
      .post(`/api/users/${id}/invite/resend`)
      .set("Cookie", agentCookie);
    expect(res.status).toBe(403);
  });

  it("returns 204 and rotates the token for an invited user", async () => {
    const id = await invite("resend-ok@example.com");
    const before = await prisma.invitation.findUnique({ where: { userId: id } });
    const res = await request(app)
      .post(`/api/users/${id}/invite/resend`)
      .set("Cookie", adminCookie);
    expect(res.status).toBe(204);
    const after = await prisma.invitation.findUnique({ where: { userId: id } });
    expect(after?.tokenHash).not.toBe(before?.tokenHash);
  });

  it("returns 409 for a user who has already accepted (active)", async () => {
    const id = await invite("resend-active@example.com");
    await prisma.user.update({
      where: { id },
      data: { status: UserStatus.active },
    });
    const res = await request(app)
      .post(`/api/users/${id}/invite/resend`)
      .set("Cookie", adminCookie);
    expect(res.status).toBe(409);
  });
});

// ─── DELETE /api/users/:id ────────────────────────────────────────────────────

describe("DELETE /api/users/:id", () => {
  let targetId: string;

  beforeEach(async () => {
    const now = new Date();
    targetId = generateId();
    await prisma.user.create({
      data: {
        id: targetId,
        name: "Delete Target",
        email: "delete-target-users@example.com",
        emailVerified: true,
        role: Role.agent,
        createdAt: now,
        updatedAt: now,
      },
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
    const res = await request(app)
      .delete(`/api/users/${targetId}`)
      .set("Cookie", agentCookie);
    expect(res.status).toBe(403);
  });

  it("returns 403 when trying to delete own account", async () => {
    const res = await request(app)
      .delete(`/api/users/${adminId}`)
      .set("Cookie", adminCookie);
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/own/i);
  });

  it("returns 403 when trying to delete an admin account", async () => {
    const now = new Date();
    const secondAdminId = generateId();
    await prisma.user.create({
      data: {
        id: secondAdminId,
        name: "Second Admin",
        email: "second-admin-users@example.com",
        emailVerified: true,
        role: Role.admin,
        createdAt: now,
        updatedAt: now,
      },
    });

    const res = await request(app)
      .delete(`/api/users/${secondAdminId}`)
      .set("Cookie", adminCookie);
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/admin/i);

    await prisma.user.delete({ where: { id: secondAdminId } });
  });

  it("returns 404 when user does not exist", async () => {
    const res = await request(app)
      .delete("/api/users/nonexistent-id")
      .set("Cookie", adminCookie);
    expect(res.status).toBe(404);
    expect(res.body.error).toBeTypeOf("string");
  });

  it("returns 204 and soft-deletes the user", async () => {
    const res = await request(app)
      .delete(`/api/users/${targetId}`)
      .set("Cookie", adminCookie);
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
      data: {
        fromName: "Customer",
        fromEmail: "customer@example.com",
        subject: "Help",
        body: "Please help",
        assignedToId: targetId,
      },
    });

    const res = await request(app)
      .delete(`/api/users/${targetId}`)
      .set("Cookie", adminCookie);
    expect(res.status).toBe(204);

    const updated = await prisma.ticket.findUnique({ where: { id: ticket.id } });
    expect(updated?.assignedToId).toBeNull();

    await prisma.ticket.delete({ where: { id: ticket.id } });
  });

  it("records assignee_changed audit events per affected ticket with reason=user_deleted", async () => {
    const t1 = await prisma.ticket.create({
      data: {
        fromName: "C1",
        fromEmail: "c1@example.com",
        subject: "T1",
        body: "",
        assignedToId: targetId,
      },
    });
    const t2 = await prisma.ticket.create({
      data: {
        fromName: "C2",
        fromEmail: "c2@example.com",
        subject: "T2",
        body: "",
        assignedToId: targetId,
      },
    });

    const res = await request(app)
      .delete(`/api/users/${targetId}`)
      .set("Cookie", adminCookie);
    expect(res.status).toBe(204);

    const events = await prisma.auditEvent.findMany({
      where: { ticketId: { in: [t1.id, t2.id] } },
    });
    expect(events).toHaveLength(2);
    expect(events.every((e) => e.type === "assignee_changed")).toBe(true);
    for (const ev of events) {
      expect(ev.data).toEqual({
        from: targetId,
        to: null,
        reason: "user_deleted",
      });
    }

    await prisma.ticket.deleteMany({ where: { id: { in: [t1.id, t2.id] } } });
  });
});

// ─── PATCH /api/users/:id ─────────────────────────────────────────────────────

describe("PATCH /api/users/:id", () => {
  let targetId: string;

  beforeEach(async () => {
    const now = new Date();
    targetId = generateId();
    await prisma.user.create({
      data: {
        id: targetId,
        name: "Patch Target",
        email: "patch-target-users@example.com",
        emailVerified: true,
        role: Role.agent,
        createdAt: now,
        updatedAt: now,
      },
    });
  });

  afterEach(async () => {
    await prisma.session.deleteMany({ where: { userId: targetId } });
    await prisma.account.deleteMany({ where: { userId: targetId } });
    await prisma.user.deleteMany({ where: { id: targetId } });
  });

  it("returns 401 when not authenticated", async () => {
    const res = await request(app)
      .patch(`/api/users/${targetId}`)
      .send({ name: "Updated", email: "updated@example.com", password: "" });
    expect(res.status).toBe(401);
  });

  it("returns 403 for a non-admin user", async () => {
    const res = await request(app)
      .patch(`/api/users/${targetId}`)
      .set("Cookie", agentCookie)
      .send({ name: "Updated", email: "updated@example.com", password: "" });
    expect(res.status).toBe(403);
  });

  it("returns 400 when body is invalid", async () => {
    const res = await request(app)
      .patch(`/api/users/${targetId}`)
      .set("Cookie", adminCookie)
      .send({ name: "Ab", email: "not-an-email", password: "" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeTypeOf("string");
  });

  it("returns 409 when email is already in use by another user", async () => {
    const res = await request(app)
      .patch(`/api/users/${targetId}`)
      .set("Cookie", adminCookie)
      .send({ name: "Updated", email: "users-agent@example.com", password: "" });
    expect(res.status).toBe(409);
    expect(res.body.error).toBeTypeOf("string");
  });

  it("returns 200 and updates name and email", async () => {
    const res = await request(app)
      .patch(`/api/users/${targetId}`)
      .set("Cookie", adminCookie)
      .send({
        name: "Updated Name",
        email: "updated-patch-users@example.com",
        password: "",
      });
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(targetId);
    expect(res.body.name).toBe("Updated Name");
    expect(res.body.email).toBe("updated-patch-users@example.com");
  });

  it("allows updating with the user's own current email", async () => {
    const res = await request(app)
      .patch(`/api/users/${targetId}`)
      .set("Cookie", adminCookie)
      .send({
        name: "Same Email",
        email: "patch-target-users@example.com",
        password: "",
      });
    expect(res.status).toBe(200);
  });

  it("updates the password when a new password is provided", async () => {
    const ctx = await auth.$context;
    const hashedPassword = await ctx.password.hash("OldPassword1!");
    await prisma.account.create({
      data: {
        id: generateId(),
        accountId: targetId,
        providerId: "credential",
        userId: targetId,
        password: hashedPassword,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    const res = await request(app)
      .patch(`/api/users/${targetId}`)
      .set("Cookie", adminCookie)
      .send({
        name: "Patch Target",
        email: "patch-target-users@example.com",
        password: "NewPassword1!",
      });
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
      data: {
        id: generateId(),
        accountId: targetId,
        providerId: "credential",
        userId: targetId,
        password: hashedPassword,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    await request(app).patch(`/api/users/${targetId}`).set("Cookie", adminCookie).send({
      name: "Patch Target",
      email: "patch-target-users@example.com",
      password: "",
    });

    const signInRes = await request(app)
      .post("/api/auth/sign-in/email")
      .send({ email: "patch-target-users@example.com", password: "OriginalPassword1!" });
    expect(signInRes.status).toBe(200);
  });
});

// ─── Helpers for role / status / gate ─────────────────────────────────────────

async function createUserRow(opts: {
  email: string;
  role?: Role;
  status?: UserStatus;
  password?: string;
}): Promise<string> {
  const now = new Date();
  const id = generateId();
  await prisma.user.create({
    data: {
      id,
      name: "Fixture",
      email: opts.email,
      emailVerified: true,
      role: opts.role ?? Role.agent,
      status: opts.status ?? UserStatus.active,
      createdAt: now,
      updatedAt: now,
    },
  });
  if (opts.password) {
    const ctx = await auth.$context;
    const hashed = await ctx.password.hash(opts.password);
    await prisma.account.create({
      data: {
        id: generateId(),
        accountId: id,
        providerId: "credential",
        userId: id,
        password: hashed,
        createdAt: now,
        updatedAt: now,
      },
    });
  }
  return id;
}

function joinCookie(res: request.Response): string {
  const c = res.headers["set-cookie"] as string[] | string;
  return Array.isArray(c) ? c.join("; ") : c;
}

// ─── PATCH /api/users/:id/role ────────────────────────────────────────────────

describe("PATCH /api/users/:id/role", () => {
  const created: string[] = [];
  afterEach(async () => {
    for (const id of created) {
      await prisma.account.deleteMany({ where: { userId: id } });
      await prisma.user.deleteMany({ where: { id } });
    }
    created.length = 0;
  });

  it("returns 403 for a non-admin user", async () => {
    const id = await createUserRow({ email: "role-403@example.com" });
    created.push(id);
    const res = await request(app)
      .patch(`/api/users/${id}/role`)
      .set("Cookie", agentCookie)
      .send({ role: Role.admin });
    expect(res.status).toBe(403);
  });

  it("returns 400 for an invalid role", async () => {
    const id = await createUserRow({ email: "role-400@example.com" });
    created.push(id);
    const res = await request(app)
      .patch(`/api/users/${id}/role`)
      .set("Cookie", adminCookie)
      .send({ role: "superuser" });
    expect(res.status).toBe(400);
  });

  // Granting/revoking admin is now global-admin-only — a regular admin can't
  // (the allowed paths live in the "global admin authorization" suite).
  it("rejects a regular admin promoting an agent to admin (403)", async () => {
    const id = await createUserRow({ email: "role-promote@example.com" });
    created.push(id);
    const res = await request(app)
      .patch(`/api/users/${id}/role`)
      .set("Cookie", adminCookie)
      .send({ role: Role.admin });
    expect(res.status).toBe(403);
  });

  it("rejects a regular admin demoting an admin (403)", async () => {
    const id = await createUserRow({
      email: "role-demote@example.com",
      role: Role.admin,
    });
    created.push(id);
    const res = await request(app)
      .patch(`/api/users/${id}/role`)
      .set("Cookie", adminCookie)
      .send({ role: Role.agent });
    expect(res.status).toBe(403);
  });

  it("returns 403 when an admin tries to demote themselves", async () => {
    const res = await request(app)
      .patch(`/api/users/${adminId}/role`)
      .set("Cookie", adminCookie)
      .send({ role: Role.agent });
    expect(res.status).toBe(403);
  });
});

// ─── PATCH /api/users/:id/status + login gate ─────────────────────────────────

describe("PATCH /api/users/:id/status + login gate", () => {
  const created: string[] = [];
  afterEach(async () => {
    for (const id of created) {
      await prisma.session.deleteMany({ where: { userId: id } });
      await prisma.account.deleteMany({ where: { userId: id } });
      await prisma.user.deleteMany({ where: { id } });
    }
    created.length = 0;
  });

  it("deactivating kills live sessions and blocks re-login", async () => {
    const email = "deactivate-gate@example.com";
    const password = "Agentpass1!";
    const id = await createUserRow({ email, password });
    created.push(id);

    const signIn1 = await request(app)
      .post("/api/auth/sign-in/email")
      .send({ email, password });
    expect(signIn1.status).toBe(200);
    const cookie = joinCookie(signIn1);

    const res = await request(app)
      .patch(`/api/users/${id}/status`)
      .set("Cookie", adminCookie)
      .send({ status: UserStatus.inactive });
    expect(res.status).toBe(200);

    // Old session is gone.
    const me = await request(app).get("/api/agents").set("Cookie", cookie);
    expect(me.status).toBe(401);

    // The login gate blocks a fresh sign-in.
    const signIn2 = await request(app)
      .post("/api/auth/sign-in/email")
      .send({ email, password });
    expect(signIn2.status).not.toBe(200);
  });

  it("an invited user cannot sign in even with a credential", async () => {
    // Edge guard: belt-and-suspenders — invited users never have a credential,
    // but the gate must still refuse one if it somehow exists.
    const email = "invited-gate@example.com";
    const password = "Agentpass1!";
    const id = await createUserRow({ email, password, status: UserStatus.invited });
    created.push(id);
    const signIn = await request(app)
      .post("/api/auth/sign-in/email")
      .send({ email, password });
    expect(signIn.status).not.toBe(200);
  });

  it("reactivates an inactive user", async () => {
    const id = await createUserRow({
      email: "reactivate@example.com",
      status: UserStatus.inactive,
    });
    created.push(id);
    const res = await request(app)
      .patch(`/api/users/${id}/status`)
      .set("Cookie", adminCookie)
      .send({ status: UserStatus.active });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe(UserStatus.active);
  });

  it("returns 409 for an invited user", async () => {
    const id = await createUserRow({
      email: "invited-status@example.com",
      status: UserStatus.invited,
    });
    created.push(id);
    const res = await request(app)
      .patch(`/api/users/${id}/status`)
      .set("Cookie", adminCookie)
      .send({ status: UserStatus.inactive });
    expect(res.status).toBe(409);
  });

  it("returns 403 when deactivating your own account", async () => {
    const res = await request(app)
      .patch(`/api/users/${adminId}/status`)
      .set("Cookie", adminCookie)
      .send({ status: UserStatus.inactive });
    expect(res.status).toBe(403);
  });

  it("returns 403 when deactivating an admin", async () => {
    const id = await createUserRow({
      email: "admin-status@example.com",
      role: Role.admin,
    });
    created.push(id);
    const res = await request(app)
      .patch(`/api/users/${id}/status`)
      .set("Cookie", adminCookie)
      .send({ status: UserStatus.inactive });
    expect(res.status).toBe(403);
  });
});

// ─── GET /api/users/roster ────────────────────────────────────────────────────

describe("GET /api/users/roster", () => {
  const created: string[] = [];
  const ticketIds: number[] = [];
  afterEach(async () => {
    if (ticketIds.length) {
      await prisma.ticket.deleteMany({ where: { id: { in: ticketIds } } });
      ticketIds.length = 0;
    }
    for (const id of created) {
      await prisma.session.deleteMany({ where: { userId: id } });
      await prisma.user.deleteMany({ where: { id } });
    }
    created.length = 0;
  });

  it("returns 403 for a non-admin", async () => {
    const res = await request(app).get("/api/users/roster").set("Cookie", agentCookie);
    expect(res.status).toBe(403);
  });

  it("returns rows with the roster shape", async () => {
    const res = await request(app).get("/api/users/roster").set("Cookie", adminCookie);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const me = (res.body as { id: string }[]).find((r) => r.id === adminId);
    expect(me).toMatchObject({
      id: adminId,
      role: Role.admin,
      status: UserStatus.active,
    });
    expect(me).toHaveProperty("openAssigned");
    expect(me).toHaveProperty("resolved30d");
    expect(me).toHaveProperty("avgResolutionMinutes");
    expect(me).toHaveProperty("lastActiveAt");
  });

  it("does not fan out counts across multiple sessions", async () => {
    const now = new Date();
    const id = generateId();
    await prisma.user.create({
      data: {
        id,
        name: "Fanout",
        email: "fanout-roster@example.com",
        emailVerified: true,
        role: Role.agent,
        status: UserStatus.active,
        createdAt: now,
        updatedAt: now,
      },
    });
    created.push(id);
    for (let i = 0; i < 2; i++) {
      await prisma.session.create({
        data: {
          id: generateId(),
          token: generateId(),
          userId: id,
          expiresAt: new Date(now.getTime() + 86_400_000),
          createdAt: now,
          updatedAt: now,
        },
      });
    }
    for (let i = 0; i < 2; i++) {
      const t = await prisma.ticket.create({
        data: {
          fromName: "Customer",
          fromEmail: `fanout-${i}@example.com`,
          subject: "S",
          body: "B",
          status: TicketStatus.open,
          assignedToId: id,
        },
      });
      ticketIds.push(t.id);
    }
    const res = await request(app).get("/api/users/roster").set("Cookie", adminCookie);
    const row = (
      res.body as { id: string; openAssigned: number; lastActiveAt: string | null }[]
    ).find((r) => r.id === id);
    expect(row?.openAssigned).toBe(2); // two sessions must NOT inflate this to 4
    expect(row?.lastActiveAt).not.toBeNull();
  });

  it("excludes the AI user", async () => {
    const res = await request(app).get("/api/users/roster").set("Cookie", adminCookie);
    const emails = (res.body as { email: string }[]).map((r) => r.email);
    expect(emails).not.toContain("ai@helpdesk.internal");
  });
});

// ─── Global admin authorization ─────────────────────────────────────────────
// `adminCookie` (file-level) acts as a REGULAR admin; gaCookie is the global
// admin. Regular admins manage only agents; only the global admin may
// create/invite, deactivate, delete, or change the role of admins. The global
// admin itself is immutable via the API.

describe("global admin authorization", () => {
  let gaId: string;
  let gaCookie: string;
  let targetAdminId: string; // a regular admin acted upon (403 cases — never mutated)
  let targetAgentId: string; // an agent acted upon (403 cases)

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
        name: "Authz Target",
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

  async function destroyUser(id: string) {
    await prisma.session.deleteMany({ where: { userId: id } });
    await prisma.account.deleteMany({ where: { userId: id } });
    await prisma.invitation.deleteMany({ where: { userId: id } });
    await prisma.user.deleteMany({ where: { id } });
  }

  beforeAll(async () => {
    // Clear any leftover global admin from an interrupted run (singleton index).
    await prisma.user.deleteMany({ where: { role: Role.globalAdmin } });
    gaId = await makeUser({
      email: "ga-owner@example.com",
      role: Role.globalAdmin,
      withCredential: true,
    });
    const res = await request(app)
      .post("/api/auth/sign-in/email")
      .send({ email: "ga-owner@example.com", password: "Testpassword1!" });
    const cookies = res.headers["set-cookie"] as string[] | string;
    gaCookie = Array.isArray(cookies) ? cookies.join("; ") : cookies;

    targetAdminId = await makeUser({
      email: "ga-tgt-admin@example.com",
      role: Role.admin,
    });
    targetAgentId = await makeUser({
      email: "ga-tgt-agent@example.com",
      role: Role.agent,
    });
  });

  afterAll(async () => {
    await destroyUser(gaId);
    await destroyUser(targetAdminId);
    await destroyUser(targetAgentId);
  });

  // ── inviting admins ──
  it("regular admin cannot invite an admin", async () => {
    const res = await request(app)
      .post("/api/users")
      .set("Cookie", adminCookie)
      .send({ name: "New Admin", email: "ga-ra-invite@example.com", role: Role.admin });
    expect(res.status).toBe(403);
  });

  it("global admin can invite an admin", async () => {
    const res = await request(app)
      .post("/api/users")
      .set("Cookie", gaCookie)
      .send({ name: "New Admin", email: "ga-ga-invite@example.com", role: Role.admin });
    expect(res.status).toBe(201);
    expect(res.body.role).toBe(Role.admin);
    await destroyUser(res.body.id);
  });

  it("regular admin can still invite an agent", async () => {
    const res = await request(app)
      .post("/api/users")
      .set("Cookie", adminCookie)
      .send({ name: "New Agent", email: "ga-ra-agent@example.com", role: Role.agent });
    expect(res.status).toBe(201);
    await destroyUser(res.body.id);
  });

  // ── role changes ──
  it("regular admin cannot promote an agent to admin", async () => {
    const res = await request(app)
      .patch(`/api/users/${targetAgentId}/role`)
      .set("Cookie", adminCookie)
      .send({ role: Role.admin });
    expect(res.status).toBe(403);
  });

  it("global admin can promote an agent to admin and demote back", async () => {
    const id = await makeUser({ email: "ga-promote@example.com", role: Role.agent });
    const up = await request(app)
      .patch(`/api/users/${id}/role`)
      .set("Cookie", gaCookie)
      .send({ role: Role.admin });
    expect(up.status).toBe(200);
    expect(up.body.role).toBe(Role.admin);
    const down = await request(app)
      .patch(`/api/users/${id}/role`)
      .set("Cookie", gaCookie)
      .send({ role: Role.agent });
    expect(down.status).toBe(200);
    await destroyUser(id);
  });

  it("regular admin cannot demote an admin", async () => {
    const res = await request(app)
      .patch(`/api/users/${targetAdminId}/role`)
      .set("Cookie", adminCookie)
      .send({ role: Role.agent });
    expect(res.status).toBe(403);
  });

  // ── deactivate ──
  it("regular admin cannot deactivate an admin", async () => {
    const res = await request(app)
      .patch(`/api/users/${targetAdminId}/status`)
      .set("Cookie", adminCookie)
      .send({ status: UserStatus.inactive });
    expect(res.status).toBe(403);
  });

  it("global admin can deactivate an admin", async () => {
    const id = await makeUser({ email: "ga-deact@example.com", role: Role.admin });
    const res = await request(app)
      .patch(`/api/users/${id}/status`)
      .set("Cookie", gaCookie)
      .send({ status: UserStatus.inactive });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe(UserStatus.inactive);
    await destroyUser(id);
  });

  it("regular admin can still deactivate and reactivate an agent", async () => {
    const id = await makeUser({ email: "ga-agent-deact@example.com", role: Role.agent });
    const off = await request(app)
      .patch(`/api/users/${id}/status`)
      .set("Cookie", adminCookie)
      .send({ status: UserStatus.inactive });
    expect(off.status).toBe(200);
    const on = await request(app)
      .patch(`/api/users/${id}/status`)
      .set("Cookie", adminCookie)
      .send({ status: UserStatus.active });
    expect(on.status).toBe(200);
    await destroyUser(id);
  });

  // ── delete ──
  it("regular admin cannot delete an admin", async () => {
    const res = await request(app)
      .delete(`/api/users/${targetAdminId}`)
      .set("Cookie", adminCookie);
    expect(res.status).toBe(403);
  });

  it("global admin can delete an admin", async () => {
    const id = await makeUser({ email: "ga-del-admin@example.com", role: Role.admin });
    const res = await request(app).delete(`/api/users/${id}`).set("Cookie", gaCookie);
    expect(res.status).toBe(204);
    const row = await prisma.user.findUnique({ where: { id } });
    expect(row?.deletedAt).not.toBeNull();
    await destroyUser(id);
  });

  // ── editing admin accounts (password-reset privilege-escalation guard) ──
  it("regular admin cannot edit another admin's account", async () => {
    const res = await request(app)
      .patch(`/api/users/${targetAdminId}`)
      .set("Cookie", adminCookie)
      .send({ name: "Hijacked", email: "ga-tgt-admin@example.com", password: "" });
    expect(res.status).toBe(403);
  });

  it("global admin can edit an admin's account", async () => {
    const res = await request(app)
      .patch(`/api/users/${targetAdminId}`)
      .set("Cookie", gaCookie)
      .send({ name: "Renamed Admin", email: "ga-tgt-admin@example.com", password: "" });
    expect(res.status).toBe(200);
    expect(res.body.name).toBe("Renamed Admin");
  });

  // ── the global admin is immutable via the API ──
  it("the global admin's role can't be changed (even by itself)", async () => {
    const byGa = await request(app)
      .patch(`/api/users/${gaId}/role`)
      .set("Cookie", gaCookie)
      .send({ role: Role.admin });
    expect(byGa.status).toBe(403);
    const byAdmin = await request(app)
      .patch(`/api/users/${gaId}/role`)
      .set("Cookie", adminCookie)
      .send({ role: Role.admin });
    expect(byAdmin.status).toBe(403);
  });

  it("the global admin can't be deactivated or deleted", async () => {
    const deact = await request(app)
      .patch(`/api/users/${gaId}/status`)
      .set("Cookie", gaCookie)
      .send({ status: UserStatus.inactive });
    expect(deact.status).toBe(403);
    const del = await request(app).delete(`/api/users/${gaId}`).set("Cookie", gaCookie);
    expect(del.status).toBe(403);
  });

  // ── globalAdmin is never assignable via the API (schema-narrowed) ──
  it("role-change endpoint rejects globalAdmin (400)", async () => {
    const res = await request(app)
      .patch(`/api/users/${targetAgentId}/role`)
      .set("Cookie", gaCookie)
      .send({ role: "globalAdmin" });
    expect(res.status).toBe(400);
  });

  it("invite endpoint rejects globalAdmin (400)", async () => {
    const res = await request(app)
      .post("/api/users")
      .set("Cookie", gaCookie)
      .send({ name: "Nope", email: "ga-nope@example.com", role: "globalAdmin" });
    expect(res.status).toBe(400);
  });

  // ── capability + singleton ──
  it("global admin passes admin-gated routes", async () => {
    const res = await request(app).get("/api/users").set("Cookie", gaCookie);
    expect(res.status).toBe(200);
  });

  it("the global admin is a DB-enforced singleton", async () => {
    const now = new Date();
    await expect(
      prisma.user.create({
        data: {
          id: generateId(),
          name: "Second Owner",
          email: "ga-second@example.com",
          emailVerified: true,
          role: Role.globalAdmin,
          createdAt: now,
          updatedAt: now,
        },
      }),
    ).rejects.toThrow();
  });
});
