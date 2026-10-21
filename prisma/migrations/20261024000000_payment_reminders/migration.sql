-- CreateEnum
CREATE TYPE "ReminderChannel" AS ENUM ('EMAIL', 'SMS');

-- CreateEnum
CREATE TYPE "ReminderAttemptStatus" AS ENUM ('READY', 'SENDING', 'MOCK_RECORDED', 'ACCEPTED', 'DELIVERED', 'FAILED', 'UNCERTAIN', 'CANCELLED');

-- AlterEnum
ALTER TYPE "ProviderKind" ADD VALUE 'SMS';

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "emailRemindersEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "smsRemindersEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "PaymentReminderPreview" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "managerId" TEXT NOT NULL,
    "leaseId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "channel" "ReminderChannel" NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "dispatchedAt" TIMESTAMP(3),
    "idempotencyKey" TEXT,
    "dedupeKey" TEXT,

    CONSTRAINT "PaymentReminderPreview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentReminderAttempt" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "previewId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerId" TEXT,
    "status" "ReminderAttemptStatus" NOT NULL DEFAULT 'READY',
    "errorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentReminderAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentReminderPreview_dedupeKey_key" ON "PaymentReminderPreview"("dedupeKey");

-- CreateIndex
CREATE INDEX "PaymentReminderPreview_organizationId_leaseId_createdAt_idx" ON "PaymentReminderPreview"("organizationId", "leaseId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentReminderPreview_id_organizationId_key" ON "PaymentReminderPreview"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentReminderPreview_organizationId_idempotencyKey_key" ON "PaymentReminderPreview"("organizationId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "PaymentReminderAttempt_organizationId_status_createdAt_idx" ON "PaymentReminderAttempt"("organizationId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentReminderAttempt_previewId_recipient_key" ON "PaymentReminderAttempt"("previewId", "recipient");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentReminderAttempt_provider_providerId_key" ON "PaymentReminderAttempt"("provider", "providerId");

-- AddForeignKey
ALTER TABLE "PaymentReminderPreview" ADD CONSTRAINT "PaymentReminderPreview_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentReminderPreview" ADD CONSTRAINT "PaymentReminderPreview_managerId_organizationId_fkey" FOREIGN KEY ("managerId", "organizationId") REFERENCES "User"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentReminderPreview" ADD CONSTRAINT "PaymentReminderPreview_leaseId_organizationId_fkey" FOREIGN KEY ("leaseId", "organizationId") REFERENCES "Lease"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentReminderAttempt" ADD CONSTRAINT "PaymentReminderAttempt_previewId_organizationId_fkey" FOREIGN KEY ("previewId", "organizationId") REFERENCES "PaymentReminderPreview"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

