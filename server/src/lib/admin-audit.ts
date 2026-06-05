import type { AdminAuditEventType } from "@helpdesk/core";
import { Prisma } from "../generated/prisma/client";
import type { prisma } from "./prisma";

// Mirror of lib/audit.ts (recordAuditEvent) but for the admin-action log. Accepts
// either the base client or a transaction client so callers can emit the event
// inside the same $transaction as the mutation (audit + change commit together).
export type AdminAuditTx = Prisma.TransactionClient | typeof prisma;

export type AdminAuditEventInput = {
  actorId: string | null;
  // Denormalized snapshots — stored so the record survives the referenced users
  // being deleted (actorId is SetNull, but these persist).
  actorName: string;
  type: AdminAuditEventType;
  targetUserId?: string | null;
  targetName?: string | null;
  data?: Record<string, unknown>;
};

export async function recordAdminAuditEvent(
  db: AdminAuditTx,
  input: AdminAuditEventInput,
) {
  await db.adminAuditEvent.create({
    data: {
      actorId: input.actorId,
      actorName: input.actorName,
      type: input.type,
      targetUserId: input.targetUserId ?? null,
      targetName: input.targetName ?? null,
      data:
        input.data === undefined ? Prisma.DbNull : (input.data as Prisma.InputJsonValue),
    },
  });
}
