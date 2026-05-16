import { generateId } from "better-auth";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { assigneeType, getAiUserId, initAiUserId, isAiAssigned } from "./ai-user";
import { prisma } from "./prisma";

describe("ai-user helpers", () => {
  let aiId: string;

  beforeAll(async () => {
    const now = new Date();
    aiId = generateId();
    await prisma.user.upsert({
      where: { email: "ai@helpdesk.internal" },
      update: {},
      create: {
        id: aiId,
        name: "AI",
        email: "ai@helpdesk.internal",
        emailVerified: true,
        role: "agent",
        createdAt: now,
        updatedAt: now,
      },
    });
    const found = await prisma.user.findUnique({
      where: { email: "ai@helpdesk.internal" },
    });
    aiId = found!.id;
    await initAiUserId();
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: "ai@helpdesk.internal" } });
  });

  it("getAiUserId returns the cached AI user id", () => {
    expect(getAiUserId()).toBe(aiId);
  });

  it("isAiAssigned is true only when the id matches the AI user", () => {
    expect(isAiAssigned(aiId)).toBe(true);
    expect(isAiAssigned("some-other-id")).toBe(false);
    expect(isAiAssigned(null)).toBe(false);
    expect(isAiAssigned(undefined)).toBe(false);
  });

  it("assigneeType maps assignee ids to human/ai/none", () => {
    expect(assigneeType(aiId)).toBe("ai");
    expect(assigneeType("some-human-id")).toBe("human");
    expect(assigneeType(null)).toBe("none");
    expect(assigneeType(undefined)).toBe("none");
  });
});
