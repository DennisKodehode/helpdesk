import { describe, it, expect, afterEach } from "vitest";
import request from "supertest";
import app from "../app";
import { prisma } from "../lib/prisma";
import { TicketStatus } from "@helpdesk/core";

const VALID_HEADERS = { "x-webhook-secret": process.env.WEBHOOK_SECRET! };
const VALID_BODY = {
  fromName: "Alice",
  fromEmail: "alice@example.com",
  subject: "Hello",
  body: "Hi there",
};

describe("POST /api/webhooks/inbound-email", () => {
  let createdId: number | undefined;

  afterEach(async () => {
    if (createdId !== undefined) {
      await prisma.ticket.delete({ where: { id: createdId } });
      createdId = undefined;
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

  it("returns 201 and creates a ticket with status 'open'", async () => {
    const res = await request(app)
      .post("/api/webhooks/inbound-email")
      .set(VALID_HEADERS)
      .send(VALID_BODY);

    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.fromName).toBe(VALID_BODY.fromName);
    expect(res.body.fromEmail).toBe(VALID_BODY.fromEmail);
    expect(res.body.subject).toBe(VALID_BODY.subject);
    expect(res.body.body).toBe(VALID_BODY.body);
    expect(res.body.status).toBe(TicketStatus.open);

    createdId = res.body.id;
    const inDb = await prisma.ticket.findUnique({ where: { id: createdId } });
    expect(inDb).not.toBeNull();
    expect(inDb!.status).toBe(TicketStatus.open);
  });

  it("defaults subject to '(no subject)' when omitted", async () => {
    const { subject: _subject, ...bodyWithoutSubject } = VALID_BODY;
    const res = await request(app)
      .post("/api/webhooks/inbound-email")
      .set(VALID_HEADERS)
      .send(bodyWithoutSubject);

    expect(res.status).toBe(201);
    expect(res.body.subject).toBe("(no subject)");

    createdId = res.body.id;
  });
});
