ALTER TYPE "ProviderKind" ADD VALUE 'EMAIL';

ALTER TABLE "User" ADD COLUMN "emailNotificationsEnabled" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "EmailDelivery" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "eventKey" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "recipient" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'mock',
  "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmailDelivery_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EmailDelivery_organizationId_eventKey_recipient_key" ON "EmailDelivery"("organizationId", "eventKey", "recipient");
CREATE INDEX "EmailDelivery_organizationId_sentAt_idx" ON "EmailDelivery"("organizationId", "sentAt");
ALTER TABLE "EmailDelivery" ADD CONSTRAINT "EmailDelivery_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
