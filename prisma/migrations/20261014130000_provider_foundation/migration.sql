CREATE TYPE "ProviderKind" AS ENUM ('PAYMENTS', 'BANKING', 'SCREENING', 'COMPS');
CREATE TYPE "ProviderConnectionStatus" AS ENUM ('CONNECTED', 'DISCONNECTED', 'ERROR');
CREATE TYPE "ApplicationStatus" AS ENUM ('SUBMITTED', 'SCREENING', 'REVIEW', 'APPROVED', 'DECLINED');

CREATE TABLE "ProviderConnection" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "kind" "ProviderKind" NOT NULL,
    "provider" TEXT NOT NULL,
    "status" "ProviderConnectionStatus" NOT NULL DEFAULT 'DISCONNECTED',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProviderConnection_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ProviderConnection_organizationId_kind_provider_key" ON "ProviderConnection"("organizationId","kind","provider");
CREATE INDEX "ProviderConnection_organizationId_status_idx" ON "ProviderConnection"("organizationId","status");
ALTER TABLE "ProviderConnection" ADD CONSTRAINT "ProviderConnection_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "WebhookEvent_provider_externalEventId_key" ON "WebhookEvent"("provider","externalEventId");
CREATE INDEX "WebhookEvent_organizationId_receivedAt_idx" ON "WebhookEvent"("organizationId","receivedAt");
ALTER TABLE "WebhookEvent" ADD CONSTRAINT "WebhookEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "PaymentMethod" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerToken" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "last4" TEXT,
    "brand" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PaymentMethod_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PaymentMethod_id_organizationId_key" ON "PaymentMethod"("id","organizationId");
CREATE UNIQUE INDEX "PaymentMethod_provider_providerToken_key" ON "PaymentMethod"("provider","providerToken");
CREATE INDEX "PaymentMethod_organizationId_tenantId_idx" ON "PaymentMethod"("organizationId","tenantId");
ALTER TABLE "PaymentMethod" ADD CONSTRAINT "PaymentMethod_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentMethod" ADD CONSTRAINT "PaymentMethod_tenantId_organizationId_fkey" FOREIGN KEY ("tenantId","organizationId") REFERENCES "Tenant"("id","organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "AutopaySetting" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "leaseId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "paymentMethodId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "dayOfMonth" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AutopaySetting_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AutopaySetting_dayOfMonth_check" CHECK ("dayOfMonth" BETWEEN 1 AND 28)
);
CREATE UNIQUE INDEX "AutopaySetting_leaseId_tenantId_key" ON "AutopaySetting"("leaseId","tenantId");
CREATE INDEX "AutopaySetting_organizationId_enabled_idx" ON "AutopaySetting"("organizationId","enabled");
ALTER TABLE "AutopaySetting" ADD CONSTRAINT "AutopaySetting_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AutopaySetting" ADD CONSTRAINT "AutopaySetting_leaseId_organizationId_fkey" FOREIGN KEY ("leaseId","organizationId") REFERENCES "Lease"("id","organizationId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AutopaySetting" ADD CONSTRAINT "AutopaySetting_tenantId_organizationId_fkey" FOREIGN KEY ("tenantId","organizationId") REFERENCES "Tenant"("id","organizationId") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AutopaySetting" ADD CONSTRAINT "AutopaySetting_paymentMethodId_organizationId_fkey" FOREIGN KEY ("paymentMethodId","organizationId") REFERENCES "PaymentMethod"("id","organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "Payout" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerReference" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "status" TEXT NOT NULL,
    "arrivalDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Payout_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Payout_positive_amount" CHECK ("amount" > 0)
);
CREATE UNIQUE INDEX "Payout_providerReference_key" ON "Payout"("providerReference");
CREATE INDEX "Payout_organizationId_createdAt_idx" ON "Payout"("organizationId","createdAt");
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Application" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "applicantName" TEXT NOT NULL,
    "applicantEmail" TEXT NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'SUBMITTED',
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Application_id_organizationId_key" ON "Application"("id","organizationId");
CREATE INDEX "Application_organizationId_status_appliedAt_idx" ON "Application"("organizationId","status","appliedAt");
ALTER TABLE "Application" ADD CONSTRAINT "Application_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Application" ADD CONSTRAINT "Application_unitId_organizationId_fkey" FOREIGN KEY ("unitId","organizationId") REFERENCES "Unit"("id","organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "ScreeningConsent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "consentedAt" TIMESTAMP(3) NOT NULL,
    "consentVersion" TEXT NOT NULL,
    "revokedAt" TIMESTAMP(3),
    CONSTRAINT "ScreeningConsent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ScreeningConsent_applicationId_provider_key" ON "ScreeningConsent"("applicationId","provider");
CREATE INDEX "ScreeningConsent_organizationId_consentedAt_idx" ON "ScreeningConsent"("organizationId","consentedAt");
ALTER TABLE "ScreeningConsent" ADD CONSTRAINT "ScreeningConsent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScreeningConsent" ADD CONSTRAINT "ScreeningConsent_applicationId_organizationId_fkey" FOREIGN KEY ("applicationId","organizationId") REFERENCES "Application"("id","organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ScreeningReport" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerReference" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "summary" JSONB,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ScreeningReport_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ScreeningReport_provider_providerReference_key" ON "ScreeningReport"("provider","providerReference");
CREATE INDEX "ScreeningReport_organizationId_applicationId_idx" ON "ScreeningReport"("organizationId","applicationId");
ALTER TABLE "ScreeningReport" ADD CONSTRAINT "ScreeningReport_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScreeningReport" ADD CONSTRAINT "ScreeningReport_applicationId_organizationId_fkey" FOREIGN KEY ("applicationId","organizationId") REFERENCES "Application"("id","organizationId") ON DELETE CASCADE ON UPDATE CASCADE;
