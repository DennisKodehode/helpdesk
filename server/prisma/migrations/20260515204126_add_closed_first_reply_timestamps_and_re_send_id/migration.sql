/*
  Warnings:

  - A unique constraint covering the columns `[resendEmailId]` on the table `reply` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[resendEmailId]` on the table `ticket` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "reply" ADD COLUMN     "resendEmailId" TEXT;

-- AlterTable
ALTER TABLE "ticket" ADD COLUMN     "closedAt" TIMESTAMP(3),
ADD COLUMN     "firstAgentReplyAt" TIMESTAMP(3),
ADD COLUMN     "resendEmailId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "reply_resendEmailId_key" ON "reply"("resendEmailId");

-- CreateIndex
CREATE UNIQUE INDEX "ticket_resendEmailId_key" ON "ticket"("resendEmailId");
