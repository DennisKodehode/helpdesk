import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import request from "supertest";
import app from "../app";
import { prisma } from "../lib/prisma";
import { TicketStatus, SenderType } from "@helpdesk/core";
import resend from "../lib/resend";

vi.mock("../lib/resend", () => ({
  default: {
    webhooks: { verify: vi.fn() },
    emails: { send: vi.fn() },
  },
}));
vi.mock("../lib/boss", () => ({ default: { send: vi.fn().mockResolvedValue("mock-job-id") } }));

const SVIX_HEADERS = {
  "svix-id": "msg_test_123",
  "svix-timestamp": new Date().toISOString(),
  "svix-signature": "v1,test_signature",
};

const makeEvent = (overrides: { from?: string; subject?: string; text?: string; html?: string } = {}) => ({
  type: "email.received",
  data: {
    email_id: "email-test-123",
    from: overrides.from ?? "Alice <alice@example.com>",
    subject: overrides.subject ?? "Hello",
    to: ["support@contact.tjemsland.dev"],
    text: overrides.text ?? "Hi there",
    html: overrides.html ?? "<p>Hi there</p>",
  },
});

describe("POST /api/inbound-email", () => {
  let createdTicketId: number | undefined;
  let createdReplyId: number | undefined;

  beforeEach(() => {
    vi.mocked(resend.webhooks.verify).mockReset();
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

    const res = await request(app).post("/api/inbound-email").set(SVIX_HEADERS).send(makeEvent());

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
    const res = await request(app).post("/api/inbound-email").set(SVIX_HEADERS).send(makeEvent());

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
      .send(makeEvent({ from: "Strip Test <strip-test@example.com>", subject: rawSubject }));

    expect(res.status).toBe(201);
    expect(res.body.ticket.subject).toBe(cleanSubject);
    createdTicketId = res.body.ticket.id;
  });

  it("creates a customer reply on the existing open ticket when fromEmail and subject match", async () => {
    const existing = await prisma.ticket.create({
      data: { fromName: "Alice", fromEmail: "alice@example.com", subject: "Hello", body: "First message", status: TicketStatus.open },
    });
    createdTicketId = existing.id;

    const res = await request(app)
      .post("/api/inbound-email")
      .set(SVIX_HEADERS)
      .send(makeEvent({ subject: "Re: Hello", text: "Follow-up message", html: "<p>Follow-up message</p>" }));

    expect(res.status).toBe(201);
    expect(res.body.type).toBe("reply");
    expect(res.body.reply.ticketId).toBe(existing.id);
    expect(res.body.reply.senderType).toBe(SenderType.customer);
    expect(res.body.reply.body).toBe("Follow-up message");
    createdReplyId = res.body.reply.id;
  });

  it("creates a new ticket when fromEmail matches but subject is different", async () => {
    const existing = await prisma.ticket.create({
      data: { fromName: "Alice", fromEmail: "alice@example.com", subject: "Hello", body: "First message", status: TicketStatus.open },
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

  it("creates a customer reply on a resolved ticket (not yet closed)", async () => {
    const existing = await prisma.ticket.create({
      data: { fromName: "Alice", fromEmail: "alice@example.com", subject: "Hello", body: "First message", status: TicketStatus.resolved },
    });
    createdTicketId = existing.id;

    const res = await request(app)
      .post("/api/inbound-email")
      .set(SVIX_HEADERS)
      .send(makeEvent({ subject: "Re: Hello", text: "Actually I have another question" }));

    expect(res.status).toBe(201);
    expect(res.body.type).toBe("reply");
    expect(res.body.reply.ticketId).toBe(existing.id);
    expect(res.body.reply.senderType).toBe(SenderType.customer);
    createdReplyId = res.body.reply.id;
  });

  it("creates a new ticket when the only existing ticket from that email is closed", async () => {
    const existing = await prisma.ticket.create({
      data: { fromName: "Alice", fromEmail: "alice@example.com", subject: "Old issue", body: "Resolved long ago", status: TicketStatus.closed },
    });

    const res = await request(app).post("/api/inbound-email").set(SVIX_HEADERS).send(makeEvent());

    expect(res.status).toBe(201);
    expect(res.body.type).toBe("ticket");
    expect(res.body.ticket.id).not.toBe(existing.id);
    createdTicketId = res.body.ticket.id;
    await prisma.ticket.delete({ where: { id: existing.id } });
  });
});
