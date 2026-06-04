-- AlterTable
ALTER TABLE "workflow_settings" ADD COLUMN     "slaGreenMin" INTEGER NOT NULL DEFAULT 90,
ADD COLUMN     "slaYellowMin" INTEGER NOT NULL DEFAULT 60;
