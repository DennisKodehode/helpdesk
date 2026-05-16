-- CreateEnum
CREATE TYPE "TicketPriority" AS ENUM ('low', 'normal', 'high', 'urgent');

-- AlterTable
ALTER TABLE "ticket" ADD COLUMN     "priority" "TicketPriority" NOT NULL DEFAULT 'normal';
