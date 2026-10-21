import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { PrismaClient, type User } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFRawStream, decodePDFRawStream } from 'pdf-lib';
import { db } from '@/lib/db/client';
import { createSessionToken, type AuthSession } from '@/lib/auth/session';
import { emptyDraft } from '@/lib/lease-create/types';
import {
  createLeaseFromWizard,
  createRenewalFromWizard,
  renewalDefaults,
} from '@/lib/lease-create/service';
import {
  getLeaseSignStatus,
  sendLeaseForSignature,
  SIGNATURE_CONSENT_VERSION,
  submitLeaseSignature,
} from '@/lib/esign/service';
import { archiveSignedAgreement, runLeaseArchiveSweep } from '@/lib/esign/archive';
import { buildLeasePdf } from '@/lib/esign/pdf';
import { sha256 } from '@/lib/esign/attachments';
import type { EsignEnvelope } from '@/lib/esign/types';
import * as storageConfig from '@/lib/storage/config';
import { createPrismaFileService } from '@/lib/storage/service';
import type { StorageAdapter, StorageObject } from '@/lib/storage/types';
import { GET as listFiles } from '@/app/api/files/route';
import { GET as previewFile } from '@/app/api/files/[id]/preview/route';
import { GET as downloadFile } from '@/app/api/files/[id]/download/route';

const cookie = vi.hoisted(() => ({ value: '' }));
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => (cookie.value ? { value: cookie.value } : undefined) }),
}));

/** Controlled storage faults with the real signing, Prisma and HTTP implementations. */
class FaultStorage implements StorageAdapter {
  readonly driver = 'integration-fault-storage';
  readonly objects = new Map<string, StorageObject>();
  readonly puts: string[] = [];
  readonly deletes: string[] = [];
  fault: 'none' | 'throw' | 'truncate' = 'none';

  async put(key: string, body: Uint8Array, contentType: string) {
    this.puts.push(key);
    if (key.endsWith('/lease.pdf') && this.fault === 'throw')
      throw new Error('Synthetic provider failure: do not expose this detail');
    this.objects.set(key, {
      body: body.slice(0, key.endsWith('/lease.pdf') && this.fault === 'truncate' ? 40 : undefined),
      contentType,
    });
  }
  async get(key: string) {
    const value = this.objects.get(key);
    return value ? { body: value.body.slice(), contentType: value.contentType } : null;
  }
  async delete(key: string) {
    this.deletes.push(key);
    this.objects.delete(key);
  }
  async getSignedUrl() {
    return null;
  }
}

async function embeddedSnapshot(bytes: Uint8Array) {
  const pdf = await PDFDocument.load(bytes);
  const names = pdf.catalog.lookup(PDFName.of('Names'), PDFDict);
  const files = names
    .lookup(PDFName.of('EmbeddedFiles'), PDFDict)
    .lookup(PDFName.of('Names'), PDFArray);
  const specification = files.lookup(1, PDFDict);
  const stream = specification
    .lookup(PDFName.of('EF'), PDFDict)
    .lookup(PDFName.of('F')) as PDFRawStream;
  return {
    pdf,
    snapshot: JSON.parse(new TextDecoder().decode(decodePDFRawStream(stream).decode())),
  };
}

