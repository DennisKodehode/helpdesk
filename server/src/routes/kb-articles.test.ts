import {
  AdminAuditEventType,
  KbArticleSource,
  KbArticleStatus,
  TicketCategory,
} from "@helpdesk/core";
import { generateId } from "better-auth";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import app from "../app";
import { auth } from "../lib/auth";
import { prisma } from "../lib/prisma";

describe("kb-articles API", () => {
  let agentId: string;
  let adminId: string;
  let agentCookie: string;
  let adminCookie: string;
  const createdIds: string[] = [];

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
    const agent = await createUserWithSession("agent", "kb-route-agent@example.com");
    agentId = agent.id;
    agentCookie = agent.cookie;
    const admin = await createUserWithSession("admin", "kb-route-admin@example.com");
    adminId = admin.id;
    adminCookie = admin.cookie;
  });

  afterEach(async () => {
    if (createdIds.length > 0) {
      await prisma.adminAuditEvent.deleteMany({ where: { actorId: { in: [adminId] } } });
      await prisma.kbArticle.deleteMany({ where: { id: { in: createdIds } } });
      createdIds.length = 0;
    }
  });

  afterAll(async () => {
    await prisma.session.deleteMany({ where: { userId: { in: [agentId, adminId] } } });
    await prisma.account.deleteMany({ where: { userId: { in: [agentId, adminId] } } });
    await prisma.user.deleteMany({ where: { id: { in: [agentId, adminId] } } });
  });

  const validBody = {
    title: "Test article",
    question: "How do I test?",
    answer: "Run the tests.",
    category: TicketCategory.technical_question,
    status: KbArticleStatus.published,
  };

  describe("auth guards", () => {
    it("GET returns 401 when unauthenticated", async () => {
      const res = await request(app).get("/api/kb-articles");
      expect(res.status).toBe(401);
    });

    it("GET returns 403 for a non-admin agent", async () => {
      const res = await request(app).get("/api/kb-articles").set("Cookie", agentCookie);
      expect(res.status).toBe(403);
    });

    it("POST returns 403 for a non-admin agent", async () => {
      const res = await request(app)
        .post("/api/kb-articles")
        .set("Cookie", agentCookie)
        .send(validBody);
      expect(res.status).toBe(403);
    });
  });

  describe("POST /api/kb-articles", () => {
    it("returns 400 for an invalid body (title too short)", async () => {
      const res = await request(app)
        .post("/api/kb-articles")
        .set("Cookie", adminCookie)
        .send({ ...validBody, title: "x" });
      expect(res.status).toBe(400);
      expect(typeof res.body.error).toBe("string");
    });

    it("creates an article, sets source=manual, and records an audit event", async () => {
      const res = await request(app)
        .post("/api/kb-articles")
        .set("Cookie", adminCookie)
        .send(validBody);
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        title: validBody.title,
        category: TicketCategory.technical_question,
        status: KbArticleStatus.published,
        source: KbArticleSource.manual,
        hitCount: 0,
      });
      expect(res.body.lastReviewedAt).not.toBeNull();
      createdIds.push(res.body.id);

      const audit = await prisma.adminAuditEvent.findFirst({
        where: { type: AdminAuditEventType.kb_article_created, actorId: adminId },
      });
      expect(audit?.targetName).toBe(validBody.title);
    });

    it("accepts a general (null-category) article", async () => {
      const res = await request(app)
        .post("/api/kb-articles")
        .set("Cookie", adminCookie)
        .send({ ...validBody, category: null });
      expect(res.status).toBe(201);
      expect(res.body.category).toBeNull();
      createdIds.push(res.body.id);
    });
  });

  describe("GET /api/kb-articles", () => {
    it("lists articles and filters by status", async () => {
      const draft = await prisma.kbArticle.create({
        data: {
          title: "Draft only",
          question: "q",
          answer: "a",
          status: KbArticleStatus.draft,
        },
      });
      const published = await prisma.kbArticle.create({
        data: {
          title: "Published only",
          question: "q",
          answer: "a",
          status: KbArticleStatus.published,
        },
      });
      createdIds.push(draft.id, published.id);

      const res = await request(app)
        .get("/api/kb-articles?status=draft")
        .set("Cookie", adminCookie);
      expect(res.status).toBe(200);
      const ids = (res.body as { id: string }[]).map((r) => r.id);
      expect(ids).toContain(draft.id);
      expect(ids).not.toContain(published.id);
    });
  });

  describe("PATCH /api/kb-articles/:id", () => {
    it("returns 404 for an unknown id", async () => {
      const res = await request(app)
        .patch("/api/kb-articles/nonexistent")
        .set("Cookie", adminCookie)
        .send({ status: KbArticleStatus.archived });
      expect(res.status).toBe(404);
    });

    it("returns 400 for an empty body", async () => {
      const row = await prisma.kbArticle.create({
        data: { title: "Patch me", question: "q", answer: "a" },
      });
      createdIds.push(row.id);
      const res = await request(app)
        .patch(`/api/kb-articles/${row.id}`)
        .set("Cookie", adminCookie)
        .send({});
      expect(res.status).toBe(400);
    });

    it("archives an article and records an audit event", async () => {
      const row = await prisma.kbArticle.create({
        data: {
          title: "Archive me",
          question: "q",
          answer: "a",
          status: KbArticleStatus.published,
        },
      });
      createdIds.push(row.id);
      const res = await request(app)
        .patch(`/api/kb-articles/${row.id}`)
        .set("Cookie", adminCookie)
        .send({ status: KbArticleStatus.archived });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe(KbArticleStatus.archived);

      const audit = await prisma.adminAuditEvent.findFirst({
        where: { type: AdminAuditEventType.kb_article_updated, actorId: adminId },
      });
      expect(audit).not.toBeNull();
    });
  });

  describe("DELETE /api/kb-articles/:id", () => {
    it("returns 404 for an unknown id", async () => {
      const res = await request(app)
        .delete("/api/kb-articles/nonexistent")
        .set("Cookie", adminCookie);
      expect(res.status).toBe(404);
    });

    it("deletes an article and records an audit event", async () => {
      const row = await prisma.kbArticle.create({
        data: { title: "Delete me", question: "q", answer: "a" },
      });
      const res = await request(app)
        .delete(`/api/kb-articles/${row.id}`)
        .set("Cookie", adminCookie);
      expect(res.status).toBe(204);

      const gone = await prisma.kbArticle.findUnique({ where: { id: row.id } });
      expect(gone).toBeNull();
      const audit = await prisma.adminAuditEvent.findFirst({
        where: { type: AdminAuditEventType.kb_article_deleted, actorId: adminId },
      });
      expect(audit?.targetName).toBe("Delete me");
      await prisma.adminAuditEvent.deleteMany({ where: { actorId: adminId } });
    });
  });
});
