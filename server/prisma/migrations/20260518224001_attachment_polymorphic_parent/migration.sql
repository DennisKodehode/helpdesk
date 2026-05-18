-- AlterTable
ALTER TABLE "attachment" ADD COLUMN     "ticketId" INTEGER,
ALTER COLUMN "replyId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "attachment_ticketId_idx" ON "attachment"("ticketId");

-- AddForeignKey
ALTER TABLE "attachment" ADD CONSTRAINT "attachment_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Polymorphic parent: exactly one of replyId or ticketId must be set. This
-- CHECK constraint is added by raw SQL because Prisma can't model it
-- natively; the application layer also enforces this in code, but the DB
-- constraint is the data-integrity backstop.
ALTER TABLE "attachment" ADD CONSTRAINT "attachment_xor_parent"
  CHECK (("replyId" IS NULL) <> ("ticketId" IS NULL));
