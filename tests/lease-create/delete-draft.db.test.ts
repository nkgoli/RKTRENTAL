import { createHash, randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Prisma, PrismaClient } from '@prisma/client';
import { deleteLeaseDraft, draftRenewalSources } from '@/lib/lease-create/delete-draft';
import { saveLeaseDraft } from '@/lib/lease-create/drafts';
import { STEP, emptyDraft } from '@/lib/lease-create/types';
import { withResolvedEnd } from '@/lib/lease-create/validation';
import { activateLease, LeaseServiceError } from '@/lib/leases/service';

// Synthetic organizations only: RUN_DB_INTEGRATION=1 DATABASE_URL=... npx vitest run tests/lease-create
const live = process.env.RUN_DB_INTEGRATION === '1' && Boolean(process.env.DATABASE_URL);

describe.skipIf(!live)('draft lease deletion (database)', () => {
  const db = new PrismaClient();
  const suffix = randomUUID().slice(0, 8);
  const org = `test-draft-delete-${suffix}`;
  const otherOrg = `test-draft-delete-other-${suffix}`;
  const property = `test-dd-property-${suffix}`;
  const units = [1, 2, 3, 4, 5, 6].map((n) => `test-dd-unit-${n}-${suffix}`);
  const tenant = `test-dd-tenant-${suffix}`;
  const hash = (label: string) =>
    createHash('sha256')
      .update(label + suffix)
      .digest('hex');
  const removed: string[] = [];
  const removeBytes = async (key: string) => {
    removed.push(key);
  };

  beforeAll(async () => {
    await db.organization.createMany({
      data: [
        { id: org, name: 'Synthetic Draft Delete Org' },
        { id: otherOrg, name: 'Synthetic Other Org' },
      ],
    });
    await db.property.create({
      data: {
        id: property,
        organizationId: org,
        name: 'Synthetic Fixture Court',
        type: 'MULTI_UNIT',
        street: '1 Fixture Way',
        city: 'Austin',
        state: 'TX',
        postalCode: '78701',
      },
    });
    await db.unit.createMany({
      data: units.map((id, i) => ({
        id,
        organizationId: org,
        propertyId: property,
        number: `D${i + 1}`,
      })),
    });
    await db.tenant.create({
      data: {
        id: tenant,
        organizationId: org,
        name: 'Synthetic Tenant',
        email: `dd-${suffix}@example.test`,
      },
    });
  });

  afterAll(async () => {
    const leases = await db.lease.findMany({
      where: { organizationId: org },
      select: { id: true },
    });
    const ids = leases.map((l) => l.id);
    await db.leaseAgreement.deleteMany({ where: { leaseId: { in: ids } } });
    await db.payment.deleteMany({ where: { organizationId: org } });
    await db.charge.deleteMany({ where: { organizationId: org } });
    await db.document.deleteMany({ where: { organizationId: org } });
    await db.lease.deleteMany({ where: { organizationId: org } });
    await db.tenant.deleteMany({ where: { organizationId: org } });
    await db.unit.deleteMany({ where: { organizationId: org } });
    await db.property.deleteMany({ where: { organizationId: org } });
    await db.organization.deleteMany({ where: { id: { in: [org, otherOrg] } } });
    await db.$disconnect();
  });

  const draft = (unitId: string, startDate = '2031-03-01') =>
    withResolvedEnd(
      emptyDraft({
        unitId,
        startDate,
        monthlyRent: '1500',
        deposit: '1500',
        tenantIds: [tenant],
        primaryTenantId: tenant,
        lessorName: 'Synthetic Holdings',
        lessorAddress: '1 Fixture Way',
      }),
    );

  async function wizardDraft(unitId: string, renewId?: string, startDate?: string) {
    const saved = await saveLeaseDraft(
      org,
      {
        renewId,
        step: STEP.term,
        nextStep: STEP.rent,
        draft: draft(unitId, startDate),
        strict: false,
      },
      db,
    );
    if (!saved.ok) throw new Error(JSON.stringify(saved.errors));
    return saved.leaseId;
  }

  async function lease(unitId: string, data: Partial<Prisma.LeaseUncheckedCreateInput> = {}) {
    return (
      await db.lease.create({
        data: {
          organizationId: org,
          unitId,
          startDate: new Date('2030-01-01T00:00:00Z'),
          endDate: new Date('2030-12-31T00:00:00Z'),
          monthlyRent: '1500.00',
          deposit: '1500.00',
          status: 'DRAFT',
          ...data,
        },
        select: { id: true },
      })
    ).id;
  }

  it('deletes an ordinary draft with its wizard state, tenant links, events and own files only', async () => {
    const id = await wizardDraft(units[0]);
    const storageKey = `synthetic/${suffix}/draft-upload.pdf`;
    await db.document.create({
      data: {
        organizationId: org,
        leaseId: id,
        kind: 'LEASE',
        name: 'Synthetic upload.pdf',
        storageKey,
        sizeBytes: 10,
        mimeType: 'application/pdf',
      },
    });
    expect(await db.leaseDraft.count({ where: { leaseId: id } })).toBe(1);
    expect(await db.leaseEvent.count({ where: { leaseId: id } })).toBeGreaterThan(0);

    const result = await deleteLeaseDraft(org, id, db, removeBytes);
    expect(result).toEqual({
      ok: true,
      leaseId: id,
      propertyId: property,
      unitId: units[0],
      removedFiles: 1,
    });
    expect(await db.lease.count({ where: { id } })).toBe(0);
    expect(await db.leaseDraft.count({ where: { leaseId: id } })).toBe(0);
    expect(await db.leaseTenant.count({ where: { leaseId: id } })).toBe(0);
    expect(await db.leaseEvent.count({ where: { leaseId: id } })).toBe(0);
    expect(await db.document.count({ where: { storageKey } })).toBe(0);
    expect(removed).toContain(storageKey);
    // The tenant, unit and property are untouched.
    expect(await db.tenant.count({ where: { id: tenant } })).toBe(1);
    expect(await db.unit.findUniqueOrThrow({ where: { id: units[0] } })).toMatchObject({
      status: 'VACANT',
    });

    // A repeated request is a harmless no-op.
    expect(await deleteLeaseDraft(org, id, db, removeBytes)).toMatchObject({
      ok: false,
      reason: 'not-found',
    });
  });

  it('refuses another organization and leaves the draft in place', async () => {
    const id = await wizardDraft(units[1]);
    expect(await deleteLeaseDraft(otherOrg, id, db, removeBytes)).toMatchObject({
      ok: false,
      reason: 'not-found',
    });
    expect(await deleteLeaseDraft('', id, db, removeBytes)).toMatchObject({
      ok: false,
      reason: 'not-found',
    });
    expect(await db.lease.findUniqueOrThrow({ where: { id } })).toMatchObject({ status: 'DRAFT' });
    expect(await deleteLeaseDraft(org, id, db, removeBytes)).toMatchObject({ ok: true });
  });

  it('deletes a renewal draft and keeps the source lease, its ledger and its history intact', async () => {
    const source = await lease(units[2], {
      status: 'ACTIVE',
      eSignStatus: 'SIGNED',
      signedAt: new Date(),
    });
    await db.leaseTenant.create({
      data: { organizationId: org, leaseId: source, tenantId: tenant, isPrimary: true },
    });
    const charge = await db.charge.create({
      data: {
        organizationId: org,
        leaseId: source,
        kind: 'RENT',
        amount: '1500.00',
        dueDate: new Date('2030-02-01T00:00:00Z'),
      },
    });
    await db.payment.create({
      data: {
        organizationId: org,
        leaseId: source,
        amount: '1500.00',
        status: 'SUCCEEDED',
        paidAt: new Date(),
      },
    });
    await db.leaseEvent.create({ data: { organizationId: org, leaseId: source, kind: 'CREATED' } });
    // Charges are compared by ID: the shared database's rent planner may add scheduled rent rows
    // to this active lease while the suite runs.
    const snapshot = () =>
      db.lease.findUniqueOrThrow({
        where: { id: source },
        include: {
          charges: { where: { id: charge.id } },
          payments: true,
          events: true,
          tenants: true,
        },
      });
    const before = await snapshot();

    const renewal = await wizardDraft(units[2], source, '2031-01-01');
    expect((await draftRenewalSources(org, [renewal], db)).get(renewal)).toBe(source);
    // The source of a renewal is never itself deletable as a draft.
    expect(await deleteLeaseDraft(org, source, db, removeBytes)).toMatchObject({
      ok: false,
      reason: 'ineligible',
    });

    expect(await deleteLeaseDraft(org, renewal, db, removeBytes)).toMatchObject({ ok: true });
    expect(await snapshot()).toEqual(before);
  });

  it('refuses active, sent, agreement-backed and ledger-backed leases without touching them', async () => {
    const active = await lease(units[3], { status: 'ACTIVE' });
    const sent = await lease(units[3], { eSignStatus: 'SENT' });
    const withAgreement = await lease(units[3]);
    await db.leaseAgreement.create({
      data: {
        organizationId: org,
        leaseId: withAgreement,
        version: 1,
        snapshot: {},
        snapshotHash: hash('agreement'),
      },
    });
    const withCharge = await lease(units[3]);
    await db.charge.create({
      data: {
        organizationId: org,
        leaseId: withCharge,
        kind: 'DEPOSIT',
        amount: '1500.00',
        dueDate: new Date('2030-01-01T00:00:00Z'),
      },
    });
    const withPayment = await lease(units[3]);
    await db.payment.create({
      data: { organizationId: org, leaseId: withPayment, amount: '50.00' },
    });

    for (const id of [active, sent, withAgreement, withCharge, withPayment]) {
      const result = await deleteLeaseDraft(org, id, db, removeBytes);
      expect(result, id).toMatchObject({ ok: false, reason: 'ineligible' });
      expect(await db.lease.count({ where: { id } })).toBe(1);
    }
    expect(await db.leaseAgreement.count({ where: { leaseId: withAgreement } })).toBe(1);
    expect(await db.charge.count({ where: { leaseId: withCharge } })).toBe(1);
    expect(await db.payment.count({ where: { leaseId: withPayment } })).toBe(1);
  });

  it('waits for a concurrent send that holds the lease lock, then refuses the now-sent draft', async () => {
    const id = await wizardDraft(units[4]);
    let release!: () => void;
    const held = new Promise<void>((resolve) => (release = resolve));
    let locked!: () => void;
    const lockTaken = new Promise<void>((resolve) => (locked = resolve));
    // Mirrors sendLeaseForSignature: lease row lock, new agreement version, status SENT.
    const send = db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Lease" WHERE "id" = ${id} FOR UPDATE`;
      locked();
      await held;
      await tx.leaseAgreement.create({
        data: {
          organizationId: org,
          leaseId: id,
          version: 1,
          snapshot: {},
          snapshotHash: hash('race'),
        },
      });
      await tx.lease.update({ where: { id }, data: { eSignStatus: 'SENT' } });
    });
    await lockTaken;
    const deletion = deleteLeaseDraft(org, id, db, removeBytes);
    await new Promise((resolve) => setTimeout(resolve, 300));
    release();
    await send;
    expect(await deletion).toMatchObject({ ok: false, reason: 'ineligible' });
    expect(await db.lease.findUniqueOrThrow({ where: { id } })).toMatchObject({
      eSignStatus: 'SENT',
    });
    expect(await db.leaseAgreement.count({ where: { leaseId: id } })).toBe(1);
  });

  it('resolves concurrent delete/activate and delete/save to one consistent outcome', async () => {
    const id = await wizardDraft(units[5], undefined, '2032-01-01');
    const [deleted, activated] = await Promise.allSettled([
      deleteLeaseDraft(org, id, db, removeBytes),
      activateLease(org, id, db),
    ]);
    const exists = await db.lease.findUnique({ where: { id }, include: { charges: true } });
    if (exists) {
      // Activation won: the lease is active with its ledger and the delete was refused.
      expect(activated.status).toBe('fulfilled');
      expect(exists.status).toBe('ACTIVE');
      expect(deleted).toMatchObject({
        status: 'fulfilled',
        value: { ok: false, reason: 'ineligible' },
      });
    } else {
      expect(deleted).toMatchObject({ status: 'fulfilled', value: { ok: true } });
      expect(activated.status).toBe('rejected');
      if (activated.status === 'rejected')
        expect(activated.reason).toBeInstanceOf(LeaseServiceError);
      expect(await db.unit.findUniqueOrThrow({ where: { id: units[5] } })).toMatchObject({
        status: 'VACANT',
      });
    }

    const next = await wizardDraft(units[5], undefined, '2034-01-01');
    const [saveResult, deleteResult, again] = await Promise.allSettled([
      saveLeaseDraft(
        org,
        {
          leaseId: next,
          step: STEP.rent,
          nextStep: STEP.tenants,
          draft: { ...draft(units[5], '2034-01-01'), occupants: 'Race' },
          strict: false,
        },
        db,
      ),
      deleteLeaseDraft(org, next, db, removeBytes),
      deleteLeaseDraft(org, next, db, removeBytes),
    ]);
    // Exactly one delete succeeds, nothing of the draft survives and a losing save is a clean refusal.
    const outcomes = [deleteResult, again].map((r) => (r.status === 'fulfilled' ? r.value : null));
    expect(outcomes.filter((r) => r?.ok)).toHaveLength(1);
    expect(outcomes.filter((r) => r && !r.ok && r.reason === 'not-found')).toHaveLength(1);
    expect(await db.lease.count({ where: { id: next } })).toBe(0);
    expect(await db.leaseDraft.count({ where: { leaseId: next } })).toBe(0);
    if (saveResult.status === 'rejected')
      expect(saveResult.reason).toBeInstanceOf(LeaseServiceError);
    expect(await db.tenant.count({ where: { id: tenant } })).toBe(1);
  });
});