describe.skipIf(process.env.RUN_DB_INTEGRATION !== '1')(
  'signed agreement archival and document access (real PostgreSQL)',
  () => {
    const client = new PrismaClient();
    let storage: FaultStorage;

    beforeAll(async () => {
      // This suite may create immutable records: never run against a non-disposable database.
      const rows =
        await client.$queryRawUnsafe<Array<{ data_directory: string }>>('SHOW data_directory');
      expect(resolve(rows[0].data_directory).toLowerCase()).toBe(
        resolve(process.env.ESIGN_TEST_DB_DIR ?? 'prisma/.local-postgres/signing').toLowerCase(),
      );
      vi.stubEnv('ROCKETRENTAL_AUTH_SECRET', 'disposable-archive-test-only-session-signing-secret');
    });
    beforeEach(() => {
      storage = new FaultStorage();
      vi.spyOn(storageConfig, 'getStorage').mockReturnValue(storage);
      cookie.value = '';
    });
    afterEach(() => vi.restoreAllMocks());
    afterAll(async () => {
      await client.$disconnect();
      await db.$disconnect();
      vi.unstubAllEnvs();
    });

    async function fixture(options: { unicode?: boolean; longTerms?: boolean } = {}) {
      const organizationId = `archive-${randomUUID()}`;
      await client.organization.create({
        data: { id: organizationId, name: 'Disposable archive test' },
      });
      const user = (role: 'OWNER' | 'TENANT' | 'MANAGER', name: string) =>
        client.user.create({
          data: { organizationId, role, name, email: `${randomUUID()}@example.com` },
        });
      const owner = await user('OWNER', options.unicode ? 'Zoë García' : 'Archive Owner');
      const manager = await user('MANAGER', 'Archive Manager');
      const otherOwner = await user('OWNER', 'Unrelated Owner');
      const tenants = await Promise.all(
        (options.unicode
          ? ['Renée Müller', '王小明']
          : ['Archive Tenant One', 'Archive Tenant Two']
        ).map(async (name) => {
          const account = await user('TENANT', name);
          const tenant = await client.tenant.create({
            data: { organizationId, userId: account.id, name, email: account.email },
          });
          return { account, tenant };
        }),
      );
      const unrelatedAccount = await user('TENANT', 'Unrelated Tenant');
      const unrelatedTenant = await client.tenant.create({
        data: {
          organizationId,
          userId: unrelatedAccount.id,
          name: unrelatedAccount.name,
          email: unrelatedAccount.email,
        },
      });
      const property = await client.property.create({
        data: {
          organizationId,
          ownerId: owner.id,
          name: 'Frozen Archive Home',
          type: 'MULTI_UNIT',
          street: '87 Original Avenue',
          city: 'Test City',
          state: 'CA',
          postalCode: '90001',
        },
      });
      const unit = await client.unit.create({
        data: { organizationId, propertyId: property.id, number: '21' },
      });
      const customClause = options.longTerms
        ? Array.from(
            { length: 70 },
            (_, index) =>
              `Clause ${index + 1}: Every agreed responsibility and exception remains visible in the signed agreement. The last paragraph must remain intact.`,
          ).join('\n') + '\nARCHIVE FINAL TERM SENTINEL'
        : 'Reviewed custom agreement clause.';
      const draft = emptyDraft({
        unitId: unit.id,
        tenantIds: tenants.map(({ tenant }) => tenant.id),
        primaryTenantId: tenants[0].tenant.id,
        startDate: '2070-01-01',
        endDate: '2070-12-31',
        monthlyRent: '1525',
        deposit: '1500',
        lessorName: owner.name,
        lessorEmail: owner.email,
        lessorAddress: '87 Original Avenue',
        customClause: 'Reviewed custom agreement clause.',
        customRules: 'Keep shared exits clear.',
        returnedPaymentFee: '35',
        keyFee: '20',
      });
      if (options.longTerms) {
        const defaultFees = { lateFee: '75', graceDays: 5, moveInFee: '0', petDeposit: '0' };
        const template = await client.leaseTemplate.create({
          data: {
            organizationId,
            name: 'Long agreement template',
            version: 1,
            defaultFees,
            items: {
              create: {
                section: 'CLAUSE',
                title: 'Complete reviewed responsibilities',
                body: customClause,
                sortOrder: 0,
                required: true,
                includeWhen: 'ALWAYS',
              },
            },
          },
          include: { items: true },
        });
        draft.template = {
          id: template.id,
          name: template.name,
          version: template.version,
          defaultFees,
          items: template.items.map((item) => ({
            ...item,
            section: 'CLAUSE' as const,
            order: item.sortOrder,
            includeWhen: 'ALWAYS' as const,
          })),
        };
      }
      const lease = await createLeaseFromWizard(organizationId, draft, 'ACTIVE', client);
      const session = (account: User, tenantId?: string): AuthSession => ({
        subjectId: account.id,
        organizationId,
        authVersion: account.updatedAt.getTime(),
        email: account.email,
        name: account.name,
        role: account.role,
        tenantId,
        issuedAt: Math.floor(Date.now() / 1000),
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
      });
      const ownerSession = session(owner);
      const tenantSessions = tenants.map(({ account, tenant }) => session(account, tenant.id));
      const fileService = await createPrismaFileService();
      const upload = async (
        name: string,
        kind: 'ADDENDUM' | 'LEASE' = 'ADDENDUM',
        leaseId = lease.id,
      ) => {
        const body = buildLeasePdf([
          `Original uploaded ${name}`,
          `Lease ${leaseId}`,
          'Original file bytes must be retained.',
        ]);
        const document = await fileService.upload(session(manager), {
          target: { kind: 'lease', id: leaseId },
          kind,
          fileName: name,
          mimeType: 'application/pdf',
          body,
        });
        return { document, body };
      };
      return {
        organizationId,
        owner,
        manager,
        otherOwner,
        tenants,
        property,
        unit,
        lease,
        draft,
        ownerSession,
        tenantSessions,
        session,
        fileService,
        upload,
        unrelatedSession: session(unrelatedAccount, unrelatedTenant.id),
        signers: [ownerSession, ...tenantSessions],
      };
    }
    type Fixture = Awaited<ReturnType<typeof fixture>>;
    const input = (agreement: EsignEnvelope, session: AuthSession) => ({
      agreementId: agreement.id,
      snapshotHash: agreement.snapshotHash!,
      fullName: session.name,
      email: session.email,
      phone: '+1 (415) 555-0123',
      consent: true,
      consentVersion: SIGNATURE_CONSENT_VERSION,
    });
    async function signAll(f: Fixture, leaseId = f.lease.id) {
      const sent = await sendLeaseForSignature(f.organizationId, leaseId, client);
      let result = sent;
      for (const session of f.signers)
        result = await submitLeaseSignature(session, leaseId, input(sent, session), client);
      return { sent, result };
    }
    const record = (id: string) =>
      client.leaseAgreement.findUniqueOrThrow({
        where: { id },
        include: { parties: { orderBy: { id: 'asc' } }, files: { include: { document: true } } },
      });
    const generated = (leaseId: string) =>
      client.document.findMany({
        where: { leaseId, agreementFiles: { some: { slot: 'LEASE' } } },
        orderBy: { createdAt: 'asc' },
      });

    it('archives only after the final signature, preserving separate addendums and a complete multilingual snapshot', async () => {
      const f = await fixture({ unicode: true, longTerms: true });
      const addendum = await f.upload('Pet care addendum.pdf');
      const sent = await sendLeaseForSignature(f.organizationId, f.lease.id, client);
      const charges = await client.charge.findMany({ where: { leaseId: f.lease.id } });
      expect(await archiveSignedAgreement(f.organizationId, sent.id, client)).toBe(
        'AWAITING_SIGNATURES',
      );
      for (const session of f.signers.slice(0, -1)) {
        expect(
          (await submitLeaseSignature(session, f.lease.id, input(sent, session), client)).status,
        ).toBe('PARTIALLY_SIGNED');
        expect(await generated(f.lease.id)).toHaveLength(0);
      }
      const finalSession = f.signers.at(-1)!;
      expect(
        await submitLeaseSignature(finalSession, f.lease.id, input(sent, finalSession), client),
      ).toMatchObject({
        status: 'SIGNED',
        archiveStatus: 'ARCHIVED',
      });
      const archived = await record(sent.id);
      expect(archived).toMatchObject({
        archiveStatus: 'ARCHIVED',
        archiveAttempts: 1,
        archiveLastError: null,
        archiveNextAttemptAt: null,
      });
      expect(archived.archivedAt).toBeInstanceOf(Date);
      expect(archived.files).toHaveLength(2);
      const main = archived.files.find((file) => file.slot === 'LEASE')!;
      expect(main.document).toMatchObject({
        name: 'Signed lease agreement - v1.pdf',
        kind: 'LEASE',
        leaseId: f.lease.id,
      });
      expect(archived.files.find((file) => file.slot.startsWith('ADDENDUM:'))).toMatchObject({
        documentId: addendum.document.id,
        sha256: sha256(addendum.body),
      });
      expect((await storage.get(addendum.document.storageKey))?.body).toEqual(addendum.body);
      const bytes = (await storage.get(main.document.storageKey))!.body;
      expect(sha256(bytes)).toBe(main.sha256);
      expect(Number(main.document.sizeBytes)).toBe(bytes.byteLength);
      const { pdf, snapshot } = await embeddedSnapshot(bytes);
      expect(pdf.getPageCount()).toBeGreaterThan(5);
      expect(snapshot).toEqual(archived.snapshot);
      expect(JSON.stringify(snapshot)).toContain('ARCHIVE FINAL TERM SENTINEL');
      for (const name of ['Zoë García', 'Renée Müller', '王小明'])
        expect(JSON.stringify(snapshot)).toContain(name);
      expect(
        archived.parties.every(
          (party) => party.fullName && party.phone && party.consent && party.signedAt,
        ),
      ).toBe(true);
      expect(await client.document.count({ where: { leaseId: f.lease.id } })).toBe(2);
      expect(await client.charge.findMany({ where: { leaseId: f.lease.id } })).toEqual(charges);
    }, 120000);

    it('archives actual Arabic, Hebrew and Devanagari signature names without changing their proof', async () => {
      const f = await fixture();
      const sent = await sendLeaseForSignature(f.organizationId, f.lease.id, client);
      const names = [
        '\u0645\u062d\u0645\u062f \u0633\u0639\u064a\u062f',
        '\u05d0\u05d1\u05d9\u05d2\u05d9\u05dc \u05db\u05d4\u05df',
        '\u0905\u0930\u094d\u091c\u0941\u0928 \u0915\u0941\u092e\u093e\u0930',
      ];
      for (const [index, session] of f.signers.entries())
        await submitLeaseSignature(
          session,
          f.lease.id,
          { ...input(sent, session), fullName: names[index] },
          client,
        );
      const stored = await record(sent.id);
      expect(stored.archiveStatus).toBe('ARCHIVED');
      expect(stored.parties.map((party) => party.fullName).sort()).toEqual([...names].sort());
      expect(await generated(f.lease.id)).toHaveLength(1);
    }, 120000);

    it('rejects unsupported PDF text before sending or committing an individual signature', async () => {
      const f = await fixture();
      const sent = await sendLeaseForSignature(f.organizationId, f.lease.id, client);
      await expect(
        submitLeaseSignature(
          f.ownerSession,
          f.lease.id,
          {
            ...input(sent, f.ownerSession),
            fullName: 'Unsupported \u{10FFFF}',
          },
          client,
        ),
      ).rejects.toMatchObject({ code: 'UNSUPPORTED_PDF_TEXT' });
      expect((await record(sent.id)).parties.every((party) => party.signedAt === null)).toBe(true);
      expect(await generated(f.lease.id)).toHaveLength(0);
      const newLease = await fixture();
      await client.property.update({
        where: { id: newLease.property.id },
        data: { name: 'Unsupported \u{10FFFF}' },
      });
      await expect(
        sendLeaseForSignature(newLease.organizationId, newLease.lease.id, client),
      ).rejects.toMatchObject({ code: 'UNSUPPORTED_PDF_TEXT' });
      expect(await client.leaseAgreement.count({ where: { leaseId: newLease.lease.id } })).toBe(0);
    });

    it('exposes superseded unsigned addendum versions separately from a new signing request', async () => {
      const f = await fixture();
      const addendum = await f.upload('Versioned addendum.pdf');
      const old = await sendLeaseForSignature(f.organizationId, f.lease.id, client);
      await submitLeaseSignature(f.ownerSession, f.lease.id, input(old, f.ownerSession), client);
      await client.lease.update({ where: { id: f.lease.id }, data: { monthlyRent: '1790' } });
      const current = await sendLeaseForSignature(f.organizationId, f.lease.id, client);
      cookie.value = await createSessionToken(f.ownerSession);
      const response = await listFiles(
        new Request(`https://rental.test/api/files?targetType=lease&targetId=${f.lease.id}`),
      );
      const files = (await response.json()).files;
      const refs = files.find(
        (file: { id: string }) => file.id === addendum.document.id,
      ).agreements;
      expect(refs).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            agreementId: old.id,
            signatureStatus: 'SUPERSEDED',
            supersededAt: expect.any(String),
          }),
          expect.objectContaining({
            agreementId: current.id,
            signatureStatus: 'AWAITING_SIGNATURES',
            supersededAt: null,
          }),
        ]),
      );
    });

    it('serializes concurrent final signatures, replay and workers without filename-based duplicates', async () => {
      const f = await fixture();
      const original = await f.upload('Signed lease agreement - v1.pdf', 'LEASE');
      const sent = await sendLeaseForSignature(f.organizationId, f.lease.id, client);
      await submitLeaseSignature(f.ownerSession, f.lease.id, input(sent, f.ownerSession), client);
      await Promise.all([
        ...[...f.tenantSessions, ...f.tenantSessions].map((session) =>
          submitLeaseSignature(session, f.lease.id, input(sent, session), client),
        ),
        archiveSignedAgreement(f.organizationId, sent.id, client),
        runLeaseArchiveSweep(f.organizationId, client),
      ]);
      await Promise.all([
        ...Array.from({ length: 4 }, () =>
          archiveSignedAgreement(f.organizationId, sent.id, client),
        ),
        runLeaseArchiveSweep(f.organizationId, client),
        submitLeaseSignature(f.ownerSession, f.lease.id, input(sent, f.ownerSession), client),
      ]);
      expect((await record(sent.id)).archiveStatus).toBe('ARCHIVED');
      expect(await generated(f.lease.id)).toHaveLength(1);
      expect(storage.puts.filter((key) => key.endsWith('/lease.pdf'))).toHaveLength(1);
      expect(
        await client.document.count({
          where: { leaseId: f.lease.id, name: original.document.name },
        }),
      ).toBe(2);
      expect((await storage.get(original.document.storageKey))?.body).toEqual(original.body);
      expect(
        await client.leaseEvent.count({ where: { leaseId: f.lease.id, kind: 'COMPLETED' } }),
      ).toBe(1);
      expect(
        await client.leaseEvent.count({ where: { leaseId: f.lease.id, kind: 'SIGNED' } }),
      ).toBe(3);
    }, 120000);

    it('keeps signatures committed on storage failure and automatically retries due work on a status request', async () => {
      const f = await fixture();
      storage.fault = 'throw';
      const { sent, result } = await signAll(f);
      expect(result).toMatchObject({ status: 'SIGNED', archiveStatus: 'PDF_FAILED' });
      const failed = await record(sent.id);
      expect(failed.parties.every((party) => party.signedAt)).toBe(true);
      expect(failed.archiveLastError).not.toContain('Synthetic provider');
      expect(failed.archiveNextAttemptAt).toBeInstanceOf(Date);
      expect(failed.archivedAt).toBeNull();
      expect(await generated(f.lease.id)).toHaveLength(0);
      expect(await archiveSignedAgreement(f.organizationId, sent.id, client)).toBe('PDF_FAILED');
      expect((await record(sent.id)).archiveAttempts).toBe(1);
      storage.fault = 'none';
      await client.leaseAgreement.update({
        where: { id: sent.id },
        data: { archiveNextAttemptAt: new Date(0) },
      });
      expect(await getLeaseSignStatus(f.organizationId, f.lease.id, client)).toMatchObject({
        status: 'SIGNED',
        archiveStatus: 'ARCHIVED',
      });
      const recovered = await record(sent.id);
      expect(recovered.parties).toEqual(failed.parties);
      expect(recovered.signedAt).toEqual(failed.signedAt);
      expect(recovered.archiveLastError).toBeNull();
      expect(recovered.archiveAttempts).toBe(2);
      expect(await generated(f.lease.id)).toHaveLength(1);
    }, 120000);

    it('rejects torn storage writes and repairs the stable object with a due job without another signature', async () => {
      const f = await fixture();
      storage.fault = 'truncate';
      const { sent, result } = await signAll(f);
      expect(result.archiveStatus).toBe('PDF_FAILED');
      const before = await record(sent.id);
      expect(await generated(f.lease.id)).toHaveLength(0);
      expect(before.files).toHaveLength(0);
      expect([...storage.objects.values()][0].body.byteLength).toBe(40);
      storage.fault = 'none';
      const now = new Date(before.archiveNextAttemptAt!.getTime() + 1);
      const results = await runLeaseArchiveSweep(f.organizationId, client, { storage, now });
      expect(results).toEqual([{ agreementId: sent.id, status: 'ARCHIVED' }]);
      const recovered = await record(sent.id);
      expect(recovered.parties).toEqual(before.parties);
      expect(recovered.signedAt).toEqual(before.signedAt);
      expect(await generated(f.lease.id)).toHaveLength(1);
      expect(new Set(storage.puts).size).toBe(1);
      expect(storage.objects.size).toBe(1);
      const main = recovered.files[0];
      expect(sha256((await storage.get(main.document.storageKey))!.body)).toBe(main.sha256);
    }, 120000);

    it('recovers an object written before a database rollback without duplicating the document or collecting signatures again', async () => {
      const f = await fixture();
      const sent = await sendLeaseForSignature(f.organizationId, f.lease.id, client);
      let rejectDocumentInsert = true;
      const rollbackClient = client.$extends({
        query: {
          document: {
            async create({ args, query }) {
              if (rejectDocumentInsert && args.data.storageKey.endsWith('/lease.pdf')) {
                rejectDocumentInsert = false;
                throw new Error(
                  'Synthetic transaction failure after successful storage verification',
                );
              }
              return query(args);
            },
          },
        },
      });
      for (const session of f.signers)
        await submitLeaseSignature(
          session,
          f.lease.id,
          input(sent, session),
          rollbackClient as unknown as PrismaClient,
        );
      const failed = await record(sent.id);
      expect(failed.archiveStatus).toBe('PDF_FAILED');
      expect(failed.files).toHaveLength(0);
      expect(await generated(f.lease.id)).toHaveLength(0);
      expect(storage.objects.size).toBe(1);
      const [orphanKey] = storage.objects.keys();
      const orphanBytes = (await storage.get(orphanKey))!.body;
      expect((await embeddedSnapshot(orphanBytes)).snapshot).toEqual(failed.snapshot);
      expect(
        await archiveSignedAgreement(f.organizationId, sent.id, client, {
          storage,
          now: new Date(failed.archiveNextAttemptAt!.getTime() + 1),
        }),
      ).toBe('ARCHIVED');
      const recovered = await record(sent.id);
      expect(recovered.parties).toEqual(failed.parties);
      expect(recovered.signedAt).toEqual(failed.signedAt);
      expect(recovered.files).toHaveLength(1);
      expect(recovered.files[0].document.storageKey).toBe(orphanKey);
      expect(await generated(f.lease.id)).toHaveLength(1);
      expect(storage.objects.size).toBe(1);
      expect(storage.puts).toEqual([orphanKey]);
      expect((await storage.get(orphanKey))!.body).toEqual(orphanBytes);
    }, 120000);

    it('archives the exact old signed version after live edits and retains both immutable version PDFs', async () => {
      const f = await fixture();
      await f.upload('Original agreement addendum.pdf');
      storage.fault = 'throw';
      const { sent } = await signAll(f);
      const frozen = await record(sent.id);
      await client.lease.update({ where: { id: f.lease.id }, data: { monthlyRent: '1925' } });
      await client.property.update({
        where: { id: f.property.id },
        data: { name: 'Revised Live Property' },
      });
      const extra = await f.upload('New version addendum.pdf');
      storage.fault = 'none';
      expect(
        await archiveSignedAgreement(f.organizationId, sent.id, client, {
          storage,
          now: new Date(frozen.archiveNextAttemptAt!.getTime() + 1),
        }),
      ).toBe('ARCHIVED');
      const first = await record(sent.id);
      const firstMain = first.files.find((file) => file.slot === 'LEASE')!;
      const firstBytes = (await storage.get(firstMain.document.storageKey))!.body;
      expect((await embeddedSnapshot(firstBytes)).snapshot).toEqual(frozen.snapshot);
      expect(first.parties).toEqual(frozen.parties);
      expect(JSON.stringify(first.snapshot)).toContain('Frozen Archive Home');
      expect(JSON.stringify(first.snapshot)).not.toContain('Revised Live Property');
      expect(first.files.some((file) => file.documentId === extra.document.id)).toBe(false);
      const next = await signAll(f);
      expect(next.result).toMatchObject({ version: 2, archiveStatus: 'ARCHIVED' });
      const second = await record(next.sent.id);
      expect(JSON.stringify(second.snapshot)).toContain('Revised Live Property');
      expect(second.files.some((file) => file.documentId === extra.document.id)).toBe(true);
      expect(await generated(f.lease.id)).toHaveLength(2);
      expect((await storage.get(firstMain.document.storageKey))!.body).toEqual(firstBytes);
      expect((await record(sent.id)).parties).toEqual(frozen.parties);
    }, 120000);

    it('creates a separate renewal PDF and addendum while retaining the prior lease, originals and ledger', async () => {
      const f = await fixture();
      const originalAddendum = await f.upload('Original parking addendum.pdf');
      const originalUpload = await f.upload('Original uploaded lease.pdf', 'LEASE');
      const { sent } = await signAll(f);
      const originalProof = await record(sent.id);
      const originalDocuments = await client.document.findMany({
        where: { leaseId: f.lease.id },
        orderBy: { id: 'asc' },
      });
      const source = await client.lease.findUniqueOrThrow({
        where: { id: f.lease.id },
        include: { tenants: true, charges: true },
      });
      const renewal = await createRenewalFromWizard(
        f.organizationId,
        f.lease.id,
        renewalDefaults(source),
        'ACTIVE',
        client,
      );
      const renewalAddendum = await f.upload(
        'Renewal parking addendum.pdf',
        'ADDENDUM',
        renewal.id,
      );
      const renewalCharges = await client.charge.findMany({ where: { leaseId: renewal.id } });
      const fresh = await signAll(f, renewal.id);
      expect(fresh.result).toMatchObject({ version: 1, archiveStatus: 'ARCHIVED' });
      expect(fresh.sent.id).not.toBe(sent.id);
      const renewalProof = await record(fresh.sent.id);
      expect(renewalProof.files).toHaveLength(2);
      expect(
        renewalProof.files.some((file) => file.documentId === renewalAddendum.document.id),
      ).toBe(true);
      expect(
        renewalProof.files.some((file) => file.documentId === originalAddendum.document.id),
      ).toBe(false);
      expect(JSON.stringify(renewalProof.snapshot)).toContain(f.lease.id);
      expect(await generated(renewal.id)).toHaveLength(1);
      expect(await generated(f.lease.id)).toHaveLength(1);
      expect(await record(sent.id)).toEqual(originalProof);
      expect(
        await client.document.findMany({ where: { leaseId: f.lease.id }, orderBy: { id: 'asc' } }),
      ).toEqual(originalDocuments);
      expect((await storage.get(originalUpload.document.storageKey))?.body).toEqual(
        originalUpload.body,
      );
      expect(await client.charge.findMany({ where: { leaseId: renewal.id } })).toEqual(
        renewalCharges,
      );
      expect(
        await client.lease.findUniqueOrThrow({
          where: { id: f.lease.id },
          include: { tenants: true, charges: true },
        }),
      ).toEqual(source);
    }, 120000);

    it('exposes truthful version links and enforces manager, owner, tenant and foreign list/preview/download access', async () => {
      const f = await fixture();
      const addendum = await f.upload('Access policy addendum.pdf');
      const original = await f.upload('Uploaded unverified lease.pdf', 'LEASE');
      const sent = await sendLeaseForSignature(f.organizationId, f.lease.id, client);
      const list = () =>
        listFiles(
          new Request(`https://rental.test/api/files?targetType=lease&targetId=${f.lease.id}`),
        );
      cookie.value = await createSessionToken(f.ownerSession);
      const before = await (await list()).json();
      expect(
        before.files.find((file: { id: string }) => file.id === addendum.document.id).agreements,
      ).toEqual([
        expect.objectContaining({
          agreementId: sent.id,
          version: 1,
          artifact: 'ADDENDUM',
          signatureStatus: 'AWAITING_SIGNATURES',
          signedAt: null,
        }),
      ]);
      await signAll(f);
      const main = (await generated(f.lease.id))[0];
      const expectedIds = [main.id, addendum.document.id, original.document.id].sort();
      for (const session of [f.session(f.manager), f.ownerSession, ...f.tenantSessions]) {
        cookie.value = await createSessionToken(session);
        const response = await list();
        expect(response.status).toBe(200);
        const listed = (await response.json()).files;
        expect(listed.map((file: { id: string }) => file.id).sort()).toEqual(expectedIds);
        expect(
          listed.find((file: { id: string }) => file.id === original.document.id).agreements,
        ).toEqual([]);
        expect(listed.find((file: { id: string }) => file.id === main.id).agreements).toEqual([
          expect.objectContaining({
            agreementId: sent.id,
            version: 1,
            artifact: 'LEASE',
            signatureStatus: 'SIGNED',
            archiveStatus: 'ARCHIVED',
          }),
        ]);
        expect(
          listed.find((file: { id: string }) => file.id === addendum.document.id).agreements,
        ).toEqual([
          expect.objectContaining({
            agreementId: sent.id,
            version: 1,
            artifact: 'ADDENDUM',
            signatureStatus: 'INCLUDED_IN_SIGNED_AGREEMENT',
            sha256: sha256(addendum.body),
          }),
        ]);
        for (const document of [main, addendum.document]) {
          for (const [handler, disposition] of [
            [previewFile, 'inline'],
            [downloadFile, 'attachment'],
          ] as const) {
            const response = await handler(
              new Request(`https://rental.test/api/files/${document.id}/${disposition}`),
              { params: Promise.resolve({ id: document.id }) },
            );
            expect(response.status).toBe(200);
            expect(response.headers.get('content-type')).toBe('application/pdf');
            expect(response.headers.get('content-disposition')).toContain(disposition);
            expect(response.headers.get('cache-control')).toContain('no-store');
            expect(response.headers.get('x-content-type-options')).toBe('nosniff');
            expect(new Uint8Array(await response.arrayBuffer())).toEqual(
              (await storage.get(document.storageKey))!.body,
            );
          }
        }
      }
      const foreign = await fixture();
      for (const session of [
        f.session(f.otherOwner),
        f.unrelatedSession,
        foreign.session(foreign.manager),
      ]) {
        cookie.value = await createSessionToken(session);
        expect((await list()).status).toBe(403);
        for (const handler of [previewFile, downloadFile]) {
          const denied = await handler(new Request('https://rental.test/api/files/private'), {
            params: Promise.resolve({ id: main.id }),
          });
          expect([403, 404]).toContain(denied.status);
        }
      }
      cookie.value = '';
      expect((await list()).status).toBe(401);
      expect(
        (
          await previewFile(new Request('https://rental.test/api/files/private'), {
            params: Promise.resolve({ id: main.id }),
          })
        ).status,
      ).toBe(401);
      for (const document of [main, addendum.document]) {
        await expect(f.fileService.delete(f.session(f.manager), document.id)).rejects.toMatchObject(
          { status: 403 },
        );
        await expect(client.document.delete({ where: { id: document.id } })).rejects.toThrow(
          'retained',
        );
        await expect(
          client.document.update({ where: { id: document.id }, data: { name: 'Replacement.pdf' } }),
        ).rejects.toThrow('immutable');
        expect(await storage.get(document.storageKey)).not.toBeNull();
      }
      expect(storage.deletes).toHaveLength(0);
      expect(await archiveSignedAgreement(foreign.organizationId, sent.id, client)).toBe(
        'AWAITING_SIGNATURES',
      );
      expect(
        await runLeaseArchiveSweep(foreign.organizationId, client, { leaseId: f.lease.id }),
      ).toEqual([]);
    }, 120000);

    it('does not claim completion with altered addendum bytes and recovers when the pinned original is restored', async () => {
      const f = await fixture();
      const addendum = await f.upload('Preserved original addendum.pdf');
      const sent = await sendLeaseForSignature(f.organizationId, f.lease.id, client);
      const pinned = await client.document.findUniqueOrThrow({
        where: { id: addendum.document.id },
      });
      const altered = addendum.body.slice();
      altered[altered.length - 2] ^= 1;
      storage.objects.set(pinned.storageKey, { body: altered, contentType: 'application/pdf' });
      for (const session of f.signers)
        await submitLeaseSignature(session, f.lease.id, input(sent, session), client);
      const failed = await record(sent.id);
      expect(failed.archiveStatus).toBe('PDF_FAILED');
      expect(await generated(f.lease.id)).toHaveLength(0);
      expect(storage.puts.filter((key) => key.endsWith('/lease.pdf'))).toHaveLength(0);
      storage.objects.set(pinned.storageKey, {
        body: addendum.body,
        contentType: 'application/pdf',
      });
      expect(
        await runLeaseArchiveSweep(f.organizationId, client, {
          now: new Date(failed.archiveNextAttemptAt!.getTime() + 1),
          storage,
        }),
      ).toEqual([{ agreementId: sent.id, status: 'ARCHIVED' }]);
      expect((await record(sent.id)).parties).toEqual(failed.parties);
      expect(await generated(f.lease.id)).toHaveLength(1);
      expect((await storage.get(pinned.storageKey))?.body).toEqual(addendum.body);
    }, 120000);

    it('pins addendum bytes outside the original upload key so an outstanding upload cannot replace reviewed content', async () => {
      const f = await fixture();
      const addendum = await f.upload('Pinned review addendum.pdf');
      const sent = await sendLeaseForSignature(f.organizationId, f.lease.id, client);
      const pinned = await client.document.findUniqueOrThrow({
        where: { id: addendum.document.id },
      });
      expect(pinned.storageKey).not.toBe(addendum.document.storageKey);
      expect(pinned.name).toBe(addendum.document.name);
      expect(pinned.contentSha256).toBe(sha256(addendum.body));
      await storage.put(
        addendum.document.storageKey,
        buildLeasePdf(['Unreviewed replacement content']),
        'application/pdf',
      );
      for (const session of f.signers)
        await submitLeaseSignature(session, f.lease.id, input(sent, session), client);
      expect((await record(sent.id)).archiveStatus).toBe('ARCHIVED');
      expect((await storage.get(pinned.storageKey))?.body).toEqual(addendum.body);
      expect((await f.fileService.download(f.tenantSessions[0], pinned.id)).body).toEqual(
        addendum.body,
      );
    }, 120000);
  },
);
