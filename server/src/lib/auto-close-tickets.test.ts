import { describe, it, expect, afterEach } from "vitest";
import { prisma } from "./prisma";
import { TicketStatus } from "@helpdesk/core";
import { runAutoCloseTickets, AUTO_CLOSE_AGE_HOURS } from "./auto-close-tickets";

const HOUR = 60 * 60 * 1000;

describe("runAutoCloseTickets", () => {
  const createdIds: number[] = [];

  afterEach(async () => {
    if (createdIds.length > 0) {
      await prisma.ticket.deleteMany({ where: { id: { in: createdIds } } });
      createdIds.length = 0;
    }
  });

  it("closes resolved tickets older than the configured window and sets closedAt", async () => {
    const oldResolvedAt = new Date(Date.now() - (AUTO_CLOSE_AGE_HOURS + 1) * HOUR);
    const ticket = await prisma.ticket.create({
      data: {
        fromName: "Old Resolved",
        fromEmail: "old-resolved@example.com",
        subject: "Old",
        body: "",
        status: TicketStatus.resolved,
        resolvedAt: oldResolvedAt,
      },
    });
    createdIds.push(ticket.id);

    await runAutoCloseTickets();

    const refreshed = await prisma.ticket.findUnique({ where: { id: ticket.id }, select: { status: true, closedAt: true } });
    expect(refreshed!.status).toBe(TicketStatus.closed);
    expect(refreshed!.closedAt).not.toBeNull();
  });

  it("leaves resolved tickets younger than the window untouched", async () => {
    const recentResolvedAt = new Date(Date.now() - (AUTO_CLOSE_AGE_HOURS - 1) * HOUR);
    const ticket = await prisma.ticket.create({
      data: {
        fromName: "Recent Resolved",
        fromEmail: "recent-resolved@example.com",
        subject: "Recent",
        body: "",
        status: TicketStatus.resolved,
        resolvedAt: recentResolvedAt,
      },
    });
    createdIds.push(ticket.id);

    await runAutoCloseTickets();

    const refreshed = await prisma.ticket.findUnique({ where: { id: ticket.id }, select: { status: true, closedAt: true } });
    expect(refreshed!.status).toBe(TicketStatus.resolved);
    expect(refreshed!.closedAt).toBeNull();
  });

  it("does not touch open tickets even if they are very old", async () => {
    const ticket = await prisma.ticket.create({
      data: {
        fromName: "Old Open",
        fromEmail: "old-open@example.com",
        subject: "Old open",
        body: "",
        status: TicketStatus.open,
        createdAt: new Date(Date.now() - 10 * 24 * HOUR),
      },
    });
    createdIds.push(ticket.id);

    await runAutoCloseTickets();

    const refreshed = await prisma.ticket.findUnique({ where: { id: ticket.id }, select: { status: true } });
    expect(refreshed!.status).toBe(TicketStatus.open);
  });

  it("does not touch resolved tickets without resolvedAt", async () => {
    const ticket = await prisma.ticket.create({
      data: {
        fromName: "Resolved No Timestamp",
        fromEmail: "no-resolved-at@example.com",
        subject: "No timestamp",
        body: "",
        status: TicketStatus.resolved,
        resolvedAt: null,
      },
    });
    createdIds.push(ticket.id);

    await runAutoCloseTickets();

    const refreshed = await prisma.ticket.findUnique({ where: { id: ticket.id }, select: { status: true } });
    expect(refreshed!.status).toBe(TicketStatus.resolved);
  });
});
