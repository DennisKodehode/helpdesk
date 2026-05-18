import type { AuditEventType } from "@helpdesk/core";
import { Prisma } from "../generated/prisma/client";
import type { prisma } from "./prisma";

export type AuditTx = Prisma.TransactionClient | typeof prisma;

export type AuditEventInput = {
  ticketId: number;
  actorId: string | null;
  type: AuditEventType;
  data?: Record<string, unknown>;
};

export async function recordAuditEvent(db: AuditTx, input: AuditEventInput) {
  await db.auditEvent.create({
    data: {
      ticketId: input.ticketId,
      actorId: input.actorId,
      type: input.type,
      data:
        input.data === undefined ? Prisma.DbNull : (input.data as Prisma.InputJsonValue),
    },
  });
}
