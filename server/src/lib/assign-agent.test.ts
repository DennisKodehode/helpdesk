import { AutoAssignMode, TicketStatus, UserStatus } from "@helpdesk/core";
import { generateId } from "better-auth";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { pickAssignee } from "./assign-agent";
import { prisma } from "./prisma";
import {
  WORKFLOW_SETTINGS_DEFAULTS,
  WORKFLOW_SETTINGS_ID,
  type WorkflowSettingsRow,
} from "./workflow-settings";

// Builds a settings row object (not persisted) for passing to pickAssignee.
function settings(overrides: Partial<WorkflowSettingsRow>): WorkflowSettingsRow {
  return {
    id: WORKFLOW_SETTINGS_ID,
    ...WORKFLOW_SETTINGS_DEFAULTS,
    updatedAt: new Date(0),
    ...overrides,
  } as WorkflowSettingsRow;
}

describe("pickAssignee", () => {
  const userIds: string[] = [];
  const ticketIds: number[] = [];

  async function createAgent(opts: {
    email: string;
    status?: UserStatus;
    createdAt: Date;
    deleted?: boolean;
  }) {
    const id = generateId();
    await prisma.user.create({
      data: {
        id,
        name: opts.email,
        email: opts.email,
        emailVerified: true,
        role: "agent",
        status: opts.status ?? UserStatus.active,
        deletedAt: opts.deleted ? new Date() : null,
        createdAt: opts.createdAt,
        updatedAt: opts.createdAt,
      },
    });
    userIds.push(id);
    return id;
  }

  beforeEach(async () => {
    await prisma.workflowSettings.upsert({
      where: { id: WORKFLOW_SETTINGS_ID },
      create: {
        id: WORKFLOW_SETTINGS_ID,
        ...WORKFLOW_SETTINGS_DEFAULTS,
        roundRobinCursor: 0,
      },
      update: { roundRobinCursor: 0 },
    });
  });

  afterEach(async () => {
    if (ticketIds.length) {
      await prisma.ticket.deleteMany({ where: { id: { in: ticketIds } } });
      ticketIds.length = 0;
    }
    if (userIds.length) {
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      userIds.length = 0;
    }
    await prisma.workflowSettings.update({
      where: { id: WORKFLOW_SETTINGS_ID },
      data: { roundRobinCursor: 0 },
    });
  });

  it("returns null when there are no active agents", async () => {
    await createAgent({
      email: "rr-invited@example.com",
      status: UserStatus.invited,
      createdAt: new Date("2020-01-01"),
    });
    const result = await prisma.$transaction((tx) =>
      pickAssignee(tx, settings({ autoAssignMode: AutoAssignMode.round_robin })),
    );
    expect(result).toBeNull();
  });

  it("round-robin cycles across active agents in createdAt order and advances the cursor", async () => {
    const a = await createAgent({
      email: "rr-a@example.com",
      createdAt: new Date("2020-01-01"),
    });
    const b = await createAgent({
      email: "rr-b@example.com",
      createdAt: new Date("2020-01-02"),
    });

    const picks: (string | null)[] = [];
    for (let i = 0; i < 3; i++) {
      const cur = await prisma.workflowSettings.findUnique({
        where: { id: WORKFLOW_SETTINGS_ID },
      });
      picks.push(
        await prisma.$transaction((tx) =>
          pickAssignee(
            tx,
            settings({
              autoAssignMode: AutoAssignMode.round_robin,
              roundRobinCursor: cur!.roundRobinCursor,
            }),
          ),
        ),
      );
    }
    // Cursor 0,1,2 → a, b, a (wraps).
    expect(picks).toEqual([a, b, a]);
  });

  it("least-loaded picks the active agent with the fewest open tickets", async () => {
    const a = await createAgent({
      email: "ll-a@example.com",
      createdAt: new Date("2020-01-01"),
    });
    const b = await createAgent({
      email: "ll-b@example.com",
      createdAt: new Date("2020-01-02"),
    });
    // a has two open tickets; b has none → b should win.
    for (let i = 0; i < 2; i++) {
      const t = await prisma.ticket.create({
        data: {
          fromName: "Load",
          fromEmail: `ll-${i}@example.com`,
          subject: "Load",
          body: "",
          status: TicketStatus.open,
          assignedToId: a,
        },
      });
      ticketIds.push(t.id);
    }
    const result = await prisma.$transaction((tx) =>
      pickAssignee(tx, settings({ autoAssignMode: AutoAssignMode.least_loaded })),
    );
    expect(result).toBe(b);
  });

  it("excludes inactive and soft-deleted agents", async () => {
    const active = await createAgent({
      email: "ll-active@example.com",
      createdAt: new Date("2020-01-03"),
    });
    await createAgent({
      email: "ll-inactive@example.com",
      status: UserStatus.inactive,
      createdAt: new Date("2020-01-01"),
    });
    await createAgent({
      email: "ll-deleted@example.com",
      createdAt: new Date("2020-01-02"),
      deleted: true,
    });
    const result = await prisma.$transaction((tx) =>
      pickAssignee(tx, settings({ autoAssignMode: AutoAssignMode.least_loaded })),
    );
    expect(result).toBe(active);
  });
});
