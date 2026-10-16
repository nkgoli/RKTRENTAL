-- AlterTable
ALTER TABLE "Document" ADD COLUMN "sortOrder" INTEGER;

-- Backfill existing photos per target in creation order (0-based).
WITH ordered AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "organizationId", "leaseId", "propertyId", "unitId"
      ORDER BY "createdAt" ASC, "id" ASC
    ) - 1 AS "rn"
  FROM "Document"
  WHERE "kind" = 'PHOTO'
)
UPDATE "Document" AS d
SET "sortOrder" = ordered."rn"
FROM ordered
WHERE d."id" = ordered."id";
