-- CreateEnum
CREATE TYPE "Role" AS ENUM ('admin', 'agent');

-- AlterTable: convert existing TEXT column to Role enum (preserves data)
ALTER TABLE "user" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "user" ALTER COLUMN "role" TYPE "Role" USING "role"::"Role";
ALTER TABLE "user" ALTER COLUMN "role" SET DEFAULT 'agent'::"Role";
