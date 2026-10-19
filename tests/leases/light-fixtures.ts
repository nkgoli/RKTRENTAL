import { PrismaClient, type LeaseStatus, type ESignStatus } from '@prisma/client';

export const db = new PrismaClient();
export const organizationId = 'seed-rocket-rental';
export const propertyId = 'seed-property-maple';
export const fixtureId = (state: string) => `light-detail-${state}`;
export const day = (value: string) => new Date(`${value}T00:00:00Z`);

/** This fixture may only mutate the task's isolated review database. */
export async function prepareLightFixtures() {
  const url = new URL(process.env.DATABASE_URL ?? '');
  if (!['localhost', '127.0.0.1'].includes(url.hostname) || url.port !== '55434') {
    throw new Error('Light lease fixtures require the isolated database on port 55434.');
  }
  for (const [key, status, signature] of [
    ['active', 'ACTIVE', 'SIGNED'],
    ['draft', 'DRAFT', 'NOT_SENT'],
    ['ended', 'ENDED', 'NOT_SENT'],
    ['pending', 'ACTIVE', 'PARTIALLY_SIGNED'],
    ['terminate', 'ACTIVE', 'NOT_SENT'],
  ] as [string, LeaseStatus, ESignStatus][]) {
    const id = fixtureId(key);
    const unitId = `${id}-unit`;
    await db.unit.upsert({
      where: { id: unitId },
      create: {
        id: unitId,
        organizationId,
        propertyId,
        number: `Review ${key}`,
        status: status === 'ACTIVE' ? 'OCCUPIED' : 'VACANT',
      },
      update: { status: status === 'ACTIVE' ? 'OCCUPIED' : 'VACANT' },
    });
    const values = {
      status,
      eSignStatus: signature,
      startDate: day('2025-12-01'),
      endDate: day('2027-11-30'),
      monthlyRent: '1850',
      deposit: '1850',
      lateFee: '75',
      graceDays: 5,
      noticeGivenAt: null,
      moveOutDate: null,
      signedAt: signature === 'SIGNED' ? day('2025-11-18') : null,
    };
    await db.lease.upsert({
      where: { id },
      create: { id, organizationId, unitId, ...values },
      update: values,
    });
    await db.leaseEvent.deleteMany({ where: { leaseId: id, organizationId } });
    await db.leaseTenant.deleteMany({ where: { leaseId: id, organizationId } });
    await db.document.deleteMany({ where: { leaseId: id, organizationId } });
    if (key === 'active' || key === 'pending') {
      for (const [index, name] of [
        'Review signed tenant',
        'Review awaiting tenant',
        'Review declined tenant',
      ].entries()) {
        if (key === 'active' && index > 0) break;
        const tenantId = `${id}-tenant-${index}`;
        await db.tenant.upsert({
          where: { id: tenantId },
          create: {
            id: tenantId,
            organizationId,
            name,
            email: `${'long-contact-address-'.repeat(6)}${index}@example.com`,
          },
          update: {},
        });
        await db.leaseTenant.create({
          data: { leaseId: id, tenantId, organizationId, isPrimary: index === 0 },
        });
        await db.leaseEvent.create({
          data: {
            leaseId: id,
            tenantId,
            organizationId,
            kind: index === 0 ? 'SIGNED' : index === 1 ? 'SENT' : 'DECLINED',
            createdAt: day('2025-11-18'),
          },
        });
      }
    }
    if (key === 'active') {
      await db.lease.update({
        where: { id },
        data: {
          templateVersion: 2,
          termsSnapshot: {
            template: { name: 'Review signed agreement' },
            items: [
              {
                id: 'signed-clause',
                section: 'CLAUSE',
                title: 'Immutable signed terms',
                body:
                  'The signed deposit is $1,850. ' +
                  'LongSignedWording'.repeat(35) +
                  ' {{monthly_rent}}',
              },
            ],
          },
        },
      });
    }
  }
  await db.lease.upsert({
    where: { id: fixtureId('blocked') },
    create: {
      id: fixtureId('blocked'),
      organizationId,
      unitId: `${fixtureId('active')}-unit`,
      status: 'DRAFT',
      startDate: day('2025-12-01'),
      endDate: day('2027-11-30'),
      monthlyRent: '1850',
      deposit: '1850',
    },
    update: { status: 'DRAFT' },
  });
  console.log('Prepared six lease review fixtures in the isolated database.');
}

if (process.argv[1]?.endsWith('light-fixtures.ts')) {
  prepareLightFixtures().finally(() => db.$disconnect());
}
