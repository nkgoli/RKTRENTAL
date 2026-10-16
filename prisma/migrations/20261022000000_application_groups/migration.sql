-- CreateTable
CREATE TABLE "ApplicationGroup" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'SUBMITTED',
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplicationGroup_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Application" ADD COLUMN "applicationGroupId" TEXT;

-- CreateIndex
CREATE INDEX "ApplicationGroup_organizationId_unitId_createdAt_idx" ON "ApplicationGroup"("organizationId", "unitId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationGroup_id_organizationId_key" ON "ApplicationGroup"("id", "organizationId");

-- CreateIndex
CREATE INDEX "Application_applicationGroupId_idx" ON "Application"("applicationGroupId");

-- AddForeignKey
ALTER TABLE "ApplicationGroup" ADD CONSTRAINT "ApplicationGroup_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationGroup" ADD CONSTRAINT "ApplicationGroup_unitId_organizationId_fkey" FOREIGN KEY ("unitId", "organizationId") REFERENCES "Unit"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_applicationGroupId_organizationId_fkey" FOREIGN KEY ("applicationGroupId", "organizationId") REFERENCES "ApplicationGroup"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
