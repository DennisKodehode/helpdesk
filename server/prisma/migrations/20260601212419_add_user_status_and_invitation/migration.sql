-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('invited', 'active', 'inactive');

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "status" "UserStatus" NOT NULL DEFAULT 'active';

-- CreateTable
CREATE TABLE "invitation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invitation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "invitation_userId_key" ON "invitation"("userId");

-- CreateIndex
CREATE INDEX "invitation_tokenHash_idx" ON "invitation"("tokenHash");

-- AddForeignKey
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
