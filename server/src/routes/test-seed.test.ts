import { TicketStatus } from "@helpdesk/core";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";
import app from "../app";
import { prisma } from "../lib/prisma";

// The test-only seed route is mounted only when NODE_ENV === "test" (which the
// vitest run is), so it's reachable here. In dev/prod it isn't mounted at all.
describe("POST /api/test/seed-ticket", () => {
  const createdIds: number[] = [];

  afterEach(async () => {
    if (createdIds.length > 0) {
      await prisma.ticket.deleteMany({ where: { id: { in: createdIds } } });
      createdIds.length = 0;
    }
  });

  it("creates an open ticket from the given fields and returns it", async () => {
    const res = await request(app).post("/api/test/seed-ticket").send({
      fromName: "Seed Person",
      fromEmail: "seed@example.com",
      subject: "Seeded subject",
      body: "Seeded body.",
    });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      subject: "Seeded subject",
      fromName: "Seed Person",
      fromEmail: "seed@example.com",
      body: "Seeded body.",
    });
    expect(typeof res.body.id).toBe("number");
    createdIds.push(res.body.id);

    const ticket = await prisma.ticket.findUnique({ where: { id: res.body.id } });
    // Defaults to `open` so E2E gets an immediately-interactive ticket (not
    // locked behind triaging).
    expect(ticket?.status).toBe(TicketStatus.open);
  });

  it("applies defaults when fields are omitted", async () => {
    const res = await request(app).post("/api/test/seed-ticket").send({});
    expect(res.status).toBe(201);
    expect(typeof res.body.subject).toBe("string");
    expect(res.body.subject.length).toBeGreaterThan(0);
    createdIds.push(res.body.id);
  });
});
