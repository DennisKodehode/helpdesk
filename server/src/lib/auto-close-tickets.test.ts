import { TicketStatus } from "@helpdesk/core";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runAutoCloseTickets } from "./auto-close-tickets";
import { prisma } from "./prisma";
import { WORKFLOW_SETTINGS_DEFAULTS, WORKFLOW_SETTINGS_ID } from "./workflow-settings";

const HOUR = 60 * 60 * 1000;
// The auto-close window is now driven by the workflow setting `autoCloseDays`.
// Each test sets the settings it needs (the singleton is shared across the
// suite), so derive the age threshold from a known value.
const WINDOW_DAYS = 7;
const WINDOW_HOURS = WINDOW_DAYS * 24;

async function setAutoCloseSettings(autoCloseOn: boolean, autoCloseDays = WINDOW_DAYS) {
  await prisma.workflowSettings.upsert({
    where: { id: WORKFLOW_SETTINGS_ID },
    create: {
      id: WORKFLOW_SETTINGS_ID,
      ...WORKFLOW_SETTINGS_DEFAULTS,
      autoCloseOn,
      autoCloseDays,
    },
    update: { autoCloseOn, autoCloseDays },
  });
}

describe("runAutoCloseTickets", () => {
  const createdIds: number[] = [];

  beforeEach(async () => {
    await setAutoCloseSettings(true);
  });

  afterEach(async () => {
    if (createdIds.length > 0) {
      await prisma.ticket.deleteMany({ where: { id: { in: createdIds } } });
      createdIds.length = 0;
    }
    // Restore defaults so a later suite reading the singleton sees them.
    await setAutoCloseSettings(
      WORKFLOW_SETTINGS_DEFAULTS.autoCloseOn,
      WORKFLOW_SETTINGS_DEFAULTS.autoCloseDays,
    );
  });

  it("closes resolved tickets older than the configured window and sets closedAt", async () => {
    const oldResolvedAt = new Date(Date.now() - (WINDOW_HOURS + 1) * HOUR);
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

    const refreshed = await prisma.ticket.findUnique({
      where: { id: ticket.id },
      select: { status: true, closedAt: true },
    });
    expect(refreshed!.status).toBe(TicketStatus.closed);
    expect(refreshed!.closedAt).not.toBeNull();

    const events = await prisma.auditEvent.findMany({ where: { ticketId: ticket.id } });
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("auto_closed");
    expect(events[0].actorId).toBeNull();
  });

  it("creates one auto_closed audit event per closed ticket on a multi-ticket run", async () => {
    const oldResolvedAt = new Date(Date.now() - (WINDOW_HOURS + 1) * HOUR);
    const tickets = await Promise.all(
      [1, 2, 3].map((n) =>
        prisma.ticket.create({
          data: {
            fromName: `Multi Close ${n}`,
            fromEmail: `multi-close-${n}@example.com`,
            subject: `Multi ${n}`,
            body: "",
            status: TicketStatus.resolved,
            resolvedAt: oldResolvedAt,
          },
        }),
      ),
    );
    for (const t of tickets) createdIds.push(t.id);

    const result = await runAutoCloseTickets();
    expect(result.closedCount).toBe(3);

    const events = await prisma.auditEvent.findMany({
      where: { ticketId: { in: tickets.map((t) => t.id) } },
    });
    expect(events).toHaveLength(3);
    expect(events.every((e) => e.type === "auto_closed")).toBe(true);
    expect(events.every((e) => e.actorId === null)).toBe(true);
  });

  it("leaves resolved tickets younger than the window untouched", async () => {
    const recentResolvedAt = new Date(Date.now() - (WINDOW_HOURS - 1) * HOUR);
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

    const refreshed = await prisma.ticket.findUnique({
      where: { id: ticket.id },
      select: { status: true, closedAt: true },
    });
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

    const refreshed = await prisma.ticket.findUnique({
      where: { id: ticket.id },
      select: { status: true },
    });
    expect(refreshed!.status).toBe(TicketStatus.open);
  });

  it("skips entirely when autoCloseOn is off, leaving old resolved tickets open", async () => {
    await setAutoCloseSettings(false);
    const oldResolvedAt = new Date(Date.now() - (WINDOW_HOURS + 1) * HOUR);
    const ticket = await prisma.ticket.create({
      data: {
        fromName: "Disabled Close",
        fromEmail: "disabled-close@example.com",
        subject: "Disabled",
        body: "",
        status: TicketStatus.resolved,
        resolvedAt: oldResolvedAt,
      },
    });
    createdIds.push(ticket.id);

    const result = await runAutoCloseTickets();
    expect(result.closedCount).toBe(0);

    const refreshed = await prisma.ticket.findUnique({
      where: { id: ticket.id },
      select: { status: true },
    });
    expect(refreshed!.status).toBe(TicketStatus.resolved);
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

    const refreshed = await prisma.ticket.findUnique({
      where: { id: ticket.id },
      select: { status: true },
    });
    expect(refreshed!.status).toBe(TicketStatus.resolved);
  });
});
