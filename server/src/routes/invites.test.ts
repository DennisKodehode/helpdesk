import { Role, UserStatus } from "@helpdesk/core";
import { generateId } from "better-auth";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import app from "../app";
import { hashInviteToken } from "../lib/invite";
import { prisma } from "../lib/prisma";

// Seed an invited user + an Invitation with a KNOWN raw token (the route only
// ever sees the hash, so tests construct the pair directly).
async function seedInvite(opts: {
  email: string;
  expiresAt?: Date;
  status?: UserStatus;
  deleted?: boolean;
}) {
  const now = new Date();
  const id = generateId();
  const token = generateId() + generateId();
  await prisma.user.create({
    data: {
      id,
      name: "Invitee",
      email: opts.email,
      emailVerified: true,
      role: Role.agent,
      status: opts.status ?? UserStatus.invited,
      deletedAt: opts.deleted ? now : null,
      createdAt: now,
      updatedAt: now,
    },
  });
  await prisma.invitation.create({
    data: {
      userId: id,
      tokenHash: hashInviteToken(token),
      expiresAt: opts.expiresAt ?? new Date(now.getTime() + 3_600_000),
    },
  });
  return { id, token };
}

async function cleanup(id: string) {
  await prisma.invitation.deleteMany({ where: { userId: id } });
  await prisma.session.deleteMany({ where: { userId: id } });
  await prisma.account.deleteMany({ where: { userId: id } });
  await prisma.user.deleteMany({ where: { id } });
}

describe("GET /api/invites/validate", () => {
  let id: string | undefined;
  afterEach(async () => {
    if (id) {
      await cleanup(id);
      id = undefined;
    }
  });

  it("returns name + email for a valid token", async () => {
    const seed = await seedInvite({ email: "validate-ok@example.com" });
    id = seed.id;
    const res = await request(app)
      .get("/api/invites/validate")
      .query({ token: seed.token });
    expect(res.status).toBe(200);
    expect(res.body.email).toBe("validate-ok@example.com");
    expect(res.body.name).toBe("Invitee");
  });

  it("returns 400 for an unknown token", async () => {
    const res = await request(app).get("/api/invites/validate").query({ token: "nope" });
    expect(res.status).toBe(400);
  });

  it("returns 400 for an expired token", async () => {
    const seed = await seedInvite({
      email: "validate-expired@example.com",
      expiresAt: new Date(Date.now() - 1000),
    });
    id = seed.id;
    const res = await request(app)
      .get("/api/invites/validate")
      .query({ token: seed.token });
    expect(res.status).toBe(400);
  });
});

describe("POST /api/invites/accept", () => {
  let id: string | undefined;
  afterEach(async () => {
    if (id) {
      await cleanup(id);
      id = undefined;
    }
  });

  it("creates a credential, activates the user, consumes the token, and lets them sign in", async () => {
    const seed = await seedInvite({ email: "accept-ok@example.com" });
    id = seed.id;
    const res = await request(app)
      .post("/api/invites/accept")
      .send({ token: seed.token, password: "newpassword1" });
    expect(res.status).toBe(200);
    expect(res.body.email).toBe("accept-ok@example.com");

    const user = await prisma.user.findUnique({ where: { id } });
    expect(user?.status).toBe(UserStatus.active);
    const account = await prisma.account.findFirst({
      where: { userId: id, providerId: "credential" },
    });
    expect(account).not.toBeNull();
    const invite = await prisma.invitation.findUnique({ where: { userId: id } });
    expect(invite).toBeNull(); // single-use

    const signIn = await request(app)
      .post("/api/auth/sign-in/email")
      .send({ email: "accept-ok@example.com", password: "newpassword1" });
    expect(signIn.status).toBe(200);
  });

  it("returns 400 for a reused token (single-use)", async () => {
    const seed = await seedInvite({ email: "accept-reuse@example.com" });
    id = seed.id;
    await request(app)
      .post("/api/invites/accept")
      .send({ token: seed.token, password: "newpassword1" });
    const res = await request(app)
      .post("/api/invites/accept")
      .send({ token: seed.token, password: "newpassword1" });
    expect(res.status).toBe(400);
  });

  it("returns 400 for an expired token", async () => {
    const seed = await seedInvite({
      email: "accept-expired@example.com",
      expiresAt: new Date(Date.now() - 1000),
    });
    id = seed.id;
    const res = await request(app)
      .post("/api/invites/accept")
      .send({ token: seed.token, password: "newpassword1" });
    expect(res.status).toBe(400);
  });

  it("returns 400 when the invited user was removed", async () => {
    const seed = await seedInvite({ email: "accept-deleted@example.com", deleted: true });
    id = seed.id;
    const res = await request(app)
      .post("/api/invites/accept")
      .send({ token: seed.token, password: "newpassword1" });
    expect(res.status).toBe(400);
  });

  it("returns 400 when the password is too short", async () => {
    const seed = await seedInvite({ email: "accept-shortpw@example.com" });
    id = seed.id;
    const res = await request(app)
      .post("/api/invites/accept")
      .send({ token: seed.token, password: "short" });
    expect(res.status).toBe(400);
  });
});
