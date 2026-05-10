import { prisma } from "./prisma";

let aiUserId: string | null = null;

export async function initAiUserId(): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email: "ai@helpdesk.internal" } });
  aiUserId = user?.id ?? null;
  if (!aiUserId) {
    console.warn("AI agent user (ai@helpdesk.internal) not found — AI assignment disabled");
  }
}

export function getAiUserId(): string | null {
  return aiUserId;
}
