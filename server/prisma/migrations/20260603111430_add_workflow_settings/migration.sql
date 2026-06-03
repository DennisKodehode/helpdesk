-- CreateEnum
CREATE TYPE "AutoAssignMode" AS ENUM ('round_robin', 'least_loaded');

-- CreateTable
CREATE TABLE "workflow_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "autoAssignOn" BOOLEAN NOT NULL DEFAULT false,
    "autoAssignMode" "AutoAssignMode" NOT NULL DEFAULT 'round_robin',
    "autoResolveOn" BOOLEAN NOT NULL DEFAULT true,
    "autoResolveThreshold" INTEGER NOT NULL DEFAULT 85,
    "requireCategory" BOOLEAN NOT NULL DEFAULT true,
    "requireAssignee" BOOLEAN NOT NULL DEFAULT false,
    "autoCloseOn" BOOLEAN NOT NULL DEFAULT true,
    "autoCloseDays" INTEGER NOT NULL DEFAULT 7,
    "reopenOnReply" BOOLEAN NOT NULL DEFAULT true,
    "lockClosed" BOOLEAN NOT NULL DEFAULT true,
    "roundRobinCursor" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workflow_settings_pkey" PRIMARY KEY ("id")
);
