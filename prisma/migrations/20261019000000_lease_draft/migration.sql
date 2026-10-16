-- CreateTable
CREATE TABLE "LeaseDraft" (
    "leaseId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "step" INTEGER NOT NULL DEFAULT 0,
    "furthestStep" INTEGER NOT NULL DEFAULT 0,
    "data" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaseDraft_pkey" PRIMARY KEY ("leaseId")
);

-- CreateIndex
CREATE UNIQUE INDEX "LeaseDraft_leaseId_organizationId_key" ON "LeaseDraft"("leaseId", "organizationId");

-- CreateIndex
CREATE INDEX "LeaseDraft_organizationId_idx" ON "LeaseDraft"("organizationId");

-- AddForeignKey
ALTER TABLE "LeaseDraft" ADD CONSTRAINT "LeaseDraft_leaseId_organizationId_fkey" FOREIGN KEY ("leaseId", "organizationId") REFERENCES "Lease"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;
