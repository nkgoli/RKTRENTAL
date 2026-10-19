CREATE TABLE "RoiAnalysisState" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "revision" INTEGER NOT NULL DEFAULT 1 CHECK ("revision" > 0),
  "version" INTEGER NOT NULL DEFAULT 1 CHECK ("version" = 1),
  "status" TEXT NOT NULL CHECK ("status" IN ('DRAFT', 'READY')),
  "payload" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RoiAnalysisState_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RoiAnalysisState_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "RoiAnalysisState_propertyId_organizationId_fkey" FOREIGN KEY ("propertyId", "organizationId") REFERENCES "Property"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "RoiAnalysisState_organizationId_propertyId_key" ON "RoiAnalysisState"("organizationId", "propertyId");
