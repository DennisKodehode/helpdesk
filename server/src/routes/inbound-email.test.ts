import { NotificationType, SenderType, TicketStatus } from "@helpdesk/core";
import { generateId } from "better-auth";
import request from "supertest";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import app from "../app";
import { initAiUserId } from "../lib/ai-user";
import boss from "../lib/boss";
import { prisma } from "../lib/prisma";
import resend from "../lib/resend";

vi.mock("../lib/resend", () => ({
  default: {
    webhooks: { verify: vi.fn() },
    emails: {
      receiving: { get: vi.fn() },
      send: vi.fn(),
    },
  },
}));
vi.mock("../lib/boss", () => ({
  default: { send: vi.fn().mockResolvedValue("mock-job-id") },
}));

let nextEmailIdCounter = 1;
function uniqueEmailId(prefix = "email-test") {
  return `${prefix}-${Date.now()}-${nextEmailIdCounter++}`;
}

const SVIX_HEADERS = {
  "svix-id": "msg_test_123",
  "svix-timestamp": new Date().toISOString(),
  "svix-signature": "v1,test_signature",
};

// from/subject come from the webhook payload; body comes from the API
const makeEvent = (
  overrides: { from?: string; subject?: string; email_id?: string } = {},
) => ({
  type: "email.received",
  data: {
    email_id: overrides.email_id ?? uniqueEmailId(),
    from: overrides.from ?? "Alice <alice@example.com>",
    subject: overrides.subject ?? "Hello",
    to: ["support@contact.tjemsland.dev"],
  },
});

const MOCK_API_BODY = { text: "Hi there", html: "<p>Hi there</p>" };

