import { logger } from "./logger";
import { prisma } from "./prisma";

let aiUserId: string | null = null;

export async function initAiUserId(): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email: "ai@helpdesk.internal" } });
  aiUserId = user?.id ?? null;
  if (!aiUserId) {
    logger.warn(
      "AI agent user (ai@helpdesk.internal) not found — AI assignment disabled",
    );
  }
}

export function getAiUserId(): string | null {
  return aiUserId;
}

export type AssigneeType = "human" | "ai" | "none";

export function isAiAssigned(assignedToId: string | null | undefined): boolean {
  return assignedToId != null && assignedToId === aiUserId;
}

export function assigneeType(assignedToId: string | null | undefined): AssigneeType {
  if (assignedToId == null) return "none";
  return assignedToId === aiUserId ? "ai" : "human";
}
