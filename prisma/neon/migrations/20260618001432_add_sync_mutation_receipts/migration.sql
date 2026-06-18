-- CreateTable
CREATE TABLE "SyncMutationReceipt" (
    "id" SERIAL NOT NULL,
    "localMutationId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "result" JSONB,

    CONSTRAINT "SyncMutationReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SyncMutationReceipt_localMutationId_key" ON "SyncMutationReceipt"("localMutationId");

-- CreateIndex
CREATE INDEX "SyncMutationReceipt_type_idx" ON "SyncMutationReceipt"("type");

-- CreateIndex
CREATE INDEX "SyncMutationReceipt_appliedAt_idx" ON "SyncMutationReceipt"("appliedAt");