describe("POST /api/inbound-email", () => {
  let createdTicketId: number | undefined;
  let createdReplyId: number | undefined;

  beforeEach(() => {
    vi.mocked(resend.webhooks.verify).mockReset();
    vi.mocked(resend.emails.receiving.get).mockReset();
    vi.mocked(resend.emails.receiving.get).mockResolvedValue({
      data: MOCK_API_BODY as any,
      error: null,
      headers: null,
    });
  });

  afterEach(async () => {
    if (createdReplyId !== undefined) {
      await prisma.reply.deleteMany({ where: { id: createdReplyId } });
      createdReplyId = undefined;
    }
    if (createdTicketId !== undefined) {
      await prisma.ticket.delete({ where: { id: createdTicketId } });
      createdTicketId = undefined;
    }
  });

  it("returns 401 when signature verification fails", async () => {
    vi.mocked(resend.webhooks.verify).mockImplementationOnce(() => {
      throw new Error("Invalid signature");
    });

    const res = await request(app)
      .post("/api/inbound-email")
      .set(SVIX_HEADERS)
      .send(makeEvent());

    expect(res.status).toBe(401);
    expect(res.body.error).toBeTypeOf("string");
  });

  it("returns 200 without creating anything for non email.received events", async () => {
    const res = await request(app)
      .post("/api/inbound-email")
      .set(SVIX_HEADERS)
      .send({ type: "email.bounced", data: {} });

    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
  });

  it("returns 201 and creates a new ticket when no existing ticket matches the email", async () => {
    const res = await request(app)
      .post("/api/inbound-email")
      .set(SVIX_HEADERS)
      .send(makeEvent());

    expect(res.status).toBe(201);
    expect(res.body.type).toBe("ticket");
    expect(res.body.ticket.fromName).toBe("Alice");
    expect(res.body.ticket.fromEmail).toBe("alice@example.com");
    expect(res.body.ticket.subject).toBe("Hello");
    expect(res.body.ticket.body).toBe("Hi there");
    expect(res.body.ticket.status).toBe(TicketStatus.new);
    expect(res.body.ticket.category).toBeNull();

    createdTicketId = res.body.ticket.id;
    const inDb = await prisma.ticket.findUnique({ where: { id: createdTicketId } });
    expect(inDb).not.toBeNull();
  });

  it("creates a ticket with empty body when the API call to retrieve email body fails", async () => {
    vi.mocked(resend.emails.receiving.get).mockResolvedValueOnce({
      data: null,
      error: { name: "api_error", message: "API error" } as any,
      headers: null,
    });

    const res = await request(app)
      .post("/api/inbound-email")
      .set(SVIX_HEADERS)
      .send(makeEvent({ from: "Bob <apierror@example.com>" }));

    expect(res.status).toBe(201);
    expect(res.body.type).toBe("ticket");
    expect(res.body.ticket.body).toBe("");
    createdTicketId = res.body.ticket.id;
  });

  it("defaults subject to '(no subject)' when email has no subject", async () => {
    const res = await request(app)
      .post("/api/inbound-email")
      .set(SVIX_HEADERS)
      .send(makeEvent({ from: "Alice <nosubject@example.com>", subject: "" }));

    expect(res.status).toBe(201);
    expect(res.body.ticket.subject).toBe("(no subject)");
    createdTicketId = res.body.ticket.id;
  });

  it.each([
    ["Re: Hello", "Hello"],
    ["RE: Hello", "Hello"],
    ["Fwd: Hello", "Hello"],
    ["FW: Hello", "Hello"],
    ["Re: Re: Hello", "Hello"],
    ["Re[2]: Hello", "Hello"],
    ["Fwd: Re: Hello", "Hello"],
  ])("strips '%s' to '%s'", async (rawSubject, cleanSubject) => {
    const res = await request(app)
      .post("/api/inbound-email")
      .set(SVIX_HEADERS)
      .send(
        makeEvent({ from: "Strip Test <strip-test@example.com>", subject: rawSubject }),
      );

    expect(res.status).toBe(201);
    expect(res.body.ticket.subject).toBe(cleanSubject);
    createdTicketId = res.body.ticket.id;
  });

  it("creates a customer reply on the existing open ticket when fromEmail and subject match", async () => {
    const existing = await prisma.ticket.create({
      data: {
        fromName: "Alice",
        fromEmail: "alice@example.com",
        subject: "Hello",
        body: "First message",
        status: TicketStatus.open,
      },
    });
    createdTicketId = existing.id;

    vi.mocked(resend.emails.receiving.get).mockResolvedValueOnce({
      data: { text: "Follow-up message", html: "<p>Follow-up message</p>" } as any,
      error: null,
      headers: null,
    });

    const res = await request(app)
      .post("/api/inbound-email")
      .set(SVIX_HEADERS)
      .send(makeEvent({ subject: "Re: Hello" }));

    expect(res.status).toBe(201);
    expect(res.body.type).toBe("reply");
    expect(res.body.reply.ticketId).toBe(existing.id);
    expect(res.body.reply.senderType).toBe(SenderType.customer);
    expect(res.body.reply.body).toBe("Follow-up message");
    createdReplyId = res.body.reply.id;
  });

  it("creates a new ticket when fromEmail matches but subject is different", async () => {
    const existing = await prisma.ticket.create({
      data: {
        fromName: "Alice",
        fromEmail: "alice@example.com",
        subject: "Hello",
        body: "First message",
        status: TicketStatus.open,
      },
    });

    const res = await request(app)
      .post("/api/inbound-email")
      .set(SVIX_HEADERS)
      .send(makeEvent({ subject: "A completely different issue" }));

    expect(res.status).toBe(201);
    expect(res.body.type).toBe("ticket");
    expect(res.body.ticket.id).not.toBe(existing.id);
    createdTicketId = res.body.ticket.id;
    await prisma.ticket.delete({ where: { id: existing.id } });
  });

  it("auto-reopens a resolved ticket when a customer reply arrives", async () => {
    const existing = await prisma.ticket.create({
      data: {
        fromName: "Alice",
        fromEmail: "alice@example.com",
        subject: "Hello",
        body: "First message",
        status: TicketStatus.resolved,
        resolvedAt: new Date(),
      },
    });
    createdTicketId = existing.id;

    vi.mocked(resend.emails.receiving.get).mockResolvedValueOnce({
      data: { text: "Actually I have another question", html: null } as any,
      error: null,
      headers: null,
    });

    const res = await request(app)
      .post("/api/inbound-email")
      .set(SVIX_HEADERS)
      .send(makeEvent({ subject: "Re: Hello" }));

    expect(res.status).toBe(201);
    expect(res.body.type).toBe("reply");
    expect(res.body.reply.ticketId).toBe(existing.id);
    expect(res.body.reply.senderType).toBe(SenderType.customer);
    expect(res.body.reopened).toBe(true);
    createdReplyId = res.body.reply.id;

    const refreshed = await prisma.ticket.findUnique({
      where: { id: existing.id },
      select: { status: true, resolvedAt: true },
    });
    expect(refreshed!.status).toBe(TicketStatus.open);
    expect(refreshed!.resolvedAt).toBeNull();
  });

  it("does not reopen when the reply lands on an already-open ticket", async () => {
    const existing = await prisma.ticket.create({
      data: {
        fromName: "Alice",
        fromEmail: "alice@example.com",
        subject: "Open status",
        body: "First message",
        status: TicketStatus.open,
      },
    });
    createdTicketId = existing.id;

    vi.mocked(resend.emails.receiving.get).mockResolvedValueOnce({
      data: { text: "Follow-up", html: null } as any,
      error: null,
      headers: null,
    });

    const res = await request(app)
      .post("/api/inbound-email")
      .set(SVIX_HEADERS)
      .send(makeEvent({ subject: "Re: Open status" }));

    expect(res.status).toBe(201);
    expect(res.body.reopened).toBe(false);
    createdReplyId = res.body.reply.id;
  });

  it("creates a new ticket when the only existing ticket from that email is closed", async () => {
    const existing = await prisma.ticket.create({
      data: {
        fromName: "Alice",
        fromEmail: "alice@example.com",
        subject: "Old issue",
        body: "Resolved long ago",
        status: TicketStatus.closed,
      },
    });

    const res = await request(app)
      .post("/api/inbound-email")
      .set(SVIX_HEADERS)
      .send(makeEvent({ subject: "Old issue" }));

    expect(res.status).toBe(201);
    expect(res.body.type).toBe("ticket");
    expect(res.body.ticket.id).not.toBe(existing.id);
    createdTicketId = res.body.ticket.id;
    await prisma.ticket.delete({ where: { id: existing.id } });
  });

  it.each([
    [{ "Auto-Submitted": "auto-replied" }, "Auto-Submitted"],
    [{ "auto-submitted": "auto-generated" }, "Auto-Submitted (case-insensitive)"],
    [{ Precedence: "bulk" }, "Precedence: bulk"],
    [{ Precedence: "auto_reply" }, "Precedence: auto_reply"],
    [{ "X-Auto-Response-Suppress": "All" }, "X-Auto-Response-Suppress: All"],
    [{ "Return-Path": "<>" }, "Return-Path: <> (bounce)"],
  ])("drops the email (200) without creating a ticket when headers indicate %o", async (headers, _label) => {
    vi.mocked(resend.emails.receiving.get).mockResolvedValueOnce({
      data: { text: "Out of office", headers } as any,
      error: null,
      headers: null,
    });

    const beforeCount = await prisma.ticket.count();
    const res = await request(app)
      .post("/api/inbound-email")
      .set(SVIX_HEADERS)
      .send(makeEvent({ from: `Loop Sender <loop-${Date.now()}@example.com>` }));

    expect(res.status).toBe(200);
    expect(res.body.dropped).toBe(true);
    const afterCount = await prisma.ticket.count();
    expect(afterCount).toBe(beforeCount);
  });

  it("does not drop when Auto-Submitted is 'no'", async () => {
    vi.mocked(resend.emails.receiving.get).mockResolvedValueOnce({
      data: { text: "Normal email", headers: { "Auto-Submitted": "no" } } as any,
      error: null,
      headers: null,
    });

    const res = await request(app)
      .post("/api/inbound-email")
      .set(SVIX_HEADERS)
      .send(makeEvent({ from: `Normal Sender <normal-${Date.now()}@example.com>` }));

    expect(res.status).toBe(201);
    expect(res.body.type).toBe("ticket");
    createdTicketId = res.body.ticket.id;
  });

  it("deduplicates webhook deliveries with the same email_id (returns 200, no new rows)", async () => {
    const stableEmailId = `dedup-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    vi.mocked(resend.emails.receiving.get).mockResolvedValue({
      data: { text: "Hello dedup", html: null, headers: null } as any,
      error: null,
      headers: null,
    });

    const firstRes = await request(app)
      .post("/api/inbound-email")
      .set(SVIX_HEADERS)
      .send(
        makeEvent({
          from: `Dedup Sender <dedup-${Date.now()}@example.com>`,
          email_id: stableEmailId,
        }),
      );
    expect(firstRes.status).toBe(201);
    createdTicketId = firstRes.body.ticket.id;
    const ticketCountAfterFirst = await prisma.ticket.count();

    const secondRes = await request(app)
      .post("/api/inbound-email")
      .set(SVIX_HEADERS)
      .send(
        makeEvent({
          from: `Dedup Sender <dedup-second@example.com>`,
          email_id: stableEmailId,
        }),
      );
    expect(secondRes.status).toBe(200);
    expect(secondRes.body.deduplicated).toBe(true);

    const ticketCountAfterSecond = await prisma.ticket.count();
    expect(ticketCountAfterSecond).toBe(ticketCountAfterFirst);
  });

  it("returns 200 deduplicated when a concurrent new-ticket insert loses the P2002 race", async () => {
    // Simulate the race: SELECT dedup misses (no row yet), then ticket.create
    // throws unique-constraint because a sibling request inserted in the gap.
    // vi.spyOn doesn't restore cleanly against Prisma's dynamic getters, so
    // save/restore the method manually.
    const original = prisma.ticket.create;
    prisma.ticket.create = vi.fn().mockRejectedValueOnce(
      Object.assign(new Error("Unique constraint failed"), {
        code: "P2002",
        meta: { target: ["resendEmailId"] },
      }),
    ) as typeof prisma.ticket.create;

    try {
      const res = await request(app)
        .post("/api/inbound-email")
        .set(SVIX_HEADERS)
        .send(makeEvent());

      expect(res.status).toBe(200);
      expect(res.body.deduplicated).toBe(true);
    } finally {
      prisma.ticket.create = original;
    }
  });

  it("returns 200 deduplicated when a concurrent reply insert loses the P2002 race", async () => {
    // Existing ticket so the handler hits the reply path (transaction).
    const existing = await prisma.ticket.create({
      data: {
        fromName: "Race Tester",
        fromEmail: "race@example.com",
        subject: "Race subject",
        body: "First message",
        status: TicketStatus.open,
      },
    });
    createdTicketId = existing.id;

    const original = prisma.$transaction;
    prisma.$transaction = vi.fn().mockRejectedValueOnce(
      Object.assign(new Error("Unique constraint failed"), {
        code: "P2002",
        meta: { target: ["resendEmailId"] },
      }),
    ) as typeof prisma.$transaction;

    try {
      const res = await request(app)
        .post("/api/inbound-email")
        .set(SVIX_HEADERS)
        .send(
          makeEvent({
            from: "Race Tester <race@example.com>",
            subject: "Race subject",
          }),
        );

      expect(res.status).toBe(200);
      expect(res.body.deduplicated).toBe(true);
    } finally {
      prisma.$transaction = original;
    }
  });
});

describe("POST /api/inbound-email — AI auto-unassign + agent notification", () => {
  let aiUserId: string;
  let humanAgentId: string;
  let createdTicketId: number | undefined;
  let createdReplyId: number | undefined;

  beforeEach(async () => {
    vi.mocked(resend.webhooks.verify).mockReset();
    vi.mocked(resend.emails.receiving.get).mockReset();
    vi.mocked(resend.emails.receiving.get).mockResolvedValue({
      data: { text: "Reply text", headers: null } as any,
      error: null,
      headers: null,
    });
    vi.mocked(boss.send).mockClear();
  });

  afterEach(async () => {
    if (createdReplyId !== undefined) {
      await prisma.reply.deleteMany({ where: { id: createdReplyId } });
      createdReplyId = undefined;
    }
    if (createdTicketId !== undefined) {
      await prisma.ticket.delete({ where: { id: createdTicketId } });
      createdTicketId = undefined;
    }
  });

  afterAll(async () => {
    if (humanAgentId) await prisma.user.delete({ where: { id: humanAgentId } });
    await prisma.user.deleteMany({ where: { email: "ai@helpdesk.internal" } });
  });

  it("unassigns AI when auto-reopening a resolved ticket that was AI-assigned", async () => {
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
    const aiUser = await prisma.user.findUnique({
      where: { email: "ai@helpdesk.internal" },
    });
    aiUserId = aiUser!.id;
    await initAiUserId();

    const existing = await prisma.ticket.create({
      data: {
        fromName: "Alice",
        fromEmail: "alice-airepol@example.com",
        subject: "AI reopen test",
        body: "First",
        status: TicketStatus.resolved,
        resolvedAt: new Date(),
        assignedToId: aiUserId,
      },
    });
    createdTicketId = existing.id;

    const res = await request(app)
      .post("/api/inbound-email")
      .set(SVIX_HEADERS)
      .send(
        makeEvent({
          from: "Alice <alice-airepol@example.com>",
          subject: "Re: AI reopen test",
        }),
      );

    expect(res.status).toBe(201);
    expect(res.body.reopened).toBe(true);
    createdReplyId = res.body.reply.id;

    const refreshed = await prisma.ticket.findUnique({
      where: { id: existing.id },
      select: { status: true, assignedToId: true },
    });
    expect(refreshed!.status).toBe(TicketStatus.open);
    expect(refreshed!.assignedToId).toBeNull();
  });

  it("preserves human assignment when auto-reopening and creates an in-app notification for the human agent", async () => {
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
    await initAiUserId();

    humanAgentId = generateId();
    await prisma.user.create({
      data: {
        id: humanAgentId,
        name: "Helper Agent",
        email: "helper@example.com",
        emailVerified: true,
        role: "agent",
        createdAt: now,
        updatedAt: now,
      },
    });

    const existing = await prisma.ticket.create({
      data: {
        fromName: "Bob",
        fromEmail: "bob-humanrepol@example.com",
        subject: "Human reopen test",
        body: "First",
        status: TicketStatus.resolved,
        resolvedAt: new Date(),
        assignedToId: humanAgentId,
      },
    });
    createdTicketId = existing.id;

    const res = await request(app)
      .post("/api/inbound-email")
      .set(SVIX_HEADERS)
      .send(
        makeEvent({
          from: "Bob <bob-humanrepol@example.com>",
          subject: "Re: Human reopen test",
        }),
      );

    expect(res.status).toBe(201);
    createdReplyId = res.body.reply.id;

    const refreshed = await prisma.ticket.findUnique({
      where: { id: existing.id },
      select: { assignedToId: true },
    });
    expect(refreshed!.assignedToId).toBe(humanAgentId);

    const notif = await prisma.notification.findFirst({
      where: {
        userId: humanAgentId,
        ticketId: existing.id,
        type: NotificationType.customer_reply,
      },
    });
    expect(notif).not.toBeNull();
    await prisma.notification.deleteMany({ where: { userId: humanAgentId } });
  });

  it("does not create a notification when the assignee is the AI user", async () => {
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
    const aiUser = await prisma.user.findUnique({
      where: { email: "ai@helpdesk.internal" },
    });
    aiUserId = aiUser!.id;
    await initAiUserId();

    const existing = await prisma.ticket.create({
      data: {
        fromName: "Carol",
        fromEmail: "carol-ainotify@example.com",
        subject: "AI notify test",
        body: "First",
        status: TicketStatus.open,
        assignedToId: aiUserId,
      },
    });
    createdTicketId = existing.id;

    const res = await request(app)
      .post("/api/inbound-email")
      .set(SVIX_HEADERS)
      .send(
        makeEvent({
          from: "Carol <carol-ainotify@example.com>",
          subject: "Re: AI notify test",
        }),
      );

    expect(res.status).toBe(201);
    createdReplyId = res.body.reply.id;

    const aiNotifs = await prisma.notification.findMany({ where: { userId: aiUserId } });
    expect(aiNotifs).toHaveLength(0);
  });
});
