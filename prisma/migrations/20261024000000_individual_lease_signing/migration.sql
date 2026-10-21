-- CreateTable
CREATE TABLE "LeaseAgreement" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "leaseId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "snapshotHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "signedAt" TIMESTAMP(3),
    "supersededAt" TIMESTAMP(3),
    "archiveStatus" TEXT NOT NULL DEFAULT 'AWAITING_SIGNATURES',

    CONSTRAINT "LeaseAgreement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaseAgreementParty" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "agreementId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT,
    "expectedName" TEXT NOT NULL,
    "expectedEmail" TEXT NOT NULL,
    "fullName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "consent" BOOLEAN,
    "consentVersion" TEXT,
    "authenticatedSubjectId" TEXT,
    "authenticatedEmail" TEXT,
    "authenticationVersion" BIGINT,
    "sessionIssuedAt" INTEGER,
    "signedAt" TIMESTAMP(3),

    CONSTRAINT "LeaseAgreementParty_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LeaseAgreement_organizationId_leaseId_idx" ON "LeaseAgreement"("organizationId", "leaseId");

-- CreateIndex
CREATE UNIQUE INDEX "LeaseAgreement_id_organizationId_key" ON "LeaseAgreement"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "LeaseAgreement_leaseId_version_key" ON "LeaseAgreement"("leaseId", "version");

