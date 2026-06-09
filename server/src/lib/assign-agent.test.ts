import {
  AuditEventType,
  AutoAssignMode,
  NotificationType,
  TicketStatus,
  UserStatus,
} from "@helpdesk/core";
import { generateId } from "better-auth";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { assignUnassignedTickets, pickAssignee } from "./assign-agent";
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

describe("assignUnassignedTickets", () => {
  const userIds: string[] = [];
  const ticketIds: number[] = [];
  let adminId: string;

  async function createAgent(email: string, createdAt: Date) {
    const id = generateId();
    await prisma.user.create({
      data: {
        id,
        name: email,
        email,
        emailVerified: true,
        role: "agent",
        status: UserStatus.active,
        createdAt,
        updatedAt: createdAt,
      },
    });
    userIds.push(id);
    return id;
  }

  async function createTicket(opts: {
    status?: TicketStatus;
    assignedToId?: string | null;
  }) {
    const t = await prisma.ticket.create({
      data: {
        fromName: "Q",
        fromEmail: `q-${generateId()}@example.com`,
        subject: "Q",
        body: "",
        status: opts.status ?? TicketStatus.open,
        assignedToId: opts.assignedToId ?? null,
      },
    });
    ticketIds.push(t.id);
    return t.id;
  }

  beforeAll(async () => {
    const id = generateId();
    await prisma.user.create({
      data: {
        id,
        name: "wf-admin",
        email: "backfill-admin@example.com",
        emailVerified: true,
        role: "admin",
        status: UserStatus.active,
        createdAt: new Date("2019-01-01"),
        updatedAt: new Date("2019-01-01"),
      },
    });
    adminId = id;
  });

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
      await prisma.notification.deleteMany({ where: { ticketId: { in: ticketIds } } });
      await prisma.auditEvent.deleteMany({ where: { ticketId: { in: ticketIds } } });
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

  afterAll(async () => {
    await prisma.user.delete({ where: { id: adminId } });
  });

  it("round-robin assigns every open, unassigned ticket across agents in order", async () => {
    const a = await createAgent("bf-a@example.com", new Date("2020-01-01"));
    const b = await createAgent("bf-b@example.com", new Date("2020-01-02"));
    const t1 = await createTicket({});
    const t2 = await createTicket({});
    const t3 = await createTicket({});

    const count = await prisma.$transaction((tx) =>
      assignUnassignedTickets(
        tx,
        settings({ autoAssignMode: AutoAssignMode.round_robin }),
        adminId,
      ),
    );
    expect(count).toBe(3);

    const tickets = await prisma.ticket.findMany({
      where: { id: { in: [t1, t2, t3] } },
      orderBy: { createdAt: "asc" },
      select: { assignedToId: true },
    });
    // Oldest-first, cursor 0,1,2 → a, b, a.
    expect(tickets.map((t) => t.assignedToId)).toEqual([a, b, a]);

    // Cursor advanced once per assignment.
    const ws = await prisma.workflowSettings.findUnique({
      where: { id: WORKFLOW_SETTINGS_ID },
    });
    expect(ws!.roundRobinCursor).toBe(3);
  });

  it("least-loaded spreads the backfill so the lighter agent catches up", async () => {
    const a = await createAgent("bf-ll-a@example.com", new Date("2020-01-01"));
    const b = await createAgent("bf-ll-b@example.com", new Date("2020-01-02"));
    // a starts with two open tickets; b has none.
    await createTicket({ assignedToId: a });
    await createTicket({ assignedToId: a });
    const u1 = await createTicket({});
    const u2 = await createTicket({});

    const count = await prisma.$transaction((tx) =>
      assignUnassignedTickets(
        tx,
        settings({ autoAssignMode: AutoAssignMode.least_loaded }),
        adminId,
      ),
    );
    expect(count).toBe(2);

    // Both unassigned tickets go to b (loads: a=2 b=0 → b; then a=2 b=1 → b).
    const tickets = await prisma.ticket.findMany({
      where: { id: { in: [u1, u2] } },
      select: { assignedToId: true },
    });
    expect(tickets.every((t) => t.assignedToId === b)).toBe(true);
  });

  it("records an assignee_changed audit event and a notification per ticket", async () => {
    const agent = await createAgent("bf-audit@example.com", new Date("2020-01-01"));
    const t1 = await createTicket({});

    await prisma.$transaction((tx) =>
      assignUnassignedTickets(
        tx,
        settings({ autoAssignMode: AutoAssignMode.round_robin }),
        adminId,
      ),
    );

    const audit = await prisma.auditEvent.findFirst({
      where: { ticketId: t1, type: AuditEventType.assignee_changed },
    });
    expect(audit).not.toBeNull();
    expect(audit!.actorId).toBe(adminId);
    expect(audit!.data).toMatchObject({ from: null, to: agent, autoAssigned: true });

    const notif = await prisma.notification.findFirst({
      where: { ticketId: t1, type: NotificationType.ticket_assigned },
    });
    expect(notif).not.toBeNull();
    expect(notif!.userId).toBe(agent);
    expect(notif!.actorId).toBe(adminId);
  });

  it("only touches open + unassigned tickets, leaving others alone", async () => {
    const agent = await createAgent("bf-scope@example.com", new Date("2020-01-01"));
    const other = await createAgent("bf-scope-other@example.com", new Date("2020-01-02"));
    const openUnassigned = await createTicket({});
    const alreadyAssigned = await createTicket({ assignedToId: other });
    const resolved = await createTicket({
      status: TicketStatus.resolved,
      assignedToId: null,
    });

    const count = await prisma.$transaction((tx) =>
      assignUnassignedTickets(
        tx,
        settings({ autoAssignMode: AutoAssignMode.round_robin }),
        adminId,
      ),
    );
    expect(count).toBe(1);

    const rows = await prisma.ticket.findMany({
      where: { id: { in: [openUnassigned, alreadyAssigned, resolved] } },
      select: { id: true, assignedToId: true },
    });
    const byId = new Map(rows.map((r) => [r.id, r.assignedToId]));
    expect(byId.get(openUnassigned)).toBe(agent);
    expect(byId.get(alreadyAssigned)).toBe(other); // untouched
    expect(byId.get(resolved)).toBeNull(); // untouched
  });

  it("returns 0 and assigns nothing when there are no eligible agents", async () => {
    const t1 = await createTicket({});
    const count = await prisma.$transaction((tx) =>
      assignUnassignedTickets(
        tx,
        settings({ autoAssignMode: AutoAssignMode.round_robin }),
        adminId,
      ),
    );
    expect(count).toBe(0);
    const ticket = await prisma.ticket.findUnique({ where: { id: t1 } });
    expect(ticket!.assignedToId).toBeNull();
  });
});
