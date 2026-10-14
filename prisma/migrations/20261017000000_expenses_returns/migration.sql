-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('TAXES', 'INSURANCE', 'REPAIRS', 'MANAGEMENT', 'UTILITIES', 'OTHER');

-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "annualDebtService" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "downPayment" DECIMAL(12,2),
ADD COLUMN     "loanAmount" DECIMAL(12,2),
ADD COLUMN     "purchasePrice" DECIMAL(12,2);

-- CreateTable
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

-- CreateIndex
CREATE INDEX "Expense_organizationId_propertyId_occurredOn_idx" ON "Expense"("organizationId", "propertyId", "occurredOn");

-- CreateIndex
CREATE INDEX "Expense_organizationId_category_occurredOn_idx" ON "Expense"("organizationId", "category", "occurredOn");

-- CreateIndex
CREATE UNIQUE INDEX "Expense_id_organizationId_key" ON "Expense"("id", "organizationId");

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_propertyId_organizationId_fkey" FOREIGN KEY ("propertyId", "organizationId") REFERENCES "Property"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;
