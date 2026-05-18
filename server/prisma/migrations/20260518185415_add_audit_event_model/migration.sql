-- CreateEnum
CREATE TYPE "AuditEventType" AS ENUM ('status_changed', 'assignee_changed', 'priority_changed', 'category_changed', 'reply_added');

-- CreateTable
CREATE TABLE "audit_event" (
    "id" TEXT NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "actorId" TEXT,
    "type" "AuditEventType" NOT NULL,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_event_ticketId_createdAt_idx" ON "audit_event"("ticketId", "createdAt");

-- AddForeignKey
ALTER TABLE "audit_event" ADD CONSTRAINT "audit_event_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_event" ADD CONSTRAINT "audit_event_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
