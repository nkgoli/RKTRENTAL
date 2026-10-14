CREATE TYPE "ExpenseCategory" AS ENUM ('TAXES', 'INSURANCE', 'REPAIRS', 'MANAGEMENT', 'UTILITIES', 'OTHER');

ALTER TABLE "Property" ADD COLUMN "downPayment" DECIMAL(12,2),
ADD COLUMN "loanAmount" DECIMAL(12,2),
ADD COLUMN "purchasePrice" DECIMAL(12,2);

CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "category" "ExpenseCategory" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "occurredOn" DATE NOT NULL,
    "description" TEXT,
    "vendor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Expense_organizationId_propertyId_occurredOn_idx" ON "Expense"("organizationId", "propertyId", "occurredOn");
CREATE INDEX "Expense_organizationId_category_occurredOn_idx" ON "Expense"("organizationId", "category", "occurredOn");
CREATE UNIQUE INDEX "Expense_id_organizationId_key" ON "Expense"("id", "organizationId");

ALTER TABLE "Expense" ADD CONSTRAINT "Expense_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_propertyId_organizationId_fkey" FOREIGN KEY ("propertyId", "organizationId") REFERENCES "Property"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER INDEX "MaintenanceEvent_organizationId_maintenanceRequestId_createdAt_" RENAME TO "MaintenanceEvent_organizationId_maintenanceRequestId_create_idx";
