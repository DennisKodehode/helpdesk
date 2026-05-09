import { describe, it, expect, afterEach } from "vitest";
import request from "supertest";
import app from "../app";
import { prisma } from "../lib/prisma";
import { TicketStatus, SenderType } from "@helpdesk/core";

const VALID_HEADERS = { "x-webhook-secret": process.env.WEBHOOK_SECRET! };
const VALID_BODY = {
  fromName: "Alice",
  fromEmail: "alice@example.com",
  subject: "Hello",
  body: "Hi there",
};

describe("POST /api/webhooks/inbound-email", () => {
  let createdTicketId: number | undefined;
  let createdReplyId: number | undefined;

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

  it("returns 401 when x-webhook-secret header is missing", async () => {
    const res = await request(app).post("/api/webhooks/inbound-email").send(VALID_BODY);
    expect(res.status).toBe(401);
    expect(res.body.error).toBeTypeOf("string");
  });

  it("returns 401 when x-webhook-secret is wrong", async () => {
    const res = await request(app)
      .post("/api/webhooks/inbound-email")
      .set("x-webhook-secret", "wrong-secret")
      .send(VALID_BODY);
    expect(res.status).toBe(401);
  });

  it("returns 400 when fromName is missing", async () => {
    const res = await request(app)
      .post("/api/webhooks/inbound-email")
      .set(VALID_HEADERS)
      .send({ fromEmail: "alice@example.com" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeTypeOf("string");
  });

  it("returns 400 when fromEmail is not a valid email", async () => {
    const res = await request(app)
      .post("/api/webhooks/inbound-email")
      .set(VALID_HEADERS)
      .send({ ...VALID_BODY, fromEmail: "not-an-email" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/email/i);
  });

  it("returns 201 and creates a new ticket when no existing ticket matches the email", async () => {
    const res = await request(app)
      .post("/api/webhooks/inbound-email")
      .set(VALID_HEADERS)
      .send(VALID_BODY);

    expect(res.status).toBe(201);
    expect(res.body.type).toBe("ticket");
    expect(res.body.ticket.fromName).toBe(VALID_BODY.fromName);
    expect(res.body.ticket.fromEmail).toBe(VALID_BODY.fromEmail);
    expect(res.body.ticket.subject).toBe(VALID_BODY.subject);
    expect(res.body.ticket.body).toBe(VALID_BODY.body);
    expect(res.body.ticket.status).toBe(TicketStatus.open);
    expect(res.body.ticket.category).toBeNull();

    createdTicketId = res.body.ticket.id;
    const inDb = await prisma.ticket.findUnique({ where: { id: createdTicketId } });
    expect(inDb).not.toBeNull();
  });

  it("defaults subject to '(no subject)' when omitted", async () => {
    const { subject: _subject, ...bodyWithoutSubject } = VALID_BODY;
    const res = await request(app)
      .post("/api/webhooks/inbound-email")
      .set(VALID_HEADERS)
      .send(bodyWithoutSubject);

    expect(res.status).toBe(201);
    expect(res.body.type).toBe("ticket");
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
      .post("/api/webhooks/inbound-email")
      .set(VALID_HEADERS)
      .send({ ...VALID_BODY, fromEmail: "strip-test@example.com", subject: rawSubject });

    expect(res.status).toBe(201);
    expect(res.body.ticket.subject).toBe(cleanSubject);

    createdTicketId = res.body.ticket.id;
  });

  it("creates a customer reply on the existing open ticket when fromEmail matches", async () => {
    const existing = await prisma.ticket.create({
      data: { fromName: "Alice", fromEmail: "alice@example.com", subject: "Original", body: "First message", status: TicketStatus.open },
    });
    createdTicketId = existing.id;

    const res = await request(app)
      .post("/api/webhooks/inbound-email")
      .set(VALID_HEADERS)
      .send({ ...VALID_BODY, subject: "Re: Original", body: "Follow-up message" });

    expect(res.status).toBe(201);
    expect(res.body.type).toBe("reply");
    expect(res.body.reply.ticketId).toBe(existing.id);
    expect(res.body.reply.senderType).toBe(SenderType.customer);
    expect(res.body.reply.body).toBe("Follow-up message");

    createdReplyId = res.body.reply.id;
  });

  it("creates a customer reply on a resolved ticket (not yet closed)", async () => {
    const existing = await prisma.ticket.create({
      data: { fromName: "Alice", fromEmail: "alice@example.com", subject: "Original", body: "First message", status: TicketStatus.resolved },
    });
    createdTicketId = existing.id;

    const res = await request(app)
      .post("/api/webhooks/inbound-email")
      .set(VALID_HEADERS)
      .send({ ...VALID_BODY, body: "Actually I have another question" });

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

    const res = await request(app)
      .post("/api/webhooks/inbound-email")
      .set(VALID_HEADERS)
      .send(VALID_BODY);

    expect(res.status).toBe(201);
    expect(res.body.type).toBe("ticket");
    expect(res.body.ticket.id).not.toBe(existing.id);

    createdTicketId = res.body.ticket.id;
    await prisma.ticket.delete({ where: { id: existing.id } });
  });
});
