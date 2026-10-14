-- CreateEnum
CREATE TYPE "LeaseEventKind" AS ENUM ('CREATED', 'SENT', 'SIGNED', 'DECLINED', 'COMPLETED', 'RENEWED', 'NOTICE_GIVEN', 'NOTE');

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "caption" TEXT,
ADD COLUMN     "isCover" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Lease" ADD COLUMN     "moveOutDate" DATE,
ADD COLUMN     "noticeGivenAt" DATE,
ADD COLUMN     "occupants" TEXT;

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "emergencyContactName" TEXT,
ADD COLUMN     "emergencyContactPhone" TEXT,
ADD COLUMN     "emergencyContactRelationship" TEXT;

-- AlterTable
ALTER TABLE "Unit" ADD COLUMN     "amenities" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "floor" INTEGER,
ADD COLUMN     "marketRent" DECIMAL(12,2);

-- CreateTable
CREATE TABLE "TenantNote" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenantNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaseEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "leaseId" TEXT NOT NULL,
    "kind" "LeaseEventKind" NOT NULL,
    "tenantId" TEXT,
    "actorName" TEXT,
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeaseEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TenantNote_organizationId_tenantId_createdAt_idx" ON "TenantNote"("organizationId", "tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "LeaseEvent_organizationId_leaseId_createdAt_idx" ON "LeaseEvent"("organizationId", "leaseId", "createdAt");

-- AddForeignKey
ALTER TABLE "TenantNote" ADD CONSTRAINT "TenantNote_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantNote" ADD CONSTRAINT "TenantNote_tenantId_organizationId_fkey" FOREIGN KEY ("tenantId", "organizationId") REFERENCES "Tenant"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaseEvent" ADD CONSTRAINT "LeaseEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaseEvent" ADD CONSTRAINT "LeaseEvent_leaseId_organizationId_fkey" FOREIGN KEY ("leaseId", "organizationId") REFERENCES "Lease"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaseEvent" ADD CONSTRAINT "LeaseEvent_tenantId_organizationId_fkey" FOREIGN KEY ("tenantId", "organizationId") REFERENCES "Tenant"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

