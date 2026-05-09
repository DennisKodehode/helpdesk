/*
  Warnings:

  - You are about to drop the column `autoResolved` on the `ticket` table. All the data in the column will be lost.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "TicketStatus" ADD VALUE 'new';
ALTER TYPE "TicketStatus" ADD VALUE 'processing';

-- AlterTable
ALTER TABLE "ticket" DROP COLUMN "autoResolved",
ALTER COLUMN "status" SET DEFAULT 'new';
