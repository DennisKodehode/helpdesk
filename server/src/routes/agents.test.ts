import { Role } from "@helpdesk/core";
import { generateId } from "better-auth";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import app from "../app";
import { auth } from "../lib/auth";
import { prisma } from "../lib/prisma";

describe("GET /api/agents", () => {
  let authCookie: string;
  let testAgentId: string;
  let extraAgentId: string;

  beforeAll(async () => {
    const ctx = await auth.$context;
    const hashedPassword = await ctx.password.hash("Testpassword1!");
    const now = new Date();

    const id = generateId();
    await prisma.user.create({
      data: {
        id,
        name: "Agents Test Agent",
        email: "test-agents@example.com",
        emailVerified: true,
        role: Role.agent,
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
    testAgentId = id;

    const signInRes = await request(app)
      .post("/api/auth/sign-in/email")
      .send({ email: "test-agents@example.com", password: "Testpassword1!" });
    const cookies = signInRes.headers["set-cookie"] as string[] | string;
    authCookie = Array.isArray(cookies) ? cookies.join("; ") : cookies;

    const extra = generateId();
    await prisma.user.create({
      data: {
        id: extra,
        name: "Extra Agent",
        email: "extra-agents@example.com",
        emailVerified: true,
        role: Role.agent,
        createdAt: now,
        updatedAt: now,
      },
    });
    extraAgentId = extra;
  });

  afterAll(async () => {
    await prisma.session.deleteMany({ where: { userId: testAgentId } });
    await prisma.account.deleteMany({ where: { userId: testAgentId } });
    await prisma.user.delete({ where: { id: testAgentId } });
    await prisma.user.delete({ where: { id: extraAgentId } });
  });

  it("returns 401 when not authenticated", async () => {
    const res = await request(app).get("/api/agents");
    expect(res.status).toBe(401);
  });

  it("returns 200 with an array of agents", async () => {
    const res = await request(app).get("/api/agents").set("Cookie", authCookie);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("returns only id, name, and email fields", async () => {
    const res = await request(app).get("/api/agents").set("Cookie", authCookie);
    expect(res.status).toBe(200);
    const agent = (
      res.body as { id: string; name: string; email: string; role?: string }[]
    ).find((a) => a.id === testAgentId);
    expect(agent).toBeDefined();
    expect(agent?.id).toBe(testAgentId);
    expect(agent?.name).toBe("Agents Test Agent");
    expect(agent?.email).toBe("test-agents@example.com");
    expect(agent?.role).toBeUndefined();
  });

  it("does not include deleted agents", async () => {
    const deletedId = generateId();
    const now = new Date();
    await prisma.user.create({
      data: {
        id: deletedId,
        name: "Deleted Agent",
        email: "deleted-agents@example.com",
        emailVerified: true,
        role: Role.agent,
        deletedAt: now,
        createdAt: now,
        updatedAt: now,
      },
    });

    const res = await request(app).get("/api/agents").set("Cookie", authCookie);
    const ids = (res.body as { id: string }[]).map((a) => a.id);
    expect(ids).not.toContain(deletedId);

    await prisma.user.delete({ where: { id: deletedId } });
  });
});
