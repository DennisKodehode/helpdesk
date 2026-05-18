-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditEventType" ADD VALUE 'ticket_created';
ALTER TYPE "AuditEventType" ADD VALUE 'auto_resolved';
ALTER TYPE "AuditEventType" ADD VALUE 'ai_escalated';
ALTER TYPE "AuditEventType" ADD VALUE 'auto_reopened';
ALTER TYPE "AuditEventType" ADD VALUE 'auto_closed';
