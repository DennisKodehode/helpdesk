-- AlterTable
ALTER TABLE "ticket" ADD COLUMN     "lastReplySenderType" "SenderType";

-- CreateIndex
CREATE INDEX "ticket_status_lastReplySenderType_idx" ON "ticket"("status", "lastReplySenderType");

-- Backfill: set lastReplySenderType from each ticket's most recent
-- non-internal reply. Internal notes never change conversation state, so
-- tickets with only internal notes (or no replies at all) keep NULL.
UPDATE "ticket" t
SET "lastReplySenderType" = sub."senderType"
FROM (
  SELECT DISTINCT ON ("ticketId") "ticketId", "senderType"
  FROM "reply"
  WHERE "senderType" != 'internal_note'
  ORDER BY "ticketId", "createdAt" DESC
) sub
WHERE t.id = sub."ticketId";
