import { PrismaClient } from '@prisma/client';
if (!process.env.DATABASE_URL?.includes('localhost:55429/'))
  throw new Error('Requires isolated lease review database');
const db = new PrismaClient();
try {
  const source = await db.lease.findUniqueOrThrow({
    where: { id: 'seed-lease-maple-11' },
    include: { tenants: true },
  });
  for (let i = 0; i < 23; i++) {
    const id = i === 0 ? 'lease-review-draft' : `lease-review-past-${i}`;
    await db.lease.upsert({
      where: { id },
      update: {},
      create: {
        id,
        organizationId: source.organizationId,
        unitId: source.unitId,
        startDate: new Date(i === 0 ? '2027-01-01' : '2020-01-01'),
        endDate: new Date(i === 0 ? '2027-12-31' : '2020-12-31'),
        monthlyRent: source.monthlyRent,
        deposit: source.deposit,
        status: i === 0 ? 'DRAFT' : 'ENDED',
      },
    });
    for (const t of source.tenants)
      await db.leaseTenant.upsert({
        where: { leaseId_tenantId: { leaseId: id, tenantId: t.tenantId } },
        update: {},
        create: {
          leaseId: id,
          tenantId: t.tenantId,
          organizationId: t.organizationId,
          isPrimary: t.isPrimary,
        },
      });
  }
  console.log(
    JSON.stringify({
      fixture: 'lease-review',
      propertyId: 'seed-property-maple',
      unitId: source.unitId,
      draft: 'lease-review-draft',
      pastCount: 22,
      emptyUnit: (
        await db.unit.findFirst({
          where: { leases: { none: {} }, propertyId: 'seed-property-maple' },
          select: { id: true },
        })
      )?.id,
    }),
  );
} finally {
  await db.$disconnect();
}
