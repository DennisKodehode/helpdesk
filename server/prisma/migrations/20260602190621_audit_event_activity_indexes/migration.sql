-- CreateIndex
CREATE INDEX "audit_event_createdAt_idx" ON "audit_event"("createdAt");

-- CreateIndex
CREATE INDEX "audit_event_actorId_createdAt_idx" ON "audit_event"("actorId", "createdAt");
