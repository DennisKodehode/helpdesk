-- CreateEnum
CREATE TYPE "AdminAuditEventType" AS ENUM ('user_invited', 'invite_resent', 'user_role_changed', 'user_deactivated', 'user_reactivated', 'user_deleted', 'user_edited', 'sla_targets_changed', 'workflow_settings_changed');

-- CreateTable
CREATE TABLE "admin_audit_event" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "actorName" TEXT NOT NULL,
    "type" "AdminAuditEventType" NOT NULL,
    "targetUserId" TEXT,
    "targetName" TEXT,
    "data" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "admin_audit_event_createdAt_idx" ON "admin_audit_event"("createdAt");

-- CreateIndex
CREATE INDEX "admin_audit_event_actorId_createdAt_idx" ON "admin_audit_event"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "admin_audit_event_type_createdAt_idx" ON "admin_audit_event"("type", "createdAt");

-- AddForeignKey
ALTER TABLE "admin_audit_event" ADD CONSTRAINT "admin_audit_event_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
