import {
  AdminAuditEventType,
  KbArticleStatus,
  KbSuggestionStatus,
  TicketCategory,
} from "@helpdesk/core";
import { generateId } from "better-auth";
import request from "supertest";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import app from "../app";
import { auth } from "../lib/auth";
import { prisma } from "../lib/prisma";

describe("kb-suggestions API", () => {
  let agentId: string;
  let adminId: string;
  let agentCookie: string;
  let adminCookie: string;
  const createdArticleIds: string[] = [];
  const createdSuggestionIds: string[] = [];

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

  async function makePending(title = "Suggested topic") {
    const row = await prisma.kbSuggestion.create({
      data: {
        source: "ai_gap_analysis",
        status: KbSuggestionStatus.pending,
        category: TicketCategory.billing_inquiry,
        title,
        question: "How does X work?",
        answer: "Like this.",
        sourceTicketIds: [1, 2, 3],
      },
    });
    createdSuggestionIds.push(row.id);
    return row;
  }

  beforeAll(async () => {
    const agent = await createUserWithSession("agent", "kbs-agent@example.com");
    agentId = agent.id;
    agentCookie = agent.cookie;
    const admin = await createUserWithSession("admin", "kbs-admin@example.com");
    adminId = admin.id;
    adminCookie = admin.cookie;
  });

  afterEach(async () => {
    await prisma.adminAuditEvent.deleteMany({ where: { actorId: adminId } });
    if (createdArticleIds.length > 0) {
      await prisma.kbArticle.deleteMany({ where: { id: { in: createdArticleIds } } });
      createdArticleIds.length = 0;
    }
    if (createdSuggestionIds.length > 0) {
      await prisma.kbSuggestion.deleteMany({
        where: { id: { in: createdSuggestionIds } },
      });
      createdSuggestionIds.length = 0;
    }
  });

  afterAll(async () => {
    await prisma.session.deleteMany({ where: { userId: { in: [agentId, adminId] } } });
    await prisma.account.deleteMany({ where: { userId: { in: [agentId, adminId] } } });
    await prisma.user.deleteMany({ where: { id: { in: [agentId, adminId] } } });
  });

  const approveBody = {
    title: "Billing overview",
    question: "How does billing work?",
    answer: "It works like so.",
    category: TicketCategory.billing_inquiry,
    status: KbArticleStatus.published,
  };

  describe("auth guards", () => {
    it("GET returns 401 unauthenticated", async () => {
      const res = await request(app).get("/api/kb-suggestions");
      expect(res.status).toBe(401);
    });
    it("GET returns 403 for a non-admin agent", async () => {
      const res = await request(app)
        .get("/api/kb-suggestions")
        .set("Cookie", agentCookie);
      expect(res.status).toBe(403);
    });
  });

  describe("GET /api/kb-suggestions", () => {
    it("lists pending suggestions with sourceTicketIds", async () => {
      await makePending();
      const res = await request(app)
        .get("/api/kb-suggestions?status=pending")
        .set("Cookie", adminCookie);
      expect(res.status).toBe(200);
      const found = (res.body as { title: string; sourceTicketIds: number[] }[]).find(
        (r) => r.title === "Suggested topic",
      );
      expect(found?.sourceTicketIds).toEqual([1, 2, 3]);
    });

    it("GET /count returns the pending count", async () => {
      await makePending("Count me");
      const res = await request(app)
        .get("/api/kb-suggestions/count")
        .set("Cookie", adminCookie);
      expect(res.status).toBe(200);
      expect(res.body.pending).toBeGreaterThanOrEqual(1);
    });
  });

  describe("POST /api/kb-suggestions/:id/approve", () => {
    it("returns 404 for an unknown id", async () => {
      const res = await request(app)
        .post("/api/kb-suggestions/nope/approve")
        .set("Cookie", adminCookie)
        .send(approveBody);
      expect(res.status).toBe(404);
    });

    it("returns 400 for an invalid body", async () => {
      const s = await makePending();
      const res = await request(app)
        .post(`/api/kb-suggestions/${s.id}/approve`)
        .set("Cookie", adminCookie)
        .send({ ...approveBody, title: "x" });
      expect(res.status).toBe(400);
    });

    it("creates a published article, flips the suggestion, and audits", async () => {
      const s = await makePending();
      const res = await request(app)
        .post(`/api/kb-suggestions/${s.id}/approve`)
        .set("Cookie", adminCookie)
        .send(approveBody);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe(KbSuggestionStatus.approved);
      expect(res.body.resultArticleId).toBeTruthy();
      createdArticleIds.push(res.body.resultArticleId);

      const article = await prisma.kbArticle.findUnique({
        where: { id: res.body.resultArticleId },
      });
      expect(article?.status).toBe(KbArticleStatus.published);
      expect(article?.source).toBe("ai_suggested");

      const audit = await prisma.adminAuditEvent.findFirst({
        where: { type: AdminAuditEventType.kb_suggestion_approved, actorId: adminId },
      });
      expect(audit).not.toBeNull();
    });

    it("returns 409 when already reviewed", async () => {
      const s = await makePending();
      const first = await request(app)
        .post(`/api/kb-suggestions/${s.id}/approve`)
        .set("Cookie", adminCookie)
        .send(approveBody);
      if (first.body.resultArticleId) createdArticleIds.push(first.body.resultArticleId);
      const second = await request(app)
        .post(`/api/kb-suggestions/${s.id}/approve`)
        .set("Cookie", adminCookie)
        .send(approveBody);
      expect(second.status).toBe(409);
    });
  });

  describe("POST /api/kb-suggestions/:id/reject", () => {
    it("rejects with a reason and audits", async () => {
      const s = await makePending();
      const res = await request(app)
        .post(`/api/kb-suggestions/${s.id}/reject`)
        .set("Cookie", adminCookie)
        .send({ reason: "Already covered" });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe(KbSuggestionStatus.rejected);
      expect(res.body.reviewReason).toBe("Already covered");

      const audit = await prisma.adminAuditEvent.findFirst({
        where: { type: AdminAuditEventType.kb_suggestion_rejected, actorId: adminId },
      });
      expect(audit).not.toBeNull();
    });
  });
});
