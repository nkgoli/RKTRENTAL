-- CreateTable
CREATE TABLE "ApplicationInvitation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "applicantName" TEXT NOT NULL,
    "applicantEmail" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "requestKey" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "tokenCipher" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "generation" INTEGER NOT NULL DEFAULT 1,
    "draftName" TEXT,
    "draftSavedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "applicationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApplicationInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ApplicationInvitationAttempt" (
    "id" TEXT NOT NULL,
    "invitationId" TEXT NOT NULL,
    "generation" INTEGER NOT NULL,
    "requestKey" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "provider" TEXT,
    "providerId" TEXT,
    "errorCode" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "ApplicationInvitationAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationInvitation_tokenHash_key" ON "ApplicationInvitation"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationInvitation_applicationId_key" ON "ApplicationInvitation"("applicationId");

-- CreateIndex
CREATE INDEX "ApplicationInvitation_organizationId_createdAt_idx" ON "ApplicationInvitation"("organizationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationInvitation_id_organizationId_key" ON "ApplicationInvitation"("id", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationInvitation_organizationId_requestKey_key" ON "ApplicationInvitation"("organizationId", "requestKey");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationInvitation_organizationId_unitId_applicantEmail_key" ON "ApplicationInvitation"("organizationId", "unitId", "applicantEmail");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationInvitation_applicationId_organizationId_key" ON "ApplicationInvitation"("applicationId", "organizationId");

-- CreateIndex
CREATE INDEX "ApplicationInvitationAttempt_invitationId_createdAt_idx" ON "ApplicationInvitationAttempt"("invitationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ApplicationInvitationAttempt_invitationId_requestKey_key" ON "ApplicationInvitationAttempt"("invitationId", "requestKey");

-- AddForeignKey
ALTER TABLE "ApplicationInvitation" ADD CONSTRAINT "ApplicationInvitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationInvitation" ADD CONSTRAINT "ApplicationInvitation_unitId_organizationId_fkey" FOREIGN KEY ("unitId", "organizationId") REFERENCES "Unit"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationInvitation" ADD CONSTRAINT "ApplicationInvitation_applicationId_organizationId_fkey" FOREIGN KEY ("applicationId", "organizationId") REFERENCES "Application"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationInvitationAttempt" ADD CONSTRAINT "ApplicationInvitationAttempt_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "ApplicationInvitation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
