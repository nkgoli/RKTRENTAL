import { createHash } from 'node:crypto';
import { Prisma, type PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import type { AuthSession } from '@/lib/auth/session';
import type { FileActor } from '@/lib/storage/types';
import { recordLeaseEvents } from '@/lib/leases/events';
import {
  CLAUSE_OPTIONS,
  OPTION_CHOICES,
  RULE_OPTIONS,
  DISCLOSURE_OPTIONS,
  type ClauseOption,
} from '@/lib/lease-create/clauses';
import type { EsignCallbackPayload, EsignEnvelope } from './types';
import { EsignError } from './types';

export const SIGNED_LEASE_NAME = 'Signed lease agreement.pdf';
export const SIGNATURE_CONSENT_VERSION = 'lease-esign-v1';
export const SIGNATURE_CONSENT_TEXT =
  'I have reviewed this agreement and consent to sign it electronically. My typed full name is my signature on this agreement version.';

const emailSchema = z.string().trim().toLowerCase().email().max(254);
const signatureSchema = z
  .object({
    agreementId: z.string().min(1).max(200),
    snapshotHash: z.string().regex(/^[a-f0-9]{64}$/),
    fullName: z
      .string()
      .trim()
      .min(2)
      .max(200)
      .refine(
        (value) => /\p{L}/u.test(value) && !/[\x00-\x1f\x7f]/.test(value),
        'Enter your full name.',
      ),
    email: emailSchema,
    phone: z
      .string()
      .trim()
      .max(40)
      .refine(
        (value) => /^\+?[\d\s().-]+$/.test(value) && /^\d{7,15}$/.test(value.replace(/\D/g, '')),
        'Enter a valid phone number.',
      ),
    consent: z.literal(true),
    consentVersion: z.literal(SIGNATURE_CONSENT_VERSION),
  })
  .strict();
export type LeaseSignatureInput = z.infer<typeof signatureSchema>;

const include = { parties: { orderBy: { id: 'asc' as const } } };
type Agreement = Prisma.LeaseAgreementGetPayload<{ include: typeof include }>;
type Tx = Prisma.TransactionClient;
const denied = () =>
  new EsignError(
    'Signing agreement not found or unavailable.',
    undefined,
    404,
    'SIGNING_UNAVAILABLE',
  );
const conflict = (message: string) => new EsignError(message, undefined, 409, 'AGREEMENT_CONFLICT');

/** Stable serialization survives JSONB object key ordering and process restarts. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.entries(value)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`)
      .join(',')}}`;
  return JSON.stringify(value);
}

async function transaction<T>(client: PrismaClient, run: (tx: Tx) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await client.$transaction(run, {
        isolationLevel: 'Serializable',
        maxWait: 10000,
        timeout: 20000,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        attempt < 4 &&
        (error.code === 'P2034' ||
          (error.code === 'P2010' && ['40001', '40P01'].includes(String(error.meta?.code))))
      )
        continue;
      throw error;
    }
  }
}

async function lockLease(tx: Tx, organizationId: string, leaseId: string) {
  // Shared with database invalidation triggers; serializes sends, signatures and term edits.
  await tx.$queryRaw`SELECT "id" FROM "Lease" WHERE "id" = ${leaseId} AND "organizationId" = ${organizationId} FOR UPDATE`;
  const lease = await tx.lease.findFirst({
    where: { id: leaseId, organizationId },
    include: {
      unit: { include: { property: { include: { owner: true } } } },
      tenants: { include: { tenant: { include: { user: true } } }, orderBy: { tenantId: 'asc' } },
      draft: true,
    },
  });
  if (!lease) throw denied();
  return lease;
}
type Lease = Awaited<ReturnType<typeof lockLease>>;

async function agreementSource(tx: Tx, lease: Lease) {
  const owner = lease.unit.property.owner;
  if (!owner || !['OWNER', 'MANAGER'].includes(owner.role))
    throw new EsignError(
      'Assign an owner/lessor account to this property before sending.',
      'lessorName',
    );
  if (!lease.tenants.length) throw new EsignError('At least one tenant is required.', 'tenantIds');
  const storedDraft = lease.draft?.data as
    { draft?: Prisma.JsonValue; renewId?: string } | undefined;
  const storedTerms = lease.termsSnapshot as {
    wizard?: Prisma.JsonValue;
    renewsLeaseId?: string;
  } | null;
  const wizard = storedDraft?.draft ?? storedTerms?.wizard ?? null;
  const lessor = wizard as { lessorName?: string; lessorEmail?: string } | null;
  const selections = wizard as {
    clauses?: string[];
    options?: string[];
    rules?: string[];
    disclosures?: string[];
  } | null;
  const selectedText = (choices: ClauseOption[], ids: unknown) =>
    choices.filter((choice) => Array.isArray(ids) && ids.includes(choice.id));
  if (
    lessor?.lessorEmail &&
    lessor.lessorEmail.trim().toLowerCase() !== owner.email.trim().toLowerCase()
  )
    throw new EsignError(
      'The lessor details must match the designated property owner account. Reconcile them before sending.',
      'lessorName',
    );
  const parties = [
    {
      role: 'OWNER',
      userId: owner.id,
      tenantId: null,
      expectedName: owner.name,
      expectedEmail: owner.email.trim().toLowerCase(),
    },
    ...lease.tenants.map(({ tenant }) => {
      if (
        !tenant.user ||
        tenant.user.role !== 'TENANT' ||
        tenant.user.organizationId !== lease.organizationId
      )
        throw new EsignError(
          `Link ${tenant.name} to their tenant account before sending.`,
          'tenantIds',
        );
      if (tenant.email?.trim().toLowerCase() !== tenant.user.email.trim().toLowerCase())
        throw new EsignError(
          `Reconcile the email and account for ${tenant.name} before sending.`,
          'tenantIds',
        );
      return {
        role: 'TENANT',
        userId: tenant.user.id,
        tenantId: tenant.id,
        expectedName: tenant.name,
        expectedEmail: tenant.user.email.trim().toLowerCase(),
      };
    }),
  ];
  if (
    new Set(parties.map((party) => party.userId)).size !== parties.length ||
    new Set(parties.map((party) => party.expectedEmail)).size !== parties.length
  )
    throw new EsignError('Each required party must have a distinct account and email.');
  for (const party of parties) {
    if (!emailSchema.safeParse(party.expectedEmail).success)
      throw new EsignError('Every signing account needs a valid email.');
    // Login resolves email globally; never silently pick one case-insensitive match.
    if (
      (await tx.user.count({
        where: { email: { equals: party.expectedEmail, mode: 'insensitive' } },
      })) !== 1
    )
      throw new EsignError(
        'A signing email resolves to multiple accounts. Reconcile the accounts before sending.',
      );
  }
  const property = lease.unit.property;
  const snapshot = {
    schemaVersion: 1,
    organizationId: lease.organizationId,
    leaseId: lease.id,
    property: {
      id: property.id,
      name: property.name,
      street: property.street,
      city: property.city,
      state: property.state,
      postalCode: property.postalCode,
    },
    unit: { id: lease.unitId, number: lease.unit.number },
    lessor: {
      name: lessor?.lessorName || owner.name,
      signingUserId: owner.id,
      signingName: owner.name,
      email: owner.email.trim().toLowerCase(),
    },
    startDate: lease.startDate.toISOString(),
    endDate: lease.endDate.toISOString(),
    monthlyRent: lease.monthlyRent.toString(),
    deposit: lease.deposit.toString(),
    lateFee: lease.lateFee.toString(),
    graceDays: lease.graceDays,
    rentDueDay: lease.rentDueDay,
    prorateFirstMonth: lease.prorateFirstMonth,
    moveInFee: lease.moveInFee.toString(),
    petDeposit: lease.petDeposit.toString(),
    occupants: lease.occupants,
    templateId: lease.templateId,
    templateVersion: lease.templateVersion,
    termsSnapshot: lease.termsSnapshot,
    wizard,
    renewsLeaseId: storedDraft?.renewId ?? storedTerms?.renewsLeaseId ?? null,
    selectedText: {
      clauses: selectedText(CLAUSE_OPTIONS, selections?.clauses),
      options: selectedText(OPTION_CHOICES, selections?.options),
      rules: selectedText(RULE_OPTIONS, selections?.rules),
      disclosures: selectedText(DISCLOSURE_OPTIONS, selections?.disclosures),
    },
    parties,
    consentVersion: SIGNATURE_CONSENT_VERSION,
    consentText: SIGNATURE_CONSENT_TEXT,
  };
  return {
    parties,
    snapshot,
    snapshotHash: createHash('sha256').update(canonical(snapshot)).digest('hex'),
  };
}

function envelope(agreement: Agreement): EsignEnvelope {
  const signedCount = agreement.parties.filter((party) => party.signedAt).length;
  return {
    id: agreement.id,
    provider: 'internal',
    leaseId: agreement.leaseId,
    version: agreement.version,
    snapshotHash: agreement.snapshotHash,
    archiveStatus: agreement.archiveStatus,
    status: agreement.supersededAt
      ? 'NOT_SENT'
      : agreement.signedAt
        ? 'SIGNED'
        : signedCount
          ? 'PARTIALLY_SIGNED'
          : 'SENT',
    signers: agreement.parties.map((party) => ({
      id: party.id,
      name: party.expectedName,
      email: party.expectedEmail,
      role: party.role as 'OWNER' | 'TENANT',
      signedAt: party.signedAt?.toISOString() ?? null,
    })),
    sentAt: agreement.createdAt.toISOString(),
    signedAt: agreement.signedAt?.toISOString() ?? null,
  };
}
const latestAgreement = (tx: Tx, organizationId: string, leaseId: string) =>
  tx.leaseAgreement.findFirst({
    where: { organizationId, leaseId },
    orderBy: { version: 'desc' },
    include,
  });

/** Trusted manager-service compatibility entry point. HTTP callers must use the authenticated API. */
export async function sendLeaseForSignature(
  organizationId: string,
  leaseId: string,
  client: PrismaClient = db,
): Promise<EsignEnvelope> {
  return transaction(client, async (tx) => {
    const lease = await lockLease(tx, organizationId, leaseId);
    if (!['DRAFT', 'ACTIVE'].includes(lease.status))
      throw conflict('This lease is no longer open for signing.');
    const previous = await latestAgreement(tx, organizationId, leaseId);
    // Never fabricate individual proof for a historical, already-signed lease.
    if (!previous && lease.eSignStatus === 'SIGNED')
      throw conflict(
        'This historical signed lease has no individual signing record. Create a renewal or amendment.',
      );
    const source = await agreementSource(tx, lease);
    if (previous && !previous.supersededAt && previous.snapshotHash === source.snapshotHash)
      return envelope(previous);
    if (previous && !previous.supersededAt)
      await tx.leaseAgreement.update({
        where: { id: previous.id },
        data: { supersededAt: new Date() },
      });
    const created = await tx.leaseAgreement.create({
      data: {
        organizationId,
        leaseId,
        version: (previous?.version ?? 0) + 1,
        snapshot: source.snapshot,
        snapshotHash: source.snapshotHash,
        parties: { create: source.parties },
      },
      include,
    });
    await tx.lease.update({
      where: { id: leaseId },
      data: { eSignStatus: 'SENT', signedAt: null },
    });
    await recordLeaseEvents(
      tx,
      organizationId,
      leaseId,
      source.parties.map((party) => ({
        kind: 'SENT',
        tenantId: party.tenantId,
        message: `Agreement v${created.version} sent to ${party.expectedEmail}`,
      })),
    );
    return envelope(created);
  });
}

/** Trusted organization-scoped manager read, retained for existing callers. */
export async function getLeaseSignStatus(
  organizationId: string,
  leaseId: string,
  client: PrismaClient = db,
): Promise<EsignEnvelope> {
  return transaction(client, async (tx) => {
    const lease = await lockLease(tx, organizationId, leaseId);
    const agreement = await latestAgreement(tx, organizationId, leaseId);
    if (agreement) {
      let current = !agreement.supersededAt;
      try {
        current =
          current && (await agreementSource(tx, lease)).snapshotHash === agreement.snapshotHash;
      } catch (error) {
        if (!(error instanceof EsignError)) throw error;
        current = false;
      }
      return { ...envelope(agreement), ...(!current ? { status: 'NOT_SENT' as const } : {}) };
    }
    return {
      id: '',
      provider: 'internal',
      leaseId,
      status: lease.eSignStatus,
      signers: [],
      sentAt: null,
      signedAt: lease.signedAt?.toISOString() ?? null,
      archiveStatus: 'LEGACY_UNKNOWN',
    };
  });
}

async function currentUser(tx: Tx, session: AuthSession) {
  if (!session || session.expiresAt <= Date.now() / 1000) throw denied();
  const user = await tx.user.findFirst({
    where: { id: session.subjectId, organizationId: session.organizationId },
    include: { tenant: true },
  });
  if (
    !user ||
    user.updatedAt.getTime() !== session.authVersion ||
    user.role !== session.role ||
    (user.role === 'TENANT' && user.tenant?.id !== session.tenantId)
  )
    throw denied();
  return user;
}

async function accessibleAgreement(
  tx: Tx,
  session: AuthSession,
  leaseId: string,
  forSigning: boolean,
) {
  const user = await currentUser(tx, session);
  const lease = await lockLease(tx, session.organizationId, leaseId);
  const agreement = await latestAgreement(tx, session.organizationId, leaseId);
  if (!agreement) throw denied();
  const party = agreement.parties.find((candidate) => candidate.userId === user.id);
  if (!party && (forSigning || user.role !== 'MANAGER')) throw denied();
  if (
    party &&
    ((party.role === 'OWNER' &&
      (lease.unit.property.ownerId !== user.id || !['OWNER', 'MANAGER'].includes(user.role))) ||
      (party.role === 'TENANT' &&
        (user.role !== 'TENANT' ||
          user.tenant?.id !== party.tenantId ||
          !lease.tenants.some(({ tenantId }) => tenantId === party.tenantId))))
  )
    throw denied();
  if (agreement.supersededAt)
    throw conflict('The agreement changed. Ask the manager to send a new version.');
  const source = await agreementSource(tx, lease);
  if (source.snapshotHash !== agreement.snapshotHash)
    throw conflict(
      'The agreement or signer identities changed. Ask the manager to send a new version.',
    );
  return { user, lease, agreement, party };
}

/** Narrow signing access for the designated lessor and tenants; no general owner permissions. */
export async function getSigningAgreement(
  session: AuthSession,
  leaseId: string,
  client: PrismaClient = db,
) {
  return transaction(client, async (tx) => {
    const { agreement, party } = await accessibleAgreement(tx, session, leaseId, false);
    return {
      ...envelope(agreement),
      snapshot: agreement.snapshot,
      myPartyId: party?.id ?? null,
      consentVersion: SIGNATURE_CONSENT_VERSION,
      consentText: SIGNATURE_CONSENT_TEXT,
    };
  });
}

/** The session comes from getSession(), never from JSON. Identity and timestamp are server-owned. */
export async function submitLeaseSignature(
  session: AuthSession,
  leaseId: string,
  input: unknown,
  client: PrismaClient = db,
): Promise<EsignEnvelope> {
  const parsed = signatureSchema.safeParse(input);
  if (!parsed.success)
    throw new EsignError(
      parsed.error.issues[0]?.message ?? 'Invalid signature.',
      parsed.error.issues[0]?.path.join('.'),
    );
  const value = parsed.data;
  return transaction(client, async (tx) => {
    const { user, lease, agreement, party } = await accessibleAgreement(tx, session, leaseId, true);
    if (!party) throw denied();
    if (!['DRAFT', 'ACTIVE'].includes(lease.status))
      throw conflict('This lease is no longer open for signing.');
    if (agreement.id !== value.agreementId || agreement.snapshotHash !== value.snapshotHash)
      throw conflict('Review the current agreement before signing.');
    if (value.email !== party.expectedEmail || value.email !== user.email.trim().toLowerCase())
      throw new EsignError(
        'Use the email of your designated signing account.',
        'email',
        403,
        'SIGNER_MISMATCH',
      );
    if (party.signedAt) {
      if (
        party.fullName !== value.fullName ||
        party.email !== value.email ||
        party.phone !== value.phone ||
        party.consentVersion !== value.consentVersion
      )
        throw conflict('Your recorded signature cannot be replaced.');
      return envelope(agreement);
    }
    const signedAt = new Date();
    await tx.leaseAgreementParty.update({
      where: { id: party.id },
      data: {
        fullName: value.fullName,
        email: value.email,
        phone: value.phone,
        consent: true,
        consentVersion: value.consentVersion,
        signedAt,
        authenticatedSubjectId: user.id,
        authenticatedEmail: user.email,
        authenticationVersion: BigInt(session.authVersion),
        sessionIssuedAt: session.issuedAt,
      },
    });
    const allSigned = agreement.parties.every(
      (candidate) => candidate.id === party.id || candidate.signedAt,
    );
    await tx.lease.update({
      where: { id: leaseId },
      data: {
        eSignStatus: allSigned ? 'SIGNED' : 'PARTIALLY_SIGNED',
        signedAt: allSigned ? signedAt : null,
      },
    });
    if (allSigned)
      await tx.leaseAgreement.update({
        where: { id: agreement.id },
        data: { signedAt, archiveStatus: 'PDF_PENDING' },
      });
    await recordLeaseEvents(tx, session.organizationId, leaseId, [
      {
        kind: 'SIGNED',
        tenantId: party.tenantId,
        actorName: value.fullName,
        createdAt: signedAt,
        message: `Agreement v${agreement.version}; party ${party.id}`,
      },
      ...(allSigned
        ? [
            {
              kind: 'COMPLETED' as const,
              createdAt: signedAt,
              message: `Agreement v${agreement.version}: all signatures recorded; PDF pending`,
            },
          ]
        : []),
    ]);
    return envelope(
      await tx.leaseAgreement.findUniqueOrThrow({ where: { id: agreement.id }, include }),
    );
  });
}

/** Retired compatibility entry points: callbacks cannot attest to individual consent or identity. */
export async function handleEsignCallback(
  _organizationId: string,
  _actor: FileActor,
  _payload: EsignCallbackPayload,
  _client: PrismaClient = db,
): Promise<EsignEnvelope> {
  void _client;
  throw new EsignError(
    'Each designated party must sign separately through their authenticated signing account.',
    undefined,
    410,
    'BULK_SIGNING_RETIRED',
  );
}
export async function completeMockSigning(
  _organizationId: string,
  _actor: FileActor,
  _leaseId: string,
  _client: PrismaClient = db,
): Promise<EsignEnvelope> {
  void _client;
  throw new EsignError(
    'Each designated party must sign separately through their authenticated signing account.',
    undefined,
    410,
    'BULK_SIGNING_RETIRED',
  );
}
