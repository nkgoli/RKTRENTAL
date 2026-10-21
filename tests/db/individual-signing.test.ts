import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { PrismaClient, type User } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { db } from '@/lib/db/client';
import { emptyDraft } from '@/lib/lease-create/types';
import {
  createLeaseFromWizard,
  createRenewalFromWizard,
  renewalDefaults,
} from '@/lib/lease-create/service';
import { terminateLease, updateLeaseTerms } from '@/lib/leases/service';
import { saveLeaseDraft, activateDraftLease } from '@/lib/lease-create/drafts';
import {
  completeMockSigning,
  getLeaseSignStatus,
  getSigningAgreement,
  handleEsignCallback,
  sendLeaseForSignature,
  SIGNATURE_CONSENT_VERSION,
  submitLeaseSignature,
} from '@/lib/esign/service';
import { createSessionToken, type AuthSession } from '@/lib/auth/session';
import { GET, POST } from '@/app/api/leases/[id]/signing/route';

const cookie = vi.hoisted(() => ({ value: '' }));
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => (cookie.value ? { value: cookie.value } : undefined) }),
}));

describe.skipIf(process.env.RUN_DB_INTEGRATION !== '1')(
  'durable authenticated individual lease signing (real PostgreSQL)',
  () => {
    const client = new PrismaClient();
    beforeAll(async () => {
      // Refuse to write fixtures anywhere except the explicitly designated disposable cluster.
      const rows =
        await client.$queryRawUnsafe<Array<{ data_directory: string }>>('SHOW data_directory');
      expect(resolve(rows[0].data_directory).toLowerCase()).toBe(
        resolve(process.env.ESIGN_TEST_DB_DIR ?? 'prisma/.local-postgres/signing').toLowerCase(),
      );
      vi.stubEnv('ROCKETRENTAL_AUTH_SECRET', 'disposable-test-only-session-signing-secret');
    });
    afterAll(async () => {
      await client.$disconnect();
      await db.$disconnect();
      vi.unstubAllEnvs();
    });

    async function fixture() {
      const organizationId = `signing-${randomUUID()}`;
      await client.organization.create({
        data: { id: organizationId, name: 'Disposable signing test' },
      });
      const user = async (role: 'OWNER' | 'TENANT' | 'MANAGER', name: string) =>
        client.user.create({
          data: {
            organizationId,
            role,
            name,
            email: `${name.replace(/ /g, '-').toLowerCase()}-${organizationId}@example.com`,
          },
        });
      const owner = await user('OWNER', 'Owner One');
      const manager = await user('MANAGER', 'Manager One');
      const otherOwner = await user('OWNER', 'Other Owner');
      const tenants = await Promise.all(
        ['Tenant One', 'Tenant Two'].map(async (name) => {
          const account = await user('TENANT', name);
          const tenant = await client.tenant.create({
            data: { organizationId, userId: account.id, name, email: account.email },
          });
          return { account, tenant };
        }),
      );
      const property = await client.property.create({
        data: {
          organizationId,
          ownerId: owner.id,
          name: 'Signing Home',
          type: 'MULTI_UNIT',
          street: '1 Test St',
          city: 'Test City',
          state: 'CA',
          postalCode: '90001',
        },
      });
      const unit = await client.unit.create({
        data: { organizationId, propertyId: property.id, number: '1' },
      });
      const draft = emptyDraft({
        unitId: unit.id,
        tenantIds: tenants.map(({ tenant }) => tenant.id),
        primaryTenantId: tenants[0].tenant.id,
        startDate: '2070-01-01',
        endDate: '2070-12-31',
        monthlyRent: '1500',
        deposit: '1500',
      });
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
      };
    }
    const input = (agreement: { id: string; snapshotHash?: string }, session: AuthSession) => ({
      agreementId: agreement.id,
      snapshotHash: agreement.snapshotHash!,
      fullName: session.name,
      email: session.email,
      phone: '+1 (415) 555-0123',
      consent: true,
      consentVersion: SIGNATURE_CONSENT_VERSION,
    });

    it('freezes owner plus two tenants, records each independently, serializes duplicates and concurrent signers without billing/PDF side effects', async () => {
      const f = await fixture();
      const charges = await client.charge.findMany({ where: { leaseId: f.lease.id } });
      const [sent, resend] = await Promise.all([
        sendLeaseForSignature(f.organizationId, f.lease.id, client),
        sendLeaseForSignature(f.organizationId, f.lease.id, client),
      ]);
      expect(resend.id).toBe(sent.id);
      expect(sent.status).toBe('SENT');
      expect(sent.signers.filter((s) => s.role === 'OWNER')).toHaveLength(1);
      expect(sent.signers.filter((s) => s.role === 'TENANT')).toHaveLength(2);
      const first = await submitLeaseSignature(
        f.tenantSessions[0],
        f.lease.id,
        input(sent, f.tenantSessions[0]),
        client,
      );
      expect(first.status).toBe('PARTIALLY_SIGNED');
      expect(first.signers.filter((s) => s.signedAt)).toHaveLength(1);
      await Promise.all(
        [f.ownerSession, f.tenantSessions[1], f.ownerSession, f.tenantSessions[0]].map((session) =>
          submitLeaseSignature(session, f.lease.id, input(sent, session), client),
        ),
      );
      const completed = await getLeaseSignStatus(f.organizationId, f.lease.id, client);
      expect(completed.status).toBe('SIGNED');
      expect(completed.archiveStatus).toBe('PDF_PENDING');
      const rows = await client.leaseAgreementParty.findMany({ where: { agreementId: sent.id } });
      expect(rows).toHaveLength(3);
      for (const row of rows) {
        expect(row).toMatchObject({
          consent: true,
          consentVersion: SIGNATURE_CONSENT_VERSION,
          phone: '+1 (415) 555-0123',
          authenticatedSubjectId: row.userId,
        });
        expect(row.fullName).toBeTruthy();
        expect(row.signedAt).toBeInstanceOf(Date);
        expect(row.authenticationVersion).toBeTypeOf('bigint');
      }
      expect(
        await client.leaseEvent.count({ where: { leaseId: f.lease.id, kind: 'SIGNED' } }),
      ).toBe(3);
      expect(
        await client.leaseEvent.count({ where: { leaseId: f.lease.id, kind: 'COMPLETED' } }),
      ).toBe(1);
      expect(await client.document.count({ where: { leaseId: f.lease.id } })).toBe(0);
      expect(await client.charge.findMany({ where: { leaseId: f.lease.id } })).toEqual(charges);
      expect((await sendLeaseForSignature(f.organizationId, f.lease.id, client)).id).toBe(sent.id);
      await expect(
        submitLeaseSignature(
          f.ownerSession,
          f.lease.id,
          { ...input(sent, f.ownerSession), fullName: 'Replacement Name' },
          client,
        ),
      ).rejects.toThrow('cannot be replaced');
      // Fresh Node process: no mock store or connection is reused.
      const observed = JSON.parse(
        execFileSync(
          process.execPath,
          [
            '--import',
            './prisma/os-userinfo.mjs',
            '--import',
            'tsx',
            'tests/db/signing-restart-probe.ts',
            f.organizationId,
            f.lease.id,
          ],
          { encoding: 'utf8' },
        ),
      );
      expect(observed).toMatchObject({
        id: sent.id,
        status: 'SIGNED',
        signedCount: 3,
        archiveStatus: 'PDF_PENDING',
      });
    }, 30000);

    it('enforces scope, explicit mappings, consent, contact validation and current authentication', async () => {
      const f = await fixture();
      const foreign = await fixture();
      const sent = await sendLeaseForSignature(f.organizationId, f.lease.id, client);
      for (const unauthorized of [
        foreign.ownerSession,
        f.session(f.otherOwner),
        f.session(f.manager),
        { ...f.tenantSessions[0], tenantId: f.tenants[1].tenant.id },
        { ...f.ownerSession, authVersion: 0 },
        { ...f.ownerSession, expiresAt: 1 },
      ]) {
        await expect(
          submitLeaseSignature(unauthorized, f.lease.id, input(sent, unauthorized), client),
        ).rejects.toMatchObject({ status: 404 });
      }
      for (const invalid of [
        { consent: false },
        { phone: '555' },
        { fullName: '' },
        { email: 'invalid' },
        { consentVersion: 'unknown' },
        { userId: f.owner.id },
        { signedAt: new Date().toISOString() },
      ]) {
        await expect(
          submitLeaseSignature(
            f.ownerSession,
            f.lease.id,
            { ...input(sent, f.ownerSession), ...invalid },
            client,
          ),
        ).rejects.toMatchObject({ status: 400 });
      }
      await expect(
        submitLeaseSignature(
          f.tenantSessions[0],
          f.lease.id,
          { ...input(sent, f.tenantSessions[0]), email: f.tenantSessions[1].email },
          client,
        ),
      ).rejects.toMatchObject({ status: 403 });
      await expect(
        getSigningAgreement(f.session(f.otherOwner), f.lease.id, client),
      ).rejects.toMatchObject({ status: 404 });
      await expect(
        getSigningAgreement(foreign.ownerSession, f.lease.id, client),
      ).rejects.toMatchObject({ status: 404 });
      expect(
        (await getSigningAgreement(f.ownerSession, f.lease.id, client)).myPartyId,
      ).toBeTruthy();
      expect(
        (await getSigningAgreement(f.session(f.manager), f.lease.id, client)).myPartyId,
      ).toBeNull();
      await client.tenant.update({ where: { id: f.tenants[0].tenant.id }, data: { userId: null } });
      await expect(sendLeaseForSignature(f.organizationId, f.lease.id, client)).rejects.toThrow(
        'tenant account',
      );
      await client.tenant.update({
        where: { id: f.tenants[0].tenant.id },
        data: { userId: f.tenants[0].account.id },
      });
      await client.user.create({
        data: {
          organizationId: foreign.organizationId,
          name: 'Ambiguous Owner',
          role: 'OWNER',
          email: f.owner.email.toUpperCase(),
        },
      });
      await expect(sendLeaseForSignature(f.organizationId, f.lease.id, client)).rejects.toThrow(
        'multiple accounts',
      );
      await client.property.update({ where: { id: f.property.id }, data: { ownerId: null } });
      await expect(sendLeaseForSignature(f.organizationId, f.lease.id, client)).rejects.toThrow(
        'owner/lessor',
      );
      expect(
        await client.leaseAgreementParty.count({
          where: { agreementId: sent.id, signedAt: { not: null } },
        }),
      ).toBe(0);
    }, 30000);

    it('invalidates edited terms, preserves old proof, and requires a fresh version even after reverting terms', async () => {
      const f = await fixture();
      const sent = await sendLeaseForSignature(f.organizationId, f.lease.id, client);
      await submitLeaseSignature(f.ownerSession, f.lease.id, input(sent, f.ownerSession), client);
      const before = await client.leaseAgreement.findUniqueOrThrow({
        where: { id: sent.id },
        include: { parties: true },
      });
      await updateLeaseTerms(
        f.organizationId,
        f.lease.id,
        {
          startDate: new Date('2070-01-01'),
          endDate: new Date('2070-12-31'),
          monthlyRent: '1600',
          deposit: '1500',
          lateFee: '75',
          graceDays: 5,
        },
        client,
      );
      expect((await getLeaseSignStatus(f.organizationId, f.lease.id, client)).status).toBe(
        'NOT_SENT',
      );
      await expect(
        submitLeaseSignature(
          f.tenantSessions[0],
          f.lease.id,
          input(sent, f.tenantSessions[0]),
          client,
        ),
      ).rejects.toMatchObject({ status: 409 });
      await client.lease.update({ where: { id: f.lease.id }, data: { monthlyRent: '1500' } });
      const next = await sendLeaseForSignature(f.organizationId, f.lease.id, client);
      expect(next.version).toBe(2);
      expect(next.id).not.toBe(sent.id);
      expect(next.snapshotHash).toBe(sent.snapshotHash);
      expect(next.signers.every((s) => !s.signedAt)).toBe(true);
      expect(
        (
          await client.leaseAgreement.findUniqueOrThrow({
            where: { id: sent.id },
            include: { parties: true },
          })
        ).snapshot,
      ).toEqual(before.snapshot);
      expect(
        await client.leaseAgreementParty.findMany({ where: { agreementId: sent.id } }),
      ).toEqual(before.parties);
      await expect(
        submitLeaseSignature(f.ownerSession, f.lease.id, input(sent, f.ownerSession), client),
      ).rejects.toMatchObject({ status: 409 });
      await expect(
        client.leaseAgreement.update({
          where: { id: sent.id },
          data: { snapshot: { replaced: true } },
        }),
      ).rejects.toThrow('immutable');
      await expect(
        client.leaseAgreementParty.update({
          where: { id: before.parties.find((p) => p.signedAt)!.id },
          data: { fullName: 'Changed' },
        }),
      ).rejects.toThrow('immutable');
      await expect(
        client.leaseAgreement.update({ where: { id: next.id }, data: { signedAt: new Date() } }),
      ).rejects.toThrow('individually');
      const unsignedParty = await client.leaseAgreementParty.findFirstOrThrow({
        where: { agreementId: next.id },
      });
      await expect(
        client.leaseAgreementParty.delete({ where: { id: unsignedParty.id } }),
      ).rejects.toThrow('immutable');
      await expect(
        client.leaseAgreementParty.create({
          data: {
            organizationId: f.organizationId,
            agreementId: next.id,
            role: 'TENANT',
            userId: f.manager.id,
            tenantId: f.tenants[0].tenant.id,
            expectedName: f.manager.name,
            expectedEmail: f.manager.email,
          },
        }),
      ).rejects.toThrow('immutable agreement snapshot');
      for (const session of [f.ownerSession, ...f.tenantSessions])
        await submitLeaseSignature(session, f.lease.id, input(next, session), client);
      const completed = await client.leaseAgreement.findUniqueOrThrow({
        where: { id: next.id },
        include: { parties: true },
      });
      await client.lease.update({ where: { id: f.lease.id }, data: { monthlyRent: '1700' } });
      const third = await sendLeaseForSignature(f.organizationId, f.lease.id, client);
      expect(third.version).toBe(3);
      expect(third.signers.every((party) => !party.signedAt)).toBe(true);
      const preserved = await client.leaseAgreement.findUniqueOrThrow({
        where: { id: next.id },
        include: { parties: true },
      });
      expect(preserved.parties).toEqual(completed.parties);
      expect(preserved.signedAt).toEqual(completed.signedAt);
    }, 30000);

    it('keeps signed originals, renewal history and ledger intact while renewal signers start unsigned', async () => {
      const f = await fixture();
      const sent = await sendLeaseForSignature(f.organizationId, f.lease.id, client);
      for (const session of [f.ownerSession, ...f.tenantSessions])
        await submitLeaseSignature(session, f.lease.id, input(sent, session), client);
      const original = await client.lease.findUniqueOrThrow({
        where: { id: f.lease.id },
        include: { tenants: true, charges: true },
      });
      const proof = await client.leaseAgreement.findUniqueOrThrow({
        where: { id: sent.id },
        include: { parties: { orderBy: { id: 'asc' } } },
      });
      const renewal = await createRenewalFromWizard(
        f.organizationId,
        f.lease.id,
        renewalDefaults(original),
        'ACTIVE',
        client,
      );
      const charges = await client.charge.findMany({ where: { leaseId: renewal.id } });
      const fresh = await sendLeaseForSignature(f.organizationId, renewal.id, client);
      expect(fresh.version).toBe(1);
      expect(fresh.status).toBe('SENT');
      expect(fresh.signers).toHaveLength(3);
      expect(fresh.signers.every((s) => !s.signedAt)).toBe(true);
      await sendLeaseForSignature(f.organizationId, renewal.id, client);
      expect(await client.charge.findMany({ where: { leaseId: renewal.id } })).toEqual(charges);
      expect(
        await client.leaseAgreement.findUniqueOrThrow({
          where: { id: sent.id },
          include: { parties: { orderBy: { id: 'asc' } } },
        }),
      ).toEqual(proof);
      expect(
        await client.lease.findUniqueOrThrow({
          where: { id: f.lease.id },
          include: { tenants: true, charges: true },
        }),
      ).toEqual(original);
      expect(
        await client.leaseEvent.count({ where: { leaseId: f.lease.id, kind: 'RENEWED' } }),
      ).toBe(1);
      expect(
        await client.leaseEvent.count({ where: { leaseId: renewal.id, kind: 'RENEWED' } }),
      ).toBe(1);
    }, 30000);

    it('retires every ordinary callback and mock completion path, including sandbox mode', async () => {
      const f = await fixture();
      const sent = await sendLeaseForSignature(f.organizationId, f.lease.id, client);
      vi.stubEnv('ROCKETRENTAL_SANDBOX', 'true');
      await expect(
        completeMockSigning(f.organizationId, f.ownerSession, f.lease.id, client),
      ).rejects.toMatchObject({ code: 'BULK_SIGNING_RETIRED' });
      await expect(
        handleEsignCallback(
          f.organizationId,
          f.ownerSession,
          { envelopeId: sent.id, event: 'signed' },
          client,
        ),
      ).rejects.toMatchObject({ code: 'BULK_SIGNING_RETIRED' });
      expect((await getLeaseSignStatus(f.organizationId, f.lease.id, client)).status).toBe('SENT');
    });

    it('preserves wizard wording and invalidates changed draft clauses and tenant rosters', async () => {
      const f = await fixture();
      const draft = {
        ...f.draft,
        startDate: '2071-01-01',
        endDate: '2071-12-31',
        lessorName: 'Lessor Company',
        lessorAddress: '1 Test St',
        lessorEmail: f.owner.email,
        customRules: 'Original custom rule.',
      };
      const saved = await saveLeaseDraft(
        f.organizationId,
        { draft, step: 9, nextStep: 9, strict: false },
        client,
      );
      if (!saved.ok) throw new Error('Draft fixture failed');
      const sent = await sendLeaseForSignature(f.organizationId, saved.leaseId, client);
      await submitLeaseSignature(
        f.ownerSession,
        saved.leaseId,
        input(sent, f.ownerSession),
        client,
      );
      await saveLeaseDraft(
        f.organizationId,
        {
          leaseId: saved.leaseId,
          draft: { ...draft, customRules: 'Revised custom rule.' },
          step: 9,
          nextStep: 9,
          strict: false,
        },
        client,
      );
      const next = await sendLeaseForSignature(f.organizationId, saved.leaseId, client);
      expect(next.version).toBe(2);
      expect(next.signers.every((p) => !p.signedAt)).toBe(true);
      const old = await client.leaseAgreement.findUniqueOrThrow({ where: { id: sent.id } });
      expect(JSON.stringify(old.snapshot)).toContain('Original custom rule.');
      expect(JSON.stringify(old.snapshot)).not.toContain('Revised custom rule.');
      await client.leaseTenant.delete({
        where: { leaseId_tenantId: { leaseId: saved.leaseId, tenantId: f.tenants[1].tenant.id } },
      });
      expect((await getLeaseSignStatus(f.organizationId, saved.leaseId, client)).status).toBe(
        'NOT_SENT',
      );
      const roster = await sendLeaseForSignature(f.organizationId, saved.leaseId, client);
      expect(roster.version).toBe(3);
      expect(roster.signers).toHaveLength(2);
      // Normal UI path: activation restores the submitted roster and keeps the full wizard.
      expect(
        await activateDraftLease(f.organizationId, saved.leaseId, draft, client),
      ).toMatchObject({ ok: true });
      const active = await sendLeaseForSignature(f.organizationId, saved.leaseId, client);
      expect(active.signers).toHaveLength(3);
      expect(active.signers.every((p) => !p.signedAt)).toBe(true);
    });

    it('rejects lessor/email ambiguity and revokes signing access after owner reassignment', async () => {
      const f = await fixture();
      const sent = await sendLeaseForSignature(f.organizationId, f.lease.id, client);
      await client.property.update({
        where: { id: f.property.id },
        data: { ownerId: f.otherOwner.id },
      });
      await expect(
        submitLeaseSignature(f.ownerSession, f.lease.id, input(sent, f.ownerSession), client),
      ).rejects.toMatchObject({ status: 404 });
      expect((await getLeaseSignStatus(f.organizationId, f.lease.id, client)).status).toBe(
        'NOT_SENT',
      );
      const changed = await sendLeaseForSignature(f.organizationId, f.lease.id, client);
      expect(changed.version).toBe(2);
      expect(changed.signers.find((s) => s.role === 'OWNER')?.email).toBe(f.otherOwner.email);
      const source = await client.lease.findUniqueOrThrow({ where: { id: f.lease.id } });
      await client.lease.update({
        where: { id: f.lease.id },
        data: {
          termsSnapshot: {
            ...(source.termsSnapshot as object),
            wizard: { lessorEmail: 'unmapped@example.com' },
          },
        },
      });
      await expect(sendLeaseForSignature(f.organizationId, f.lease.id, client)).rejects.toThrow(
        'lessor details',
      );
    });

    it('retains legacy signed leases without inventing signer proof and records termination without changing signed terms', async () => {
      const f = await fixture();
      const signedAt = new Date('2070-01-01');
      await client.lease.update({
        where: { id: f.lease.id },
        data: { eSignStatus: 'SIGNED', signedAt },
      });
      const legacy = await getLeaseSignStatus(f.organizationId, f.lease.id, client);
      expect(legacy).toMatchObject({
        status: 'SIGNED',
        signers: [],
        archiveStatus: 'LEGACY_UNKNOWN',
      });
      await expect(sendLeaseForSignature(f.organizationId, f.lease.id, client)).rejects.toThrow(
        'historical',
      );
      await expect(
        client.lease.update({ where: { id: f.lease.id }, data: { monthlyRent: 2000 } }),
      ).rejects.toThrow('Historical signed terms');
      await terminateLease(f.organizationId, f.lease.id, client, new Date('2070-06-01'));
      expect(await client.lease.findUniqueOrThrow({ where: { id: f.lease.id } })).toMatchObject({
        status: 'TERMINATED',
        eSignStatus: 'SIGNED',
        signedAt,
        endDate: new Date('2070-12-31'),
        moveOutDate: new Date('2070-06-01'),
      });
    });

    it('serializes competing replacements so exactly one submitted signature survives', async () => {
      const f = await fixture();
      const sent = await sendLeaseForSignature(f.organizationId, f.lease.id, client);
      const candidates = ['Owner Legal Name', 'Another Legal Name'].map((fullName) => ({
        ...input(sent, f.ownerSession),
        fullName,
      }));
      const results = await Promise.allSettled(
        candidates.map((candidate) =>
          submitLeaseSignature(f.ownerSession, f.lease.id, candidate, client),
        ),
      );
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
      expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
      const row = await client.leaseAgreementParty.findUniqueOrThrow({
        where: { agreementId_userId: { agreementId: sent.id, userId: f.owner.id } },
      });
      expect(candidates[results.findIndex((r) => r.status === 'fulfilled')].fullName).toBe(
        row.fullName,
      );
      expect(
        await client.leaseEvent.count({ where: { leaseId: f.lease.id, kind: 'SIGNED' } }),
      ).toBe(1);
    });

    it('uses signed session cookies in the real API, rejects CSRF/tampering, and grants owners only designated signing', async () => {
      const f = await fixture();
      const sent = await sendLeaseForSignature(f.organizationId, f.lease.id, client);
      const url = `https://rental.test/api/leases/${f.lease.id}/signing`;
      const context = { params: Promise.resolve({ id: f.lease.id }) };
      const post = (body: unknown, origin = 'https://rental.test') =>
        POST(
          new Request(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', origin },
            body: JSON.stringify(body),
          }),
          context,
        );
      cookie.value = '';
      expect((await GET(new Request(url), context)).status).toBe(401);
      cookie.value = await createSessionToken(f.ownerSession);
      const response = await GET(new Request(url), context);
      expect(response.status).toBe(200);
      expect(response.headers.get('cache-control')).toContain('no-store');
      expect(await response.json()).toMatchObject({
        id: sent.id,
        consentVersion: SIGNATURE_CONSENT_VERSION,
      });
      expect((await post(input(sent, f.ownerSession), 'https://attacker.test')).status).toBe(403);
      expect(
        (await post({ ...input(sent, f.ownerSession), signerId: f.tenants[0].account.id })).status,
      ).toBe(400);
      expect((await post(input(sent, f.ownerSession))).status).toBe(200);
      expect((await post(input(sent, f.ownerSession))).status).toBe(200);
      for (const tenantSession of f.tenantSessions) {
        cookie.value = await createSessionToken(tenantSession);
        expect((await GET(new Request(url), context)).status).toBe(200);
        expect((await post(input(sent, tenantSession))).status).toBe(200);
      }
      expect((await getLeaseSignStatus(f.organizationId, f.lease.id, client)).status).toBe(
        'SIGNED',
      );
      cookie.value = await createSessionToken(f.session(f.otherOwner));
      expect((await GET(new Request(url), context)).status).toBe(404);
      expect((await post(input(sent, f.session(f.otherOwner)))).status).toBe(404);
      cookie.value = `${cookie.value}tampered`;
      expect((await post(input(sent, f.ownerSession))).status).toBe(401);
      cookie.value = await createSessionToken(f.ownerSession);
      await client.user.update({ where: { id: f.owner.id }, data: { name: 'Updated Owner' } });
      expect((await post(input(sent, f.ownerSession))).status).toBe(401);
      expect(
        await client.leaseAgreementParty.count({
          where: { agreementId: sent.id, signedAt: { not: null } },
        }),
      ).toBe(3);
    }, 30000);
  },
);
