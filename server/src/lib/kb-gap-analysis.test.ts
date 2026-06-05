import {
  KbSuggestionStatus,
  SenderType,
  TicketCategory,
  TicketStatus,
} from "@helpdesk/core";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { prisma } from "./prisma";
import {
  seedWorkflowSettings,
  WORKFLOW_SETTINGS_DEFAULTS,
  WORKFLOW_SETTINGS_ID,
} from "./workflow-settings";

const generateTextMock = vi.fn();
vi.mock("ai", async () => {
  const actual = await vi.importActual<typeof import("ai")>("ai");
  return {
    generateText: (...args: unknown[]) => generateTextMock(...args),
    Output: actual.Output,
  };
});
vi.mock("@ai-sdk/google", () => ({ google: () => "mock-model" }));

const { runKbGapAnalysis } = await import("./kb-gap-analysis");

describe("kb-gap-analysis", () => {
  const createdTicketIds: number[] = [];

  async function setSettings(patch: Record<string, unknown>) {
    await prisma.workflowSettings.upsert({
      where: { id: WORKFLOW_SETTINGS_ID },
      create: { id: WORKFLOW_SETTINGS_ID, ...WORKFLOW_SETTINGS_DEFAULTS, ...patch },
      update: { ...WORKFLOW_SETTINGS_DEFAULTS, ...patch },
    });
  }

  async function seedResolvedTicket(category: TicketCategory, n: number) {
    const ticket = await prisma.ticket.create({
      data: {
        fromName: "Cust",
        fromEmail: `cust${n}@example.com`,
        subject: `Issue ${n}`,
        body: `How do I do thing ${n}?`,
        category,
        status: TicketStatus.resolved,
        resolvedAt: new Date(),
        replies: {
          create: { senderType: SenderType.agent, body: `Do it like this ${n}.` },
        },
      },
    });
    createdTicketIds.push(ticket.id);
    return ticket;
  }

  beforeEach(() => {
    generateTextMock.mockReset();
  });

  afterEach(async () => {
    await prisma.kbSuggestion.deleteMany({ where: { source: "ai_gap_analysis" } });
    if (createdTicketIds.length > 0) {
      await prisma.ticket.deleteMany({ where: { id: { in: createdTicketIds } } });
      createdTicketIds.length = 0;
    }
  });

  afterAll(async () => {
    await seedWorkflowSettings();
    await prisma.workflowSettings.update({
      where: { id: WORKFLOW_SETTINGS_ID },
      data: { ...WORKFLOW_SETTINGS_DEFAULTS },
    });
  });

  it("skips when kbGrowthOn is false", async () => {
    await setSettings({ kbGrowthOn: false });
    const result = await runKbGapAnalysis();
    expect(result.skipped).toBe("disabled");
    expect(generateTextMock).not.toHaveBeenCalled();
  });

  it("skips when not due yet", async () => {
    const now = new Date("2026-06-05T00:00:00.000Z");
    // Last run was 5 days ago; interval is 30 → not due.
    await setSettings({
      kbGrowthOn: true,
      kbGrowthIntervalDays: 30,
      kbGrowthLastRunAt: new Date("2026-05-31T00:00:00.000Z"),
    });
    const result = await runKbGapAnalysis(now);
    expect(result.skipped).toBe("not_due");
  });

  it("creates pending suggestions from clustered resolved tickets and stamps lastRunAt", async () => {
    await setSettings({
      kbGrowthOn: true,
      kbGrowthIntervalDays: 30,
      kbMinClusterSize: 3,
      kbGrowthLastRunAt: null,
    });
    await seedResolvedTicket(TicketCategory.technical_question, 1);
    await seedResolvedTicket(TicketCategory.technical_question, 2);
    await seedResolvedTicket(TicketCategory.technical_question, 3);

    // The model returns one qualifying topic (only for the first category that
    // clears the cluster threshold); other categories have too few tickets.
    generateTextMock.mockResolvedValue({
      output: {
        suggestions: [
          {
            title: "Doing the thing",
            question: "How do I do the thing?",
            answer: "Follow these steps.",
            ticketCount: 3,
          },
        ],
      },
    });

    const now = new Date("2026-06-05T00:00:00.000Z");
    const result = await runKbGapAnalysis(now);
    expect(result.created).toBeGreaterThanOrEqual(1);

    const suggestion = await prisma.kbSuggestion.findFirst({
      where: { title: "Doing the thing" },
    });
    expect(suggestion?.status).toBe(KbSuggestionStatus.pending);
    expect(suggestion?.category).toBe(TicketCategory.technical_question);
    expect([...(suggestion?.sourceTicketIds as number[])].sort()).toEqual(
      [...createdTicketIds].sort(),
    );

    const settings = await prisma.workflowSettings.findUnique({
      where: { id: WORKFLOW_SETTINGS_ID },
    });
    expect(settings?.kbGrowthLastRunAt?.toISOString()).toBe(now.toISOString());
  });

  it("does not call the model for a category below the cluster threshold", async () => {
    await setSettings({
      kbGrowthOn: true,
      kbGrowthIntervalDays: 30,
      kbMinClusterSize: 3,
      kbGrowthLastRunAt: null,
    });
    // Only 1 ticket — below threshold of 3.
    await seedResolvedTicket(TicketCategory.billing_inquiry, 1);
    generateTextMock.mockResolvedValue({ output: { suggestions: [] } });

    const result = await runKbGapAnalysis();
    expect(result.created).toBe(0);
    expect(generateTextMock).not.toHaveBeenCalled();
  });

  it("dedupes a suggested topic that matches an existing pending suggestion", async () => {
    await setSettings({
      kbGrowthOn: true,
      kbGrowthIntervalDays: 30,
      kbMinClusterSize: 3,
      kbGrowthLastRunAt: null,
    });
    await prisma.kbSuggestion.create({
      data: {
        source: "ai_gap_analysis",
        status: KbSuggestionStatus.pending,
        category: TicketCategory.refund_request,
        title: "Refund timing",
        question: "When do refunds arrive?",
        answer: "5–10 days.",
      },
    });
    await seedResolvedTicket(TicketCategory.refund_request, 1);
    await seedResolvedTicket(TicketCategory.refund_request, 2);
    await seedResolvedTicket(TicketCategory.refund_request, 3);
    generateTextMock.mockResolvedValue({
      output: {
        suggestions: [
          {
            title: "refund timing",
            question: "When do refunds arrive?",
            answer: "5–10 days.",
            ticketCount: 3,
          },
        ],
      },
    });

    const result = await runKbGapAnalysis();
    expect(result.created).toBe(0);
  });
});
