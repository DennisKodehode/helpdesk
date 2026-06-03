import {
  NotificationType,
  Role,
  SlaMetric,
  TicketPriority,
  TicketStatus,
} from "@helpdesk/core";
import { generateId } from "better-auth";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { initAiUserId } from "./ai-user";
import { prisma } from "./prisma";
import { runSlaBreachCheck } from "./sla-breach-check";
import { SLA_POLICY_DEFAULTS, seedSlaPolicies } from "./sla-defaults";

const HOUR = 60 * 60 * 1000;
const MINUTE = 60 * 1000;

describe("runSlaBreachCheck", () => {
  const userIds: string[] = [];
  const ticketIds: number[] = [];
  let testAgentId: string;
  let aiUserId: string;
  let adminOneId: string;
  let adminTwoId: string;

  async function makeUser(opts: {
    name: string;
    email: string;
    role: Role;
    deletedAt?: Date | null;
  }) {
    const id = generateId();
    const now = new Date();
    await prisma.user.create({
      data: {
        id,
        name: opts.name,
        email: opts.email,
        emailVerified: true,
        role: opts.role,
        deletedAt: opts.deletedAt ?? null,
        createdAt: now,
        updatedAt: now,
      },
    });
    userIds.push(id);
    return id;
  }

  beforeAll(async () => {
    await seedSlaPolicies();
    // ai-user.ts looks up ai@helpdesk.internal at startup; create it first so
    // isAiAssigned() returns true for the AI-assigned scenario.
    const existingAi = await prisma.user.findUnique({
      where: { email: "ai@helpdesk.internal" },
    });
    if (existingAi) {
      aiUserId = existingAi.id;
    } else {
      aiUserId = await makeUser({
        name: "AI",
        email: "ai@helpdesk.internal",
        role: Role.agent,
      });
    }
    await initAiUserId();

    testAgentId = await makeUser({
      name: "SLA Test Agent",
      email: "sla-test-agent@example.com",
      role: Role.agent,
    });
    adminOneId = await makeUser({
      name: "SLA Admin One",
      email: "sla-admin-one@example.com",
      role: Role.admin,
    });
    adminTwoId = await makeUser({
      name: "SLA Admin Two",
      email: "sla-admin-two@example.com",
      role: Role.admin,
    });
  });

  afterAll(async () => {
    // The AI user is shared across the test suite — only delete it if we
    // were the ones that created it (not pre-seeded).
    const aiCreatedHere = userIds.includes(aiUserId);
    const toDelete = aiCreatedHere ? userIds : userIds.filter((id) => id !== aiUserId);
    await prisma.notification.deleteMany({ where: { userId: { in: toDelete } } });
    await prisma.user.deleteMany({ where: { id: { in: toDelete } } });
  });

  afterEach(async () => {
    if (ticketIds.length > 0) {
      await prisma.notification.deleteMany({
        where: { ticketId: { in: ticketIds } },
      });
      await prisma.ticket.deleteMany({ where: { id: { in: ticketIds } } });
      ticketIds.length = 0;
    }
  });

  async function createTicket(data: {
    priority: TicketPriority;
    status?: TicketStatus;
    createdAt: Date;
    firstAgentReplyAt?: Date | null;
    assignedToId?: string | null;
    resolvedAt?: Date | null;
  }) {
    const ticket = await prisma.ticket.create({
      data: {
        fromName: "SLA Customer",
        fromEmail: `sla-${generateId()}@example.com`,
        subject: "SLA test",
        body: "",
        priority: data.priority,
        status: data.status ?? TicketStatus.open,
        createdAt: data.createdAt,
        firstAgentReplyAt: data.firstAgentReplyAt ?? null,
        assignedToId: data.assignedToId ?? null,
        resolvedAt: data.resolvedAt ?? null,
      },
    });
    ticketIds.push(ticket.id);
    return ticket;
  }

  it("seeds the four documented SLA policy rows", async () => {
    const rows = await prisma.slaPolicy.findMany({ orderBy: { priority: "asc" } });
    expect(rows).toHaveLength(SLA_POLICY_DEFAULTS.length);
    for (const expected of SLA_POLICY_DEFAULTS) {
      const row = rows.find((r) => r.priority === expected.priority);
      expect(row).toBeDefined();
      expect(row!.firstResponseMinutes).toBe(expected.firstResponseMinutes);
      expect(row!.resolutionMinutes).toBe(expected.resolutionMinutes);
    }
  });

  it("notifies the assignee on a first-response breach", async () => {
    const ticket = await createTicket({
      priority: TicketPriority.high,
      createdAt: new Date(Date.now() - 5 * HOUR),
      firstAgentReplyAt: null,
      assignedToId: testAgentId,
    });

    const result = await runSlaBreachCheck();
    expect(result.notified).toBe(1);

    const notifications = await prisma.notification.findMany({
      where: { ticketId: ticket.id },
    });
    expect(notifications).toHaveLength(1);
    expect(notifications[0].userId).toBe(testAgentId);
    expect(notifications[0].type).toBe(NotificationType.sla_breach_warning);
    const data = notifications[0].data as {
      metric: string;
      policyMinutes: number;
      breachedAt: string;
    };
    expect(data.metric).toBe(SlaMetric.first_response);
    expect(data.policyMinutes).toBe(240);
    expect(typeof data.breachedAt).toBe("string");
  });

  it("notifies the assignee on a resolution breach even after a reply", async () => {
    const ticket = await createTicket({
      priority: TicketPriority.normal,
      createdAt: new Date(Date.now() - 73 * HOUR),
      // First-response clock stopped — only the resolution metric should fire.
      firstAgentReplyAt: new Date(Date.now() - 60 * HOUR),
      assignedToId: testAgentId,
    });

    await runSlaBreachCheck();

    const notifications = await prisma.notification.findMany({
      where: { ticketId: ticket.id },
    });
    expect(notifications).toHaveLength(1);
    const data = notifications[0].data as { metric: string; policyMinutes: number };
    expect(data.metric).toBe(SlaMetric.resolution);
    expect(data.policyMinutes).toBe(4320);
  });

  it("creates one notification per metric when both metrics breach", async () => {
    // urgent: first=60min, resolution=240min. Aging 5h trips both.
    const ticket = await createTicket({
      priority: TicketPriority.urgent,
      createdAt: new Date(Date.now() - 5 * HOUR),
      firstAgentReplyAt: null,
      assignedToId: testAgentId,
    });

    await runSlaBreachCheck();

    const notifications = await prisma.notification.findMany({
      where: { ticketId: ticket.id },
      orderBy: { createdAt: "asc" },
    });
    expect(notifications).toHaveLength(2);
    const metrics = notifications
      .map((n) => (n.data as { metric: string }).metric)
      .sort();
    expect(metrics).toEqual([SlaMetric.first_response, SlaMetric.resolution].sort());
  });

  it("does not duplicate a notification that already exists for the same metric", async () => {
    const ticket = await createTicket({
      priority: TicketPriority.high,
      createdAt: new Date(Date.now() - 5 * HOUR),
      firstAgentReplyAt: null,
      assignedToId: testAgentId,
    });
    await prisma.notification.create({
      data: {
        userId: testAgentId,
        type: NotificationType.sla_breach_warning,
        ticketId: ticket.id,
        data: {
          metric: SlaMetric.first_response,
          policyMinutes: 240,
          breachedAt: new Date().toISOString(),
        },
      },
    });

    await runSlaBreachCheck();

    const count = await prisma.notification.count({ where: { ticketId: ticket.id } });
    expect(count).toBe(1);
  });

  it("fans out to all admins when the ticket is unassigned", async () => {
    const ticket = await createTicket({
      priority: TicketPriority.urgent,
      createdAt: new Date(Date.now() - 2 * HOUR),
      firstAgentReplyAt: null,
      assignedToId: null,
    });

    await runSlaBreachCheck();

    const notifications = await prisma.notification.findMany({
      where: { ticketId: ticket.id, type: NotificationType.sla_breach_warning },
    });
    const recipients = notifications.map((n) => n.userId).sort();
    // Both seeded admins receive each breached metric (first_response only —
    // 2h is under the urgent 4h resolution target).
    expect(recipients).toEqual([adminOneId, adminTwoId].sort());
  });

  it("fans out to admins (not the AI) when the ticket is AI-assigned", async () => {
    const ticket = await createTicket({
      priority: TicketPriority.urgent,
      createdAt: new Date(Date.now() - 2 * HOUR),
      firstAgentReplyAt: null,
      assignedToId: aiUserId,
    });

    await runSlaBreachCheck();

    const notifications = await prisma.notification.findMany({
      where: { ticketId: ticket.id },
    });
    const recipients = notifications.map((n) => n.userId);
    expect(recipients).not.toContain(aiUserId);
    expect(recipients.sort()).toEqual([adminOneId, adminTwoId].sort());
  });

  it("fans out to admins when the assignee has been soft-deleted", async () => {
    const deletedAgentId = await makeUser({
      name: "Deleted Agent",
      email: "deleted-agent@example.com",
      role: Role.agent,
      deletedAt: new Date(),
    });
    const ticket = await createTicket({
      priority: TicketPriority.urgent,
      createdAt: new Date(Date.now() - 2 * HOUR),
      firstAgentReplyAt: null,
      assignedToId: deletedAgentId,
    });

    await runSlaBreachCheck();

    const notifications = await prisma.notification.findMany({
      where: { ticketId: ticket.id },
    });
    const recipients = notifications.map((n) => n.userId);
    expect(recipients).not.toContain(deletedAgentId);
    expect(recipients.sort()).toEqual([adminOneId, adminTwoId].sort());
  });

  it("ignores resolved tickets", async () => {
    const ticket = await createTicket({
      priority: TicketPriority.urgent,
      createdAt: new Date(Date.now() - 100 * HOUR),
      status: TicketStatus.resolved,
      resolvedAt: new Date(Date.now() - 90 * HOUR),
      firstAgentReplyAt: null,
      assignedToId: testAgentId,
    });

    await runSlaBreachCheck();

    const count = await prisma.notification.count({ where: { ticketId: ticket.id } });
    expect(count).toBe(0);
  });

  it("ignores tickets still in 'new' status (pre-triage flap guard)", async () => {
    const ticket = await createTicket({
      priority: TicketPriority.urgent,
      createdAt: new Date(Date.now() - 100 * HOUR),
      status: TicketStatus.new,
      firstAgentReplyAt: null,
      assignedToId: testAgentId,
    });

    await runSlaBreachCheck();

    const count = await prisma.notification.count({ where: { ticketId: ticket.id } });
    expect(count).toBe(0);
  });

  it("ignores tickets still in 'processing' status (still triaging)", async () => {
    // Triaging tickets have no finalized priority — the default `normal` policy
    // must not breach them before classification flips them to `open`.
    const ticket = await createTicket({
      priority: TicketPriority.urgent,
      createdAt: new Date(Date.now() - 100 * HOUR),
      status: TicketStatus.processing,
      firstAgentReplyAt: null,
      assignedToId: testAgentId,
    });

    await runSlaBreachCheck();

    const count = await prisma.notification.count({ where: { ticketId: ticket.id } });
    expect(count).toBe(0);
  });

  it("does not notify when the ticket age is within the target window", async () => {
    const ticket = await createTicket({
      priority: TicketPriority.normal,
      // normal first-response = 480min (8h). 30 minutes elapsed → safely under.
      createdAt: new Date(Date.now() - 30 * MINUTE),
      firstAgentReplyAt: null,
      assignedToId: testAgentId,
    });

    await runSlaBreachCheck();

    const count = await prisma.notification.count({ where: { ticketId: ticket.id } });
    expect(count).toBe(0);
  });

  it("does not create a resolution notification when the policy has no resolution target", async () => {
    // low priority: firstResponse=1440min (24h), resolution=null.
    // Aging 48h trips first-response but the resolution metric should be skipped.
    const ticket = await createTicket({
      priority: TicketPriority.low,
      createdAt: new Date(Date.now() - 48 * HOUR),
      firstAgentReplyAt: null,
      assignedToId: testAgentId,
    });

    await runSlaBreachCheck();

    const notifications = await prisma.notification.findMany({
      where: { ticketId: ticket.id },
    });
    expect(notifications).toHaveLength(1);
    const data = notifications[0].data as { metric: string };
    expect(data.metric).toBe(SlaMetric.first_response);
  });
});