-- CreateIndex
CREATE INDEX "LeaseAgreementParty_organizationId_userId_idx" ON "LeaseAgreementParty"("organizationId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "LeaseAgreementParty_agreementId_userId_key" ON "LeaseAgreementParty"("agreementId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "LeaseAgreementParty_agreementId_tenantId_key" ON "LeaseAgreementParty"("agreementId", "tenantId");

-- AddForeignKey
ALTER TABLE "LeaseAgreement" ADD CONSTRAINT "LeaseAgreement_leaseId_organizationId_fkey" FOREIGN KEY ("leaseId", "organizationId") REFERENCES "Lease"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaseAgreementParty" ADD CONSTRAINT "LeaseAgreementParty_agreementId_organizationId_fkey" FOREIGN KEY ("agreementId", "organizationId") REFERENCES "LeaseAgreement"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaseAgreementParty" ADD CONSTRAINT "LeaseAgreementParty_userId_organizationId_fkey" FOREIGN KEY ("userId", "organizationId") REFERENCES "User"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaseAgreementParty" ADD CONSTRAINT "LeaseAgreementParty_tenantId_organizationId_fkey" FOREIGN KEY ("tenantId", "organizationId") REFERENCES "Tenant"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- No historical lease or ledger rows are backfilled or rewritten by this migration.
ALTER TABLE "LeaseAgreement" ADD CONSTRAINT "LeaseAgreement_version_hash_check"
  CHECK ("version" > 0 AND "snapshotHash" ~ '^[a-f0-9]{64}$');
ALTER TABLE "LeaseAgreementParty" ADD CONSTRAINT "LeaseAgreementParty_role_check"
  CHECK (("role" = 'OWNER' AND "tenantId" IS NULL) OR ("role" = 'TENANT' AND "tenantId" IS NOT NULL));
CREATE UNIQUE INDEX "LeaseAgreement_one_current" ON "LeaseAgreement" ("leaseId") WHERE "supersededAt" IS NULL;
CREATE UNIQUE INDEX "LeaseAgreement_one_owner" ON "LeaseAgreementParty" ("agreementId") WHERE "role" = 'OWNER';
ALTER TABLE "LeaseAgreementParty" ADD CONSTRAINT "LeaseAgreementParty_signature_check" CHECK (
  ("signedAt" IS NULL AND "fullName" IS NULL AND "email" IS NULL AND "phone" IS NULL AND "consent" IS NULL
    AND "consentVersion" IS NULL AND "authenticatedSubjectId" IS NULL AND "authenticatedEmail" IS NULL
    AND "authenticationVersion" IS NULL AND "sessionIssuedAt" IS NULL)
  OR
  ("signedAt" IS NOT NULL AND "fullName" IS NOT NULL AND length(trim("fullName")) BETWEEN 2 AND 200
    AND "email" IS NOT NULL AND "email" = "expectedEmail" AND "phone" IS NOT NULL
    AND "consent" IS TRUE AND "consentVersion" IS NOT NULL
    AND "authenticatedSubjectId" IS NOT NULL AND "authenticatedSubjectId" = "userId"
    AND "authenticatedEmail" IS NOT NULL AND lower(trim("authenticatedEmail")) = "expectedEmail"
    AND "authenticationVersion" IS NOT NULL AND "sessionIssuedAt" IS NOT NULL)
);

CREATE FUNCTION protect_lease_agreement() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF ROW(NEW."id", NEW."organizationId", NEW."leaseId", NEW."version", NEW."snapshot", NEW."snapshotHash", NEW."createdAt")
    IS DISTINCT FROM ROW(OLD."id", OLD."organizationId", OLD."leaseId", OLD."version", OLD."snapshot", OLD."snapshotHash", OLD."createdAt")
    OR (OLD."signedAt" IS NOT NULL AND NEW."signedAt" IS DISTINCT FROM OLD."signedAt")
    OR (OLD."supersededAt" IS NOT NULL AND NEW."supersededAt" IS DISTINCT FROM OLD."supersededAt") THEN
    RAISE EXCEPTION 'Agreement versions are immutable';
  END IF;
  IF NEW."signedAt" IS NOT NULL AND OLD."signedAt" IS NULL THEN
    IF NOT EXISTS (SELECT 1 FROM "LeaseAgreementParty" WHERE "agreementId" = NEW."id" AND "role" = 'OWNER')
      OR NOT EXISTS (SELECT 1 FROM "LeaseAgreementParty" WHERE "agreementId" = NEW."id" AND "role" = 'TENANT')
      OR EXISTS (SELECT 1 FROM "LeaseAgreementParty" WHERE "agreementId" = NEW."id" AND "signedAt" IS NULL) THEN
      RAISE EXCEPTION 'All required parties must sign individually';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "LeaseAgreement_immutable" BEFORE UPDATE ON "LeaseAgreement"
  FOR EACH ROW EXECUTE FUNCTION protect_lease_agreement();

CREATE FUNCTION protect_lease_signature() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Required parties and recorded signatures are immutable';
  END IF;
  IF ROW(NEW."id", NEW."organizationId", NEW."agreementId", NEW."role", NEW."userId", NEW."tenantId", NEW."expectedName", NEW."expectedEmail")
    IS DISTINCT FROM ROW(OLD."id", OLD."organizationId", OLD."agreementId", OLD."role", OLD."userId", OLD."tenantId", OLD."expectedName", OLD."expectedEmail")
    OR (OLD."signedAt" IS NOT NULL AND NEW IS DISTINCT FROM OLD) THEN
    RAISE EXCEPTION 'Recorded signatures and required identities are immutable';
  END IF;
  IF NEW."signedAt" IS NOT NULL AND OLD."signedAt" IS NULL AND EXISTS
    (SELECT 1 FROM "LeaseAgreement" WHERE "id" = NEW."agreementId" AND "supersededAt" IS NOT NULL) THEN
    RAISE EXCEPTION 'A superseded agreement cannot accept signatures';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "LeaseAgreementParty_immutable" BEFORE UPDATE OR DELETE ON "LeaseAgreementParty"
  FOR EACH ROW EXECUTE FUNCTION protect_lease_signature();

CREATE FUNCTION validate_lease_party_roster() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."signedAt" IS NOT NULL OR NOT EXISTS (
    SELECT 1 FROM "LeaseAgreement" a, jsonb_array_elements(a."snapshot"->'parties') p
    WHERE a."id" = NEW."agreementId" AND a."supersededAt" IS NULL AND a."signedAt" IS NULL
      AND p->>'userId' = NEW."userId" AND p->>'role' = NEW."role"
      AND p->>'expectedName' = NEW."expectedName" AND p->>'expectedEmail' = NEW."expectedEmail"
      AND COALESCE(p->>'tenantId', '') = COALESCE(NEW."tenantId", '')
  ) THEN RAISE EXCEPTION 'Required parties must match the immutable agreement snapshot'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "LeaseAgreementParty_roster" BEFORE INSERT ON "LeaseAgreementParty"
  FOR EACH ROW EXECUTE FUNCTION validate_lease_party_roster();

-- Invalidate the current version even if edited values later return to their old values.
-- The old snapshot, signatures, completion timestamp and archive state remain intact.
CREATE FUNCTION invalidate_lease_terms() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF ROW(NEW."unitId", NEW."startDate", NEW."endDate", NEW."monthlyRent", NEW."deposit", NEW."lateFee",
    NEW."graceDays", NEW."rentDueDay", NEW."prorateFirstMonth", NEW."moveInFee", NEW."petDeposit", NEW."occupants",
    NEW."templateId", NEW."templateVersion", NEW."termsSnapshot")
    IS DISTINCT FROM ROW(OLD."unitId", OLD."startDate", OLD."endDate", OLD."monthlyRent", OLD."deposit", OLD."lateFee",
    OLD."graceDays", OLD."rentDueDay", OLD."prorateFirstMonth", OLD."moveInFee", OLD."petDeposit", OLD."occupants",
    OLD."templateId", OLD."templateVersion", OLD."termsSnapshot") THEN
    IF OLD."eSignStatus" = 'SIGNED' AND NOT EXISTS (SELECT 1 FROM "LeaseAgreement" WHERE "leaseId" = OLD."id") THEN
      RAISE EXCEPTION 'Historical signed terms are immutable; create a renewal';
    END IF;
    UPDATE "LeaseAgreement" SET "supersededAt" = CURRENT_TIMESTAMP
      WHERE "leaseId" = OLD."id" AND "supersededAt" IS NULL;
    IF FOUND THEN NEW."eSignStatus" = 'NOT_SENT'; NEW."signedAt" = NULL; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "Lease_invalidate_agreement" BEFORE UPDATE ON "Lease"
  FOR EACH ROW EXECUTE FUNCTION invalidate_lease_terms();

CREATE FUNCTION invalidate_lease_parties_or_draft() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE affected_id text;
BEGIN
  IF TG_OP = 'DELETE' THEN affected_id = OLD."leaseId"; ELSE affected_id = NEW."leaseId"; END IF;
  IF TG_OP = 'UPDATE' AND NEW IS NOT DISTINCT FROM OLD THEN RETURN NEW; END IF;
  IF TG_TABLE_NAME = 'LeaseDraft' AND TG_OP = 'UPDATE' THEN
    IF NEW."data" IS NOT DISTINCT FROM OLD."data" THEN RETURN NEW; END IF;
  END IF;
  PERFORM "id" FROM "Lease" WHERE "id" = affected_id FOR UPDATE;
  UPDATE "LeaseAgreement" SET "supersededAt" = CURRENT_TIMESTAMP
    WHERE "leaseId" = affected_id AND "supersededAt" IS NULL;
  IF FOUND THEN UPDATE "Lease" SET "eSignStatus" = 'NOT_SENT', "signedAt" = NULL WHERE "id" = affected_id; END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;
CREATE TRIGGER "LeaseTenant_invalidate_agreement" BEFORE INSERT OR UPDATE OR DELETE ON "LeaseTenant"
  FOR EACH ROW EXECUTE FUNCTION invalidate_lease_parties_or_draft();
CREATE TRIGGER "LeaseDraft_invalidate_agreement" BEFORE INSERT OR UPDATE OR DELETE ON "LeaseDraft"
  FOR EACH ROW EXECUTE FUNCTION invalidate_lease_parties_or_draft();
