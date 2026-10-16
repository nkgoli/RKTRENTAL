CREATE TABLE "LeaseTemplate" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "defaultFees" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LeaseTemplate_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "LeaseTemplate_id_organizationId_key" ON "LeaseTemplate"("id", "organizationId");
CREATE INDEX "LeaseTemplate_organizationId_name_idx" ON "LeaseTemplate"("organizationId", "name");
ALTER TABLE "LeaseTemplate" ADD CONSTRAINT "LeaseTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "LeaseTemplateItem" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "templateId" TEXT NOT NULL,
  "section" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL,
  "required" BOOLEAN NOT NULL DEFAULT false,
  "includeWhen" TEXT NOT NULL DEFAULT 'ALWAYS',
  CONSTRAINT "LeaseTemplateItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "LeaseTemplateItem_organizationId_templateId_section_sortOrder_idx" ON "LeaseTemplateItem"("organizationId", "templateId", "section", "sortOrder");
ALTER TABLE "LeaseTemplateItem" ADD CONSTRAINT "LeaseTemplateItem_templateId_organizationId_fkey" FOREIGN KEY ("templateId", "organizationId") REFERENCES "LeaseTemplate"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Property" ADD COLUMN "defaultLeaseTemplateId" TEXT;
ALTER TABLE "Property" ADD CONSTRAINT "Property_defaultLeaseTemplateId_organizationId_fkey" FOREIGN KEY ("defaultLeaseTemplateId", "organizationId") REFERENCES "LeaseTemplate"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Lease" ADD COLUMN "templateId" TEXT;
ALTER TABLE "Lease" ADD COLUMN "templateVersion" INTEGER;
ALTER TABLE "Lease" ADD COLUMN "termsSnapshot" JSONB;
ALTER TABLE "Lease" ADD CONSTRAINT "Lease_templateId_organizationId_fkey" FOREIGN KEY ("templateId", "organizationId") REFERENCES "LeaseTemplate"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
