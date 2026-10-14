ALTER TABLE "Application"
  ADD COLUMN "decisionReason" TEXT,
  ADD COLUMN "decidedBy" TEXT,
  ADD COLUMN "decidedAt" TIMESTAMP(3);

ALTER TABLE "Payout"
  ADD COLUMN "propertyId" TEXT,
  ADD COLUMN "month" VARCHAR(7);

-- Preserve the property and accounting period previously packed into status.
UPDATE "Payout"
SET "propertyId" = NULLIF(split_part(split_part("status", 'property:', 2), '|', 1), ''),
    "month" = NULLIF(split_part(split_part("status", 'period:', 2), '|', 1), ''),
    "status" = split_part("status", '|', 1)
WHERE "status" LIKE '%|%';

CREATE INDEX "Payout_organizationId_propertyId_month_idx"
  ON "Payout"("organizationId", "propertyId", "month");
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_propertyId_organizationId_fkey"
  FOREIGN KEY ("propertyId", "organizationId")
  REFERENCES "Property"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;
