-- CreateTable
CREATE TABLE "attachment" (
    "id" TEXT NOT NULL,
    "replyId" INTEGER NOT NULL,
    "filename" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "attachment_storageKey_key" ON "attachment"("storageKey");

-- CreateIndex
CREATE INDEX "attachment_replyId_idx" ON "attachment"("replyId");

-- AddForeignKey
ALTER TABLE "attachment" ADD CONSTRAINT "attachment_replyId_fkey" FOREIGN KEY ("replyId") REFERENCES "reply"("id") ON DELETE CASCADE ON UPDATE CASCADE;
