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
      receiving: {
        get: vi.fn(),
        attachments: { list: vi.fn() },
      },
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
  overrides: {
    from?: string;
    subject?: string;
    email_id?: string;
    attachments?: Array<{
      id: string;
      filename: string | null;
      content_type: string;
      size: number;
      content_id?: string | null;
      content_disposition?: string | null;
    }>;
  } = {},
) => ({
  type: "email.received",
  data: {
    email_id: overrides.email_id ?? uniqueEmailId(),
    from: overrides.from ?? "Alice <alice@example.com>",
    subject: overrides.subject ?? "Hello",
    to: ["support@contact.tjemsland.dev"],
    ...(overrides.attachments ? { attachments: overrides.attachments } : {}),
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

  it("returns 200 without creating anything for unknown event types", async () => {
    const res = await request(app)
      .post("/api/inbound-email")
      .set(SVIX_HEADERS)
      .send({ type: "email.unknown_event", data: {} });

    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
  });

  it("creates an EmailSuppression row for a Permanent email.bounced event", async () => {
    const recipient = `bounce-${Date.now()}@example.com`;
    const res = await request(app)
      .post("/api/inbound-email")
      .set(SVIX_HEADERS)
      .send({
        type: "email.bounced",
        data: {
          email_id: `bounce-id-${Date.now()}`,
          to: [recipient],
          from: "support@helpdesk.test",
          subject: "Re: anything",
          bounce: { type: "Permanent", subType: "General" },
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.acknowledged).toBe(true);
    const row = await prisma.emailSuppression.findUnique({
      where: { email: recipient.toLowerCase() },
    });
    expect(row).not.toBeNull();
    expect(row?.reason).toBe("hard_bounce");
    expect(row?.detail).toBe("Permanent/General");
    await prisma.emailSuppression.delete({ where: { email: recipient.toLowerCase() } });
  });

  it("does NOT suppress on a Transient email.bounced event", async () => {
    const recipient = `transient-${Date.now()}@example.com`;
    const res = await request(app)
      .post("/api/inbound-email")
      .set(SVIX_HEADERS)
      .send({
        type: "email.bounced",
        data: {
          email_id: `transient-id-${Date.now()}`,
          to: [recipient],
          from: "support@helpdesk.test",
          subject: "Re: anything",
          bounce: { type: "Transient", subType: "MailboxFull" },
        },
      });

    expect(res.status).toBe(200);
    const row = await prisma.emailSuppression.findUnique({
      where: { email: recipient.toLowerCase() },
    });
    expect(row).toBeNull();
  });

  it("creates an EmailSuppression row with reason=complaint for email.complained", async () => {
    const recipient = `complained-${Date.now()}@example.com`;
    const res = await request(app)
      .post("/api/inbound-email")
      .set(SVIX_HEADERS)
      .send({
        type: "email.complained",
        data: {
          email_id: `complaint-id-${Date.now()}`,
          to: [recipient],
          from: "support@helpdesk.test",
          subject: "Re: anything",
        },
      });

    expect(res.status).toBe(200);
    expect(res.body.acknowledged).toBe(true);
    const row = await prisma.emailSuppression.findUnique({
      where: { email: recipient.toLowerCase() },
    });
    expect(row?.reason).toBe("complaint");
    await prisma.emailSuppression.delete({ where: { email: recipient.toLowerCase() } });
  });

  it("is idempotent for repeated bounce/complaint events on the same email", async () => {
    const recipient = `idempotent-${Date.now()}@example.com`;
    const payload = {
      type: "email.bounced",
      data: {
        email_id: "first",
        to: [recipient],
        from: "support@helpdesk.test",
        subject: "Re: anything",
        bounce: { type: "Permanent", subType: "General" },
      },
    };
    await request(app).post("/api/inbound-email").set(SVIX_HEADERS).send(payload);
    await request(app).post("/api/inbound-email").set(SVIX_HEADERS).send(payload);
    const rows = await prisma.emailSuppression.findMany({
      where: { email: recipient.toLowerCase() },
    });
    expect(rows).toHaveLength(1);
    await prisma.emailSuppression.delete({ where: { email: recipient.toLowerCase() } });
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

    const refreshed = await prisma.ticket.findUnique({
      where: { id: existing.id },
      select: { lastReplySenderType: true },
    });
    expect(refreshed!.lastReplySenderType).toBe(SenderType.customer);
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
    // The new-ticket path now runs inside prisma.$transaction (so the
    // boss.send can use fromPrisma for atomic enqueue). To simulate the race,
    // make the whole transaction reject with the P2002 error — the outer
    // try/catch in the route handler should still translate to 200 dedup.
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
        .send(makeEvent());

      expect(res.status).toBe(200);
      expect(res.body.deduplicated).toBe(true);
    } finally {
      prisma.$transaction = original;
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

  it("records a ticket_created audit event on new ticket", async () => {
    const res = await request(app)
      .post("/api/inbound-email")
      .set(SVIX_HEADERS)
      .send(
        makeEvent({
          from: "Audit New <audit-new@example.com>",
          subject: "Audit new ticket subject",
        }),
      );

    expect(res.status).toBe(201);
    createdTicketId = res.body.ticket.id;

    const events = await prisma.auditEvent.findMany({
      where: { ticketId: createdTicketId },
    });
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("ticket_created");
    expect(events[0].actorId).toBeNull();
    expect(events[0].data).toEqual({ fromEmail: "audit-new@example.com" });
  });

  it("records a reply_added audit event on customer reply to an open ticket", async () => {
    const existing = await prisma.ticket.create({
      data: {
        fromName: "Audit Reply",
        fromEmail: "audit-reply@example.com",
        subject: "Audit reply subject",
        body: "First message",
        status: TicketStatus.open,
      },
    });
    createdTicketId = existing.id;

    const res = await request(app)
      .post("/api/inbound-email")
      .set(SVIX_HEADERS)
      .send(
        makeEvent({
          from: "Audit Reply <audit-reply@example.com>",
          subject: "Re: Audit reply subject",
        }),
      );

    expect(res.status).toBe(201);
    createdReplyId = res.body.reply.id;

    const events = await prisma.auditEvent.findMany({
      where: { ticketId: existing.id },
    });
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("reply_added");
    expect(events[0].actorId).toBeNull();
    expect(events[0].data).toEqual({
      replyId: createdReplyId,
      senderType: SenderType.customer,
    });
  });

  it("records reply_added + auto_reopened on customer reply to a resolved ticket", async () => {
    const existing = await prisma.ticket.create({
      data: {
        fromName: "Audit Reopen",
        fromEmail: "audit-reopen@example.com",
        subject: "Audit reopen subject",
        body: "First message",
        status: TicketStatus.resolved,
        resolvedAt: new Date(),
      },
    });
    createdTicketId = existing.id;

    const res = await request(app)
      .post("/api/inbound-email")
      .set(SVIX_HEADERS)
      .send(
        makeEvent({
          from: "Audit Reopen <audit-reopen@example.com>",
          subject: "Re: Audit reopen subject",
        }),
      );

    expect(res.status).toBe(201);
    createdReplyId = res.body.reply.id;

    const events = await prisma.auditEvent.findMany({
      where: { ticketId: existing.id },
      orderBy: { type: "asc" },
    });
    expect(events.map((e) => e.type).sort()).toEqual(["auto_reopened", "reply_added"]);
  });

  describe("inbound attachments (customer-reply path)", () => {
    let originalFetch: typeof globalThis.fetch;

    beforeEach(() => {
      originalFetch = globalThis.fetch;
      vi.mocked(resend.emails.receiving.attachments.list).mockReset();
    });

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    async function seedRepliableTicket() {
      return prisma.ticket.create({
        data: {
          fromName: "Alice",
          fromEmail: "alice@example.com",
          subject: "Hello",
          body: "First message",
          status: TicketStatus.open,
        },
      });
    }

    function mockAttachmentsList(
      items: Array<{
        id: string;
        filename: string | null;
        content_type: string;
        size: number;
        download_url: string;
      }>,
    ) {
      // SDK wraps the array in { object, has_more, data } per ListAttachmentsResponseSuccess.
      vi.mocked(resend.emails.receiving.attachments.list).mockResolvedValueOnce({
        data: { object: "list", has_more: false, data: items } as never,
        error: null,
      } as never);
    }

    function mockFetchBuffer(map: Record<string, Buffer>) {
      globalThis.fetch = vi.fn(async (url: string) => {
        const buf = map[url];
        if (!buf) {
          return new Response(null, { status: 404 });
        }
        return new Response(buf as unknown as BodyInit, { status: 200 });
      }) as unknown as typeof globalThis.fetch;
    }

    it("persists a PNG attachment from the inbound webhook onto the customer reply", async () => {
      const existing = await seedRepliableTicket();
      createdTicketId = existing.id;
      const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

      mockAttachmentsList([
        {
          id: "att-png",
          filename: "screenshot.png",
          content_type: "image/png",
          size: pngBytes.length,
          download_url: "https://example.com/dl/att-png",
        },
      ]);
      mockFetchBuffer({ "https://example.com/dl/att-png": pngBytes });

      const res = await request(app)
        .post("/api/inbound-email")
        .set(SVIX_HEADERS)
        .send(
          makeEvent({
            subject: "Re: Hello",
            attachments: [
              {
                id: "att-png",
                filename: "screenshot.png",
                content_type: "image/png",
                size: pngBytes.length,
              },
            ],
          }),
        );

      expect(res.status).toBe(201);
      createdReplyId = res.body.reply.id;

      const persisted = await prisma.attachment.findMany({
        where: { replyId: createdReplyId },
      });
      expect(persisted).toHaveLength(1);
      expect(persisted[0].filename).toBe("screenshot.png");
      expect(persisted[0].contentType).toBe("image/png");
      expect(persisted[0].size).toBe(pngBytes.length);
      expect(persisted[0].storageKey).toMatch(/^attachments\/reply-\d+\//);
    });

    it("skips a denylisted SVG attachment but still creates the reply", async () => {
      const existing = await seedRepliableTicket();
      createdTicketId = existing.id;

      mockAttachmentsList([
        {
          id: "att-svg",
          filename: "evil.svg",
          content_type: "image/svg+xml",
          size: 100,
          download_url: "https://example.com/dl/att-svg",
        },
      ]);
      mockFetchBuffer({}); // shouldn't be called

      const res = await request(app)
        .post("/api/inbound-email")
        .set(SVIX_HEADERS)
        .send(
          makeEvent({
            subject: "Re: Hello",
            attachments: [
              {
                id: "att-svg",
                filename: "evil.svg",
                content_type: "image/svg+xml",
                size: 100,
              },
            ],
          }),
        );

      expect(res.status).toBe(201);
      createdReplyId = res.body.reply.id;

      const persisted = await prisma.attachment.findMany({
        where: { replyId: createdReplyId },
      });
      expect(persisted).toHaveLength(0);
    });

    it("skips an oversize attachment but still creates the reply", async () => {
      const existing = await seedRepliableTicket();
      createdTicketId = existing.id;

      mockAttachmentsList([
        {
          id: "att-big",
          filename: "big.png",
          content_type: "image/png",
          size: 11 * 1024 * 1024,
          download_url: "https://example.com/dl/att-big",
        },
      ]);
      mockFetchBuffer({});

      const res = await request(app)
        .post("/api/inbound-email")
        .set(SVIX_HEADERS)
        .send(
          makeEvent({
            subject: "Re: Hello",
            attachments: [
              {
                id: "att-big",
                filename: "big.png",
                content_type: "image/png",
                size: 11 * 1024 * 1024,
              },
            ],
          }),
        );

      expect(res.status).toBe(201);
      createdReplyId = res.body.reply.id;

      const persisted = await prisma.attachment.findMany({
        where: { replyId: createdReplyId },
      });
      expect(persisted).toHaveLength(0);
    });

    it("persists only the allowed attachment when the batch is mixed", async () => {
      const existing = await seedRepliableTicket();
      createdTicketId = existing.id;
      const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

      mockAttachmentsList([
        {
          id: "att-png",
          filename: "ok.png",
          content_type: "image/png",
          size: pngBytes.length,
          download_url: "https://example.com/dl/ok",
        },
        {
          id: "att-svg",
          filename: "bad.svg",
          content_type: "image/svg+xml",
          size: 50,
          download_url: "https://example.com/dl/bad",
        },
      ]);
      mockFetchBuffer({ "https://example.com/dl/ok": pngBytes });

      const res = await request(app)
        .post("/api/inbound-email")
        .set(SVIX_HEADERS)
        .send(
          makeEvent({
            subject: "Re: Hello",
            attachments: [
              {
                id: "att-png",
                filename: "ok.png",
                content_type: "image/png",
                size: pngBytes.length,
              },
              {
                id: "att-svg",
                filename: "bad.svg",
                content_type: "image/svg+xml",
                size: 50,
              },
            ],
          }),
        );

      expect(res.status).toBe(201);
      createdReplyId = res.body.reply.id;

      const persisted = await prisma.attachment.findMany({
        where: { replyId: createdReplyId },
      });
      expect(persisted).toHaveLength(1);
      expect(persisted[0].filename).toBe("ok.png");
    });
  });

  describe("inbound attachments (new-ticket path)", () => {
    let originalFetch: typeof globalThis.fetch;

    beforeEach(() => {
      originalFetch = globalThis.fetch;
      vi.mocked(resend.emails.receiving.attachments.list).mockReset();
    });

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    function mockAttachmentsList(
      items: Array<{
        id: string;
        filename: string | null;
        content_type: string;
        size: number;
        download_url: string;
      }>,
    ) {
      vi.mocked(resend.emails.receiving.attachments.list).mockResolvedValueOnce({
        data: { object: "list", has_more: false, data: items } as never,
        error: null,
      } as never);
    }

    function mockFetchBuffer(map: Record<string, Buffer>) {
      globalThis.fetch = vi.fn(async (url: string) => {
        const buf = map[url];
        if (!buf) return new Response(null, { status: 404 });
        return new Response(buf as unknown as BodyInit, { status: 200 });
      }) as unknown as typeof globalThis.fetch;
    }

    it("persists a PNG attachment from a brand-new inbound email onto the Ticket", async () => {
      const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      mockAttachmentsList([
        {
          id: "att-png",
          filename: "first-screenshot.png",
          content_type: "image/png",
          size: pngBytes.length,
          download_url: "https://example.com/dl/att-png",
        },
      ]);
      mockFetchBuffer({ "https://example.com/dl/att-png": pngBytes });

      const res = await request(app)
        .post("/api/inbound-email")
        .set(SVIX_HEADERS)
        .send(
          makeEvent({
            from: "Newbie <newbie@example.com>",
            subject: "Brand new ticket with attachment",
            attachments: [
              {
                id: "att-png",
                filename: "first-screenshot.png",
                content_type: "image/png",
                size: pngBytes.length,
              },
            ],
          }),
        );

      expect(res.status).toBe(201);
      expect(res.body.type).toBe("ticket");
      createdTicketId = res.body.ticket.id;

      const persisted = await prisma.attachment.findMany({
        where: { ticketId: createdTicketId },
      });
      expect(persisted).toHaveLength(1);
      expect(persisted[0].filename).toBe("first-screenshot.png");
      expect(persisted[0].ticketId).toBe(createdTicketId);
      expect(persisted[0].replyId).toBeNull();
      expect(persisted[0].storageKey).toMatch(/^attachments\/ticket-\d+\//);
    });

    it("skips a denylisted SVG on a new ticket but still creates the ticket", async () => {
      mockAttachmentsList([
        {
          id: "att-svg",
          filename: "evil.svg",
          content_type: "image/svg+xml",
          size: 50,
          download_url: "https://example.com/dl/att-svg",
        },
      ]);
      mockFetchBuffer({});

      const res = await request(app)
        .post("/api/inbound-email")
        .set(SVIX_HEADERS)
        .send(
          makeEvent({
            from: "Newbie <newbie2@example.com>",
            subject: "New ticket with SVG",
            attachments: [
              {
                id: "att-svg",
                filename: "evil.svg",
                content_type: "image/svg+xml",
                size: 50,
              },
            ],
          }),
        );

      expect(res.status).toBe(201);
      createdTicketId = res.body.ticket.id;

      const persisted = await prisma.attachment.findMany({
        where: { ticketId: createdTicketId },
      });
      expect(persisted).toHaveLength(0);
    });

    it("rejects writing an Attachment with both replyId and ticketId via the CHECK constraint", async () => {
      // Need a Ticket + Reply to FK against.
      const ticket = await prisma.ticket.create({
        data: {
          fromName: "Constraint Test",
          fromEmail: "constraint@example.com",
          subject: "Constraint test",
          body: "",
          status: TicketStatus.open,
        },
      });
      createdTicketId = ticket.id;
      const reply = await prisma.reply.create({
        data: {
          ticketId: ticket.id,
          authorId: null,
          senderType: SenderType.customer,
          body: "x",
        },
      });
      createdReplyId = reply.id;

      await expect(
        prisma.attachment.create({
          data: {
            replyId: reply.id,
            ticketId: ticket.id,
            filename: "both.bin",
            contentType: "application/octet-stream",
            size: 1,
            storageKey: `attachments/test-${Date.now()}-both.bin`,
          },
        }),
      ).rejects.toThrow();

      // Also rejects when neither is set.
      await expect(
        prisma.attachment.create({
          data: {
            replyId: null,
            ticketId: null,
            filename: "neither.bin",
            contentType: "application/octet-stream",
            size: 1,
            storageKey: `attachments/test-${Date.now()}-neither.bin`,
          },
        }),
      ).rejects.toThrow();
    });
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

  it("records assignee_changed (reopenUnassigned) when auto-reopening an AI-assigned resolved ticket", async () => {
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
        fromName: "Audit",
        fromEmail: "audit-ai-reopen@example.com",
        subject: "Audit AI reopen",
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
          from: "Audit <audit-ai-reopen@example.com>",
          subject: "Re: Audit AI reopen",
        }),
      );

    expect(res.status).toBe(201);
    createdReplyId = res.body.reply.id;

    const events = await prisma.auditEvent.findMany({
      where: { ticketId: existing.id },
    });
    const types = events.map((e) => e.type).sort();
    expect(types).toEqual(["assignee_changed", "auto_reopened", "reply_added"]);

    const assigneeEvent = events.find((e) => e.type === "assignee_changed");
    expect(assigneeEvent!.data).toEqual({
      from: aiUserId,
      to: null,
      reopenUnassigned: true,
    });
  });
});
