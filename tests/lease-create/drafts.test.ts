import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import {
  activateDraftLease,
  findOpenDraft,
  loadLeaseDraft,
  saveLeaseDraft,
} from '@/lib/lease-create/drafts';
import { STEP, emptyDraft } from '@/lib/lease-create/types';
import { withResolvedEnd } from '@/lib/lease-create/validation';
import { ensureRentCharges } from '@/lib/ledger';
import { buildLeaseStatement } from '@/lib/ledger/statement';
import { leaseTerms, toLedgerCharge } from '@/lib/ledger/store';

// Needs a migrated, seeded Postgres: RUN_DB_INTEGRATION=1 DATABASE_URL=... npx vitest run tests/lease-create
const live = process.env.RUN_DB_INTEGRATION === '1' && Boolean(process.env.DATABASE_URL);

describe.skipIf(!live)('lease draft persistence (database)', () => {
  const db = new PrismaClient();
  let organizationId = '';
  let unitId = '';
  let tenantId = '';
  const created: string[] = [];

  beforeAll(async () => {
    const unit = await db.unit.findFirstOrThrow({
      where: { status: 'VACANT', leases: { none: {} } },
      orderBy: { id: 'desc' },
    });
    unitId = unit.id;
    organizationId = unit.organizationId;
    tenantId = (await db.tenant.findFirstOrThrow({ where: { organizationId } })).id;
  });

  afterAll(async () => {
    for (const id of created) {
      await db.charge.deleteMany({ where: { leaseId: id } });
      await db.leaseEvent.deleteMany({ where: { leaseId: id } });
      await db.lease.delete({ where: { id } }).catch(() => undefined);
    }
    await db.unit.update({ where: { id: unitId }, data: { status: 'VACANT' } });
    await db.$disconnect();
  });

  const draft = () =>
    withResolvedEnd(
      emptyDraft({
        unitId,
        startDate: '2031-05-15',
        monthlyRent: '1850',
        deposit: '1850',
        moveInFeeEnabled: true,
        moveInFee: '150',
        tenantIds: [tenantId],
        primaryTenantId: tenantId,
        lessorName: 'Harbor Holdings',
        lessorAddress: '1 Main St',
      }),
    );

  it('saves each step and resumes on the saved step with the entered values', async () => {
    const first = await saveLeaseDraft(organizationId, {
      step: STEP.term,
      nextStep: STEP.rent,
      draft: draft(),
      strict: true,
    }, db);
    expect(first).toMatchObject({ ok: true, step: STEP.rent });
    if (!first.ok) return;
    created.push(first.leaseId);

    const second = await saveLeaseDraft(organizationId, {
      leaseId: first.leaseId,
      step: STEP.rent,
      nextStep: STEP.clauses,
      draft: { ...draft(), occupants: 'Two adults' },
      strict: true,
    }, db);
    expect(second).toMatchObject({ ok: true, leaseId: first.leaseId, furthestStep: STEP.clauses });

    const resumed = await loadLeaseDraft(organizationId, first.leaseId, db);
    expect(resumed).toMatchObject({ step: STEP.clauses, furthestStep: STEP.clauses, unitId });
    expect(resumed?.draft).toMatchObject({
      startDate: '2031-05-15',
      endDate: '2032-05-14',
      monthlyRent: '1850',
      moveInFee: '150',
      occupants: 'Two adults',
      tenantIds: [tenantId],
    });
    expect(await findOpenDraft(organizationId, { unitId }, db)).toBe(first.leaseId);

    // Save and exit on an earlier step keeps the furthest step reached.
    await saveLeaseDraft(organizationId, {
      leaseId: first.leaseId,
      step: STEP.term,
      nextStep: STEP.term,
      draft: draft(),
      strict: false,
    }, db);
    expect(await loadLeaseDraft(organizationId, first.leaseId, db)).toMatchObject({
      step: STEP.term,
      furthestStep: STEP.clauses,
    });
  });

  it('refuses to continue past a step with invalid values', async () => {
    const bad = await saveLeaseDraft(organizationId, {
      leaseId: created[0],
      step: STEP.rent,
      nextStep: STEP.tenants,
      draft: { ...draft(), monthlyRent: 'abc' },
      strict: true,
    }, db);
    expect(bad).toMatchObject({ ok: false });
  });

  it('turns the draft into ledger charges once, with no duplicate rows', async () => {
    const leaseId = created[0];
    const result = await activateDraftLease(organizationId, leaseId, draft(), db);
    expect(result).toEqual({ ok: true, id: leaseId });
    await expect(activateDraftLease(organizationId, leaseId, draft(), db)).rejects.toThrow();

    await ensureRentCharges(organizationId, new Date('2031-06-10T00:00:00Z'), db);
    await ensureRentCharges(organizationId, new Date('2031-06-10T00:00:00Z'), db);
    const lease = await db.lease.findUniqueOrThrow({
      where: { id: leaseId },
      include: { charges: true },
    });
    const descriptions = lease.charges.map((c) => c.description);
    expect(new Set(descriptions).size).toBe(descriptions.length);
    expect(descriptions.sort()).toEqual(
      [
        `rent:${leaseId}:2031-05`,
        `rent:${leaseId}:2031-06`,
        `setup:deposit:${leaseId}`,
        `setup:move-in-fee:${leaseId}`,
      ].sort(),
    );
    const may = lease.charges.find((c) => c.description === `rent:${leaseId}:2031-05`);
    expect(may?.amount.toString()).toBe('1014.52');

    const statement = buildLeaseStatement({
      lease: leaseTerms(lease),
      charges: lease.charges.map(toLedgerCharge),
      payments: [],
      asOf: new Date('2031-06-10T00:00:00Z'),
    });
    const keys = statement.rows.map((r) => `${r.kind}:${r.description}:${r.dueDate.toISOString()}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
