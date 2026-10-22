-- Nullable additions preserve every existing application and tenant. No backfill or merging.
ALTER TABLE "Application"
  ADD COLUMN "promotedTenantId" TEXT,
  ADD COLUMN "promotedAt" TIMESTAMP(3),
  ADD COLUMN "promotedBy" TEXT;

CREATE INDEX "Application_promotedTenantId_organizationId_idx"
  ON "Application"("promotedTenantId", "organizationId");

ALTER TABLE "Application" ADD CONSTRAINT "Application_promotedTenantId_organizationId_fkey"
  FOREIGN KEY ("promotedTenantId", "organizationId") REFERENCES "Tenant"("id", "organizationId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Application" ADD CONSTRAINT "Application_promotion_complete_check" CHECK (
  ("promotedTenantId" IS NULL AND "promotedAt" IS NULL AND "promotedBy" IS NULL)
  OR ("promotedTenantId" IS NOT NULL AND "promotedAt" IS NOT NULL AND "promotedBy" IS NOT NULL AND "status" = 'APPROVED')
);
