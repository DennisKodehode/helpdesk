/*
  Warnings:

  - You are about to drop the `Reply` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Ticket` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Reply" DROP CONSTRAINT "Reply_agentId_fkey";

-- DropForeignKey
ALTER TABLE "Reply" DROP CONSTRAINT "Reply_ticketId_fkey";

-- AlterTable
ALTER TABLE "user" ALTER COLUMN "createdAt" DROP DEFAULT;

-- DropTable
DROP TABLE "Reply";

-- DropTable
DROP TABLE "Ticket";

-- DropEnum
DROP TYPE "SenderType";

-- DropEnum
DROP TYPE "TicketCategory";

-- DropEnum
DROP TYPE "TicketStatus";
