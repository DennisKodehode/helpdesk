-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'sla_breach_warning';

-- AlterTable
ALTER TABLE "notification" ADD COLUMN     "data" JSONB;

-- CreateTable
CREATE TABLE "sla_policy" (
    "priority" "TicketPriority" NOT NULL,
    "firstResponseMinutes" INTEGER,
    "resolutionMinutes" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sla_policy_pkey" PRIMARY KEY ("priority")
);
