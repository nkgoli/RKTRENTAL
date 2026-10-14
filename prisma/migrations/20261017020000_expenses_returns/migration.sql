-- Main now creates these fields and tables in earlier migrations. Keep this
-- branch migration's schema intent, guarded so it also works after that merge.
DO $$
BEGIN
  CREATE TYPE "ExpenseCategory" AS ENUM ('TAXES', 'INSURANCE', 'REPAIRS', 'MANAGEMENT', 'UTILITIES', 'OTHER');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "annualDebtService" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "downPayment" DECIMAL(12,2);
ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "loanAmount" DECIMAL(12,2);
ALTER TABLE "Property" ADD COLUMN IF NOT EXISTS "purchasePrice" DECIMAL(12,2);

CREATE TABLE IF NOT EXISTS "Expense" (
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

CREATE INDEX IF NOT EXISTS "Expense_organizationId_propertyId_occurredOn_idx"
  ON "Expense"("organizationId", "propertyId", "occurredOn");
CREATE INDEX IF NOT EXISTS "Expense_organizationId_category_occurredOn_idx"
  ON "Expense"("organizationId", "category", "occurredOn");
CREATE UNIQUE INDEX IF NOT EXISTS "Expense_id_organizationId_key"
  ON "Expense"("id", "organizationId");

DO $$
BEGIN
  ALTER TABLE "Expense" ADD CONSTRAINT "Expense_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "Expense" ADD CONSTRAINT "Expense_propertyId_organizationId_fkey"
    FOREIGN KEY ("propertyId", "organizationId") REFERENCES "Property"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
