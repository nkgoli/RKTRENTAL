CREATE TABLE "Vendor" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "trade" TEXT,
  "email" TEXT,
  "phone" TEXT,
  CONSTRAINT "Vendor_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Vendor_id_organizationId_key" ON "Vendor"("id", "organizationId");
CREATE UNIQUE INDEX "Vendor_organizationId_name_key" ON "Vendor"("organizationId", "name");
ALTER TABLE "Vendor" ADD CONSTRAINT "Vendor_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MaintenanceRequest" ADD COLUMN "vendorId" TEXT;
ALTER TABLE "MaintenanceRequest" ADD COLUMN "tenantId" TEXT;
ALTER TABLE "MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_vendorId_organizationId_fkey" FOREIGN KEY ("vendorId", "organizationId") REFERENCES "Vendor"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_tenantId_organizationId_fkey" FOREIGN KEY ("tenantId", "organizationId") REFERENCES "Tenant"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "MaintenancePhoto" ADD COLUMN "documentId" TEXT;
CREATE UNIQUE INDEX "MaintenancePhoto_documentId_key" ON "MaintenancePhoto"("documentId");
ALTER TABLE "MaintenancePhoto" ADD CONSTRAINT "MaintenancePhoto_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "MaintenanceEvent" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "maintenanceRequestId" TEXT NOT NULL,
  "actorId" TEXT,
  "kind" TEXT NOT NULL,
  "body" TEXT,
  "fromStatus" "MaintenanceStatus",
  "toStatus" "MaintenanceStatus",
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MaintenanceEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "MaintenanceEvent_organizationId_maintenanceRequestId_createdAt_idx" ON "MaintenanceEvent"("organizationId", "maintenanceRequestId", "createdAt");
ALTER TABLE "MaintenanceEvent" ADD CONSTRAINT "MaintenanceEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MaintenanceEvent" ADD CONSTRAINT "MaintenanceEvent_maintenanceRequestId_organizationId_fkey" FOREIGN KEY ("maintenanceRequestId", "organizationId") REFERENCES "MaintenanceRequest"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MaintenanceEvent" ADD CONSTRAINT "MaintenanceEvent_actorId_organizationId_fkey" FOREIGN KEY ("actorId", "organizationId") REFERENCES "User"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
