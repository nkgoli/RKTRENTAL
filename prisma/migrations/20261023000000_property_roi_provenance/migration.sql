-- Additive: demo provenance for property ROI inputs. No existing table or row changes.
CREATE TABLE "PropertyRoiProvenance" (
    "propertyId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "values" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PropertyRoiProvenance_pkey" PRIMARY KEY ("propertyId")
);

CREATE UNIQUE INDEX "PropertyRoiProvenance_propertyId_organizationId_key" ON "PropertyRoiProvenance"("propertyId", "organizationId");

ALTER TABLE "PropertyRoiProvenance" ADD CONSTRAINT "PropertyRoiProvenance_propertyId_organizationId_fkey" FOREIGN KEY ("propertyId", "organizationId") REFERENCES "Property"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;
