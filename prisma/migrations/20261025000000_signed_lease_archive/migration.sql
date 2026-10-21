ALTER TABLE "LeaseAgreement"
  ADD COLUMN "archiveAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "archiveNextAttemptAt" TIMESTAMP(3),
  ADD COLUMN "archiveLastError" TEXT,
  ADD COLUMN "archivedAt" TIMESTAMP(3);
ALTER TABLE "Document" ADD COLUMN "contentSha256" TEXT;
CREATE UNIQUE INDEX "Document_id_organizationId_key" ON "Document"("id", "organizationId");
CREATE INDEX "LeaseAgreement_organizationId_archiveStatus_archiveNextAtte_idx"
  ON "LeaseAgreement"("organizationId", "archiveStatus", "archiveNextAttemptAt");
CREATE TABLE "LeaseAgreementFile" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "organizationId" TEXT NOT NULL,
  "agreementId" TEXT NOT NULL,
  "documentId" TEXT NOT NULL,
  "slot" TEXT NOT NULL,
  "sha256" TEXT NOT NULL CHECK ("sha256" ~ '^[a-f0-9]{64}$'),
  CONSTRAINT "LeaseAgreementFile_agreementId_organizationId_fkey" FOREIGN KEY ("agreementId", "organizationId")
    REFERENCES "LeaseAgreement"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "LeaseAgreementFile_documentId_organizationId_fkey" FOREIGN KEY ("documentId", "organizationId")
    REFERENCES "Document"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "LeaseAgreementFile_agreementId_slot_key" ON "LeaseAgreementFile"("agreementId", "slot");
CREATE UNIQUE INDEX "LeaseAgreementFile_agreementId_documentId_key" ON "LeaseAgreementFile"("agreementId", "documentId");
CREATE INDEX "LeaseAgreementFile_documentId_organizationId_idx" ON "LeaseAgreementFile"("documentId", "organizationId");

CREATE FUNCTION protect_agreement_file() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE a "LeaseAgreement"; d "Document";
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Agreement file references are immutable'; END IF;
  SELECT * INTO a FROM "LeaseAgreement" WHERE "id" = NEW."agreementId";
  -- Same lease lock as sending and guarded file deletion.
  PERFORM 1 FROM "Lease" WHERE "id" = a."leaseId" FOR UPDATE;
  SELECT * INTO d FROM "Document" WHERE "id" = NEW."documentId";
  IF d."leaseId" IS DISTINCT FROM a."leaseId" OR d."contentSha256" IS DISTINCT FROM NEW."sha256" THEN
    RAISE EXCEPTION 'Agreement file must match its lease and recorded checksum';
  END IF;
  IF NEW."slot" = 'LEASE' THEN
    IF d."kind" <> 'LEASE' OR a."signedAt" IS NULL THEN RAISE EXCEPTION 'Only completed agreements can have a final lease'; END IF;
  ELSIF NEW."slot" = 'ADDENDUM:' || d."id" THEN
    IF d."kind" <> 'ADDENDUM' OR NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(a."snapshot"->'addendums') f
      WHERE f->>'documentId' = d."id" AND f->>'sha256' = NEW."sha256"
        AND f->>'name' = d."name" AND f->>'mimeType' = d."mimeType"
        AND (f->>'sizeBytes')::bigint = d."sizeBytes"
    ) THEN RAISE EXCEPTION 'Addendum must be part of the reviewed snapshot'; END IF;
  ELSE RAISE EXCEPTION 'Invalid agreement artifact slot'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "LeaseAgreementFile_immutable" BEFORE INSERT OR UPDATE OR DELETE ON "LeaseAgreementFile"
  FOR EACH ROW EXECUTE FUNCTION protect_agreement_file();

CREATE FUNCTION protect_agreement_document() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM "LeaseAgreementFile" WHERE "documentId" = OLD."id") THEN
    IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Agreement documents must be retained'; END IF;
    IF ROW(NEW."id", NEW."organizationId", NEW."leaseId", NEW."kind", NEW."name", NEW."storageKey", NEW."sizeBytes", NEW."mimeType", NEW."contentSha256")
      IS DISTINCT FROM ROW(OLD."id", OLD."organizationId", OLD."leaseId", OLD."kind", OLD."name", OLD."storageKey", OLD."sizeBytes", OLD."mimeType", OLD."contentSha256") THEN
      RAISE EXCEPTION 'Agreement documents are immutable';
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;
CREATE TRIGGER "Document_agreement_retention" BEFORE UPDATE OR DELETE ON "Document"
  FOR EACH ROW EXECUTE FUNCTION protect_agreement_document();

CREATE FUNCTION validate_archive_completion() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."archiveStatus" = 'ARCHIVED' AND (NEW."signedAt" IS NULL OR NEW."archivedAt" IS NULL OR NOT EXISTS (
    SELECT 1 FROM "LeaseAgreementFile" WHERE "agreementId" = NEW."id" AND "slot" = 'LEASE'
  )) THEN RAISE EXCEPTION 'Archive completion requires a final document'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "LeaseAgreement_archive_completion" BEFORE UPDATE ON "LeaseAgreement"
  FOR EACH ROW EXECUTE FUNCTION validate_archive_completion();
