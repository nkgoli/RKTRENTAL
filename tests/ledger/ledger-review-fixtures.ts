import { PrismaClient, type LeaseStatus } from '@prisma/client';

/**
 * Synthetic Rent ledger history for the browser review: one property with two back-to-back ACTIVE
 * terms on one unit, an ended-only unit that still owes, and a terminated lease with only a
 * payment on record (credit). Everything lives under ids prefixed `ledger-review-`.
 */
export const db = new PrismaClient();
export const organizationId = 'seed-rocket-rental';
export const propertyId = 'ledger-review-property';
export const unit = { terms: 'ledger-review-unit-terms', ended: 'ledger-review-unit-ended', credit: 'ledger-review-unit-credit' };
export const lease = {
  now: 'ledger-review-now',
  next: 'ledger-review-next',
  ended: 'ledger-review-ended',
  credit: 'ledger-review-credit',
};
const day = (value: string) => new Date(`${value}T00:00:00Z`);

/** Only the reserved, disposable review database on port 55434 may be written. */
export async function prepareLedgerFixtures() {
  const url = new URL(process.env.DATABASE_URL ?? '');
  if (!['localhost', '127.0.0.1'].includes(url.hostname) || url.port !== '55434')
    throw new Error('Ledger review fixtures require the isolated database on port 55434.');
  const ids = Object.values(lease);
  await db.payment.deleteMany({ where: { organizationId, leaseId: { in: ids } } });
  await db.charge.deleteMany({ where: { organizationId, leaseId: { in: ids } } });
  await db.leaseTenant.deleteMany({ where: { organizationId, leaseId: { in: ids } } });
  await db.lease.deleteMany({ where: { organizationId, id: { in: ids } } });
  await db.property.upsert({
    where: { id: propertyId },
    create: {
      id: propertyId,
      organizationId,
      name: 'Ledger Review Court',
      type: 'MULTI_UNIT',
      street: '1 Review Way',
      city: 'Austin',
      state: 'TX',
      postalCode: '78701',
    },
    update: {},
  });
  for (const [id, number] of [
    [unit.terms, 'Terms 1'],
    [unit.ended, 'Ended 2'],
    [unit.credit, 'Credit 3'],
  ])
    await db.unit.upsert({
      where: { id },
      create: { id, organizationId, propertyId, number },
      update: {},
    });
  const tenant = async (id: string, name: string) =>
    db.tenant.upsert({ where: { id }, create: { id, organizationId, name }, update: { name } });
  await tenant('ledger-review-tenant-sam', 'Sam Review');
  await tenant('ledger-review-tenant-gale', 'Gale Ended');
  await tenant('ledger-review-tenant-pat', 'Pat Credit');
  const make = async (
    id: string,
    unitId: string,
    status: LeaseStatus,
    start: string,
    end: string,
    rent: string,
    tenantId: string,
  ) => {
    await db.lease.create({
      data: {
        id,
        organizationId,
        unitId,
        status,
        eSignStatus: 'SIGNED',
        signedAt: day(start),
        startDate: day(start),
        endDate: day(end),
        monthlyRent: rent,
        deposit: '0',
        lateFee: '50',
        graceDays: 5,
      },
    });
    await db.leaseTenant.create({ data: { leaseId: id, tenantId, organizationId, isPrimary: true } });
  };
  // The current term and its already ACTIVE renewal; the renewal is newer, so it sorts first.
  await make(lease.now, unit.terms, 'ACTIVE', '2026-01-01', '2026-12-31', '1000.00', 'ledger-review-tenant-sam');
  await make(lease.next, unit.terms, 'ACTIVE', '2027-01-01', '2027-12-31', '1050.00', 'ledger-review-tenant-sam');
  await make(lease.ended, unit.ended, 'ENDED', '2025-01-01', '2025-12-31', '800.00', 'ledger-review-tenant-gale');
  await make(lease.credit, unit.credit, 'TERMINATED', '2025-01-01', '2025-06-30', '700.00', 'ledger-review-tenant-pat');
  await db.charge.create({
    data: {
      organizationId,
      leaseId: lease.ended,
      kind: 'RENT',
      amount: '800.00',
      dueDate: day('2025-12-01'),
      description: `rent:${lease.ended}:2025-12`,
    },
  });
  await db.payment.createMany({
    data: [
      {
        organizationId,
        leaseId: lease.ended,
        amount: '300.00',
        status: 'SUCCEEDED',
        paidAt: day('2025-12-03'),
        providerReference: 'manual:ledger-review-ended:2025-12',
      },
      {
        organizationId,
        leaseId: lease.credit,
        amount: '100.00',
        status: 'SUCCEEDED',
        paidAt: day('2025-06-01'),
        providerReference: 'manual:ledger-review-credit:2025-06-01-credit',
      },
    ],
  });
}
