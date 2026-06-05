-- CreateEnum
CREATE TYPE "KbSuggestionStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "KbSuggestionSource" AS ENUM ('ai_gap_analysis', 'agent');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AdminAuditEventType" ADD VALUE 'kb_suggestion_approved';
ALTER TYPE "AdminAuditEventType" ADD VALUE 'kb_suggestion_rejected';

-- AlterTable
ALTER TABLE "workflow_settings" ADD COLUMN     "kbGrowthIntervalDays" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "kbGrowthLastRunAt" TIMESTAMP(3),
ADD COLUMN     "kbGrowthOn" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "kbMinClusterSize" INTEGER NOT NULL DEFAULT 3;

-- CreateTable
CREATE TABLE "kb_suggestion" (
    "id" TEXT NOT NULL,
    "source" "KbSuggestionSource" NOT NULL,
    "status" "KbSuggestionStatus" NOT NULL DEFAULT 'pending',
    "category" "TicketCategory",
    "title" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "sourceTicketIds" JSONB,
    "requestedById" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewReason" TEXT,
    "resultArticleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kb_suggestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "kb_suggestion_status_createdAt_idx" ON "kb_suggestion"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "kb_suggestion" ADD CONSTRAINT "kb_suggestion_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kb_suggestion" ADD CONSTRAINT "kb_suggestion_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
