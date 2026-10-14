-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('MANAGER', 'OWNER', 'TENANT', 'ADMIN');

-- CreateEnum
CREATE TYPE "PropertyType" AS ENUM ('SINGLE_UNIT', 'MULTI_UNIT');

-- CreateEnum
CREATE TYPE "UnitStatus" AS ENUM ('OCCUPIED', 'VACANT', 'TURNOVER', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "LeaseStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ENDED', 'TERMINATED');

-- CreateEnum
CREATE TYPE "ESignStatus" AS ENUM ('NOT_SENT', 'SENT', 'PARTIALLY_SIGNED', 'SIGNED', 'DECLINED');

-- CreateEnum
CREATE TYPE "DocumentKind" AS ENUM ('LEASE', 'NOTICE', 'INSPECTION', 'ID', 'PHOTO', 'OTHER');

-- CreateEnum
CREATE TYPE "ChargeKind" AS ENUM ('RENT', 'LATE_FEE', 'DEPOSIT', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "MaintenancePriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "MaintenanceStatus" AS ENUM ('NEW', 'ASSIGNED', 'IN_PROGRESS', 'DONE', 'CANCELLED');

-- DropTable
DROP TABLE "AppMeta";

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "role" "UserRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Property" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "ownerId" TEXT,
    "name" TEXT NOT NULL,
    "type" "PropertyType" NOT NULL,
    "street" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "postalCode" TEXT NOT NULL,
    "yearBuilt" INTEGER,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Unit" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "isImplicit" BOOLEAN NOT NULL DEFAULT false,
    "bedrooms" INTEGER,
    "bathrooms" DECIMAL(3,1),
    "squareFeet" INTEGER,
    "listedRent" DECIMAL(12,2),
    "status" "UnitStatus" NOT NULL DEFAULT 'VACANT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Unit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lease" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "monthlyRent" DECIMAL(12,2) NOT NULL,
    "deposit" DECIMAL(12,2) NOT NULL,
    "lateFee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "graceDays" INTEGER NOT NULL DEFAULT 0,
    "status" "LeaseStatus" NOT NULL DEFAULT 'DRAFT',
    "eSignStatus" "ESignStatus" NOT NULL DEFAULT 'NOT_SENT',
    "signedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lease_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaseTenant" (
    "leaseId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "LeaseTenant_pkey" PRIMARY KEY ("leaseId","tenantId")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "leaseId" TEXT,
    "propertyId" TEXT,
    "unitId" TEXT,
    "kind" "DocumentKind" NOT NULL,
    "name" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Charge" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "leaseId" TEXT NOT NULL,
    "kind" "ChargeKind" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "dueDate" DATE NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Charge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "leaseId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "providerReference" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaintenanceRequest" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "priority" "MaintenancePriority" NOT NULL DEFAULT 'NORMAL',
    "status" "MaintenanceStatus" NOT NULL DEFAULT 'NEW',
    "vendorName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "MaintenanceRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaintenancePhoto" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "maintenanceRequestId" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaintenancePhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "User_organizationId_role_idx" ON "User"("organizationId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "User_organizationId_email_key" ON "User"("organizationId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "User_id_organizationId_key" ON "User"("id", "organizationId");

-- CreateIndex
CREATE INDEX "Property_organizationId_archivedAt_idx" ON "Property"("organizationId", "archivedAt");

-- CreateIndex
CREATE INDEX "Property_organizationId_ownerId_idx" ON "Property"("organizationId", "ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "Property_id_organizationId_key" ON "Property"("id", "organizationId");

-- CreateIndex
CREATE INDEX "Unit_organizationId_status_idx" ON "Unit"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Unit_propertyId_number_key" ON "Unit"("propertyId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "Unit_id_organizationId_key" ON "Unit"("id", "organizationId");

-- Keep a request's property and unit aligned within the same organization.
CREATE UNIQUE INDEX "Unit_id_propertyId_organizationId_key" ON "Unit"("id", "propertyId", "organizationId");

-- CreateIndex
CREATE INDEX "Tenant_organizationId_name_idx" ON "Tenant"("organizationId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_id_organizationId_key" ON "Tenant"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_userId_organizationId_key" ON "Tenant"("userId", "organizationId");

-- CreateIndex
CREATE INDEX "Lease_organizationId_unitId_status_idx" ON "Lease"("organizationId", "unitId", "status");

-- CreateIndex
CREATE INDEX "Lease_organizationId_endDate_idx" ON "Lease"("organizationId", "endDate");

-- CreateIndex
CREATE UNIQUE INDEX "Lease_id_organizationId_key" ON "Lease"("id", "organizationId");

-- CreateIndex
CREATE INDEX "LeaseTenant_organizationId_tenantId_idx" ON "LeaseTenant"("organizationId", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "Document_storageKey_key" ON "Document"("storageKey");

-- CreateIndex
CREATE INDEX "Document_organizationId_leaseId_idx" ON "Document"("organizationId", "leaseId");

-- CreateIndex
CREATE INDEX "Document_organizationId_propertyId_idx" ON "Document"("organizationId", "propertyId");

-- CreateIndex
CREATE INDEX "Document_organizationId_unitId_idx" ON "Document"("organizationId", "unitId");

-- CreateIndex
CREATE INDEX "Charge_organizationId_leaseId_dueDate_idx" ON "Charge"("organizationId", "leaseId", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_providerReference_key" ON "Payment"("providerReference");

-- CreateIndex
CREATE INDEX "Payment_organizationId_leaseId_createdAt_idx" ON "Payment"("organizationId", "leaseId", "createdAt");

-- CreateIndex
CREATE INDEX "MaintenanceRequest_organizationId_status_priority_idx" ON "MaintenanceRequest"("organizationId", "status", "priority");

-- CreateIndex
CREATE INDEX "MaintenanceRequest_organizationId_unitId_idx" ON "MaintenanceRequest"("organizationId", "unitId");

-- CreateIndex
CREATE UNIQUE INDEX "MaintenanceRequest_id_organizationId_key" ON "MaintenanceRequest"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "MaintenancePhoto_storageKey_key" ON "MaintenancePhoto"("storageKey");

-- CreateIndex
CREATE INDEX "MaintenancePhoto_organizationId_maintenanceRequestId_idx" ON "MaintenancePhoto"("organizationId", "maintenanceRequestId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Property" ADD CONSTRAINT "Property_ownerId_organizationId_fkey" FOREIGN KEY ("ownerId", "organizationId") REFERENCES "User"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_propertyId_organizationId_fkey" FOREIGN KEY ("propertyId", "organizationId") REFERENCES "Property"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_userId_organizationId_fkey" FOREIGN KEY ("userId", "organizationId") REFERENCES "User"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lease" ADD CONSTRAINT "Lease_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lease" ADD CONSTRAINT "Lease_unitId_organizationId_fkey" FOREIGN KEY ("unitId", "organizationId") REFERENCES "Unit"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaseTenant" ADD CONSTRAINT "LeaseTenant_leaseId_organizationId_fkey" FOREIGN KEY ("leaseId", "organizationId") REFERENCES "Lease"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaseTenant" ADD CONSTRAINT "LeaseTenant_tenantId_organizationId_fkey" FOREIGN KEY ("tenantId", "organizationId") REFERENCES "Tenant"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_leaseId_organizationId_fkey" FOREIGN KEY ("leaseId", "organizationId") REFERENCES "Lease"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_propertyId_organizationId_fkey" FOREIGN KEY ("propertyId", "organizationId") REFERENCES "Property"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_unitId_organizationId_fkey" FOREIGN KEY ("unitId", "organizationId") REFERENCES "Unit"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Charge" ADD CONSTRAINT "Charge_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Charge" ADD CONSTRAINT "Charge_leaseId_organizationId_fkey" FOREIGN KEY ("leaseId", "organizationId") REFERENCES "Lease"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_leaseId_organizationId_fkey" FOREIGN KEY ("leaseId", "organizationId") REFERENCES "Lease"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_propertyId_organizationId_fkey" FOREIGN KEY ("propertyId", "organizationId") REFERENCES "Property"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_unitId_propertyId_organizationId_fkey" FOREIGN KEY ("unitId", "propertyId", "organizationId") REFERENCES "Unit"("id", "propertyId", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenancePhoto" ADD CONSTRAINT "MaintenancePhoto_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenancePhoto" ADD CONSTRAINT "MaintenancePhoto_maintenanceRequestId_organizationId_fkey" FOREIGN KEY ("maintenanceRequestId", "organizationId") REFERENCES "MaintenanceRequest"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- A current lease occupies one unit for its entire inclusive term. The GiST
-- exclusion constraint also protects concurrent inserts and status changes.
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE "Lease" ADD CONSTRAINT "Lease_valid_term" CHECK ("endDate" >= "startDate");
ALTER TABLE "Lease" ADD CONSTRAINT "Lease_nonnegative_money" CHECK (
  "monthlyRent" >= 0 AND "deposit" >= 0 AND "lateFee" >= 0 AND "graceDays" >= 0
);
ALTER TABLE "Lease" ADD CONSTRAINT "Lease_no_overlapping_active"
  EXCLUDE USING gist ("unitId" WITH =, daterange("startDate", "endDate", '[]') WITH &&)
  WHERE ("status" = 'ACTIVE');

ALTER TABLE "Document" ADD CONSTRAINT "Document_exactly_one_parent" CHECK (
  num_nonnulls("leaseId", "propertyId", "unitId") = 1
);
ALTER TABLE "Document" ADD CONSTRAINT "Document_positive_size" CHECK ("sizeBytes" > 0);
ALTER TABLE "MaintenancePhoto" ADD CONSTRAINT "MaintenancePhoto_positive_size" CHECK ("sizeBytes" > 0);
ALTER TABLE "Charge" ADD CONSTRAINT "Charge_nonnegative_amount" CHECK ("amount" >= 0);
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_positive_amount" CHECK ("amount" > 0);
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_nonnegative_values" CHECK (
  ("bedrooms" IS NULL OR "bedrooms" >= 0) AND
  ("bathrooms" IS NULL OR "bathrooms" >= 0) AND
  ("squareFeet" IS NULL OR "squareFeet" > 0) AND
  ("listedRent" IS NULL OR "listedRent" >= 0)
);
CREATE UNIQUE INDEX "Unit_one_implicit_per_property" ON "Unit"("propertyId") WHERE "isImplicit";
