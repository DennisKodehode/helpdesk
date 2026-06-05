-- CreateEnum
CREATE TYPE "KbArticleStatus" AS ENUM ('draft', 'published', 'archived');

-- CreateEnum
CREATE TYPE "KbArticleSource" AS ENUM ('seed', 'manual', 'ai_suggested');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AdminAuditEventType" ADD VALUE 'kb_article_created';
ALTER TYPE "AdminAuditEventType" ADD VALUE 'kb_article_updated';
ALTER TYPE "AdminAuditEventType" ADD VALUE 'kb_article_deleted';

-- CreateTable
CREATE TABLE "kb_article" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "category" "TicketCategory",
    "status" "KbArticleStatus" NOT NULL DEFAULT 'draft',
    "source" "KbArticleSource" NOT NULL DEFAULT 'manual',
    "authorId" TEXT,
    "hitCount" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMP(3),
    "lastReviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kb_article_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "kb_article_status_category_idx" ON "kb_article"("status", "category");

-- AddForeignKey
ALTER TABLE "kb_article" ADD CONSTRAINT "kb_article_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
