-- CreateIndex
CREATE INDEX "reply_ticketId_createdAt_idx" ON "reply"("ticketId", "createdAt");

-- CreateIndex
CREATE INDEX "reply_authorId_senderType_idx" ON "reply"("authorId", "senderType");

-- CreateIndex
CREATE INDEX "ticket_status_createdAt_idx" ON "ticket"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ticket_assignedToId_status_idx" ON "ticket"("assignedToId", "status");

-- CreateIndex
CREATE INDEX "ticket_fromEmail_subject_status_idx" ON "ticket"("fromEmail", "subject", "status");

-- CreateIndex
CREATE INDEX "ticket_status_resolvedAt_idx" ON "ticket"("status", "resolvedAt");
