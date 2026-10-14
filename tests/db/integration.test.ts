import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { organizationDb } from '../../src/lib/db/organization';

// Run after db:migrate with RUN_DB_INTEGRATION=1 and DATABASE_URL set.
describe.skipIf(process.env.RUN_DB_INTEGRATION !== '1')(
  'PostgreSQL lease and isolation constraints',
  () => {
    const prisma = new PrismaClient();
    const suffix = randomUUID();
    const orgA = `test-org-a-${suffix}`;
    const orgB = `test-org-b-${suffix}`;
    const propertyA = `test-property-a-${suffix}`;
    const propertyB = `test-property-b-${suffix}`;
    const unitA = `test-unit-a-${suffix}`;

    beforeAll(async () => {
      await prisma.organization.createMany({
        data: [
          { id: orgA, name: 'Test A' },
          { id: orgB, name: 'Test B' },
        ],
      });
      await prisma.property.createMany({
        data: [
          {
            id: propertyA,
            organizationId: orgA,
            name: 'A',
            type: 'MULTI_UNIT',
            street: '1 A St',
            city: 'Austin',
            state: 'TX',
            postalCode: '78701',
          },
          {
            id: propertyB,
            organizationId: orgB,
            name: 'B',
            type: 'MULTI_UNIT',
            street: '2 B St',
            city: 'Austin',
            state: 'TX',
            postalCode: '78702',
          },
        ],
      });
      await prisma.unit.create({
        data: { id: unitA, organizationId: orgA, propertyId: propertyA, number: '1' },
      });
    });

    afterAll(async () => {
      await prisma.lease.deleteMany({ where: { organizationId: orgA } });
      await prisma.unit.deleteMany({ where: { organizationId: orgA } });
      await prisma.property.deleteMany({ where: { organizationId: { in: [orgA, orgB] } } });
      await prisma.organization.deleteMany({ where: { id: { in: [orgA, orgB] } } });
      await prisma.$disconnect();
    });

    it('rejects active overlap, allows adjacent terms, and rejects another organization', async () => {
      const scoped = organizationDb(orgA, prisma);
      const base = {
        unitId: unitA,
        startDate: new Date('2026-01-01T00:00:00.000Z'),
        endDate: new Date('2026-06-30T00:00:00.000Z'),
        monthlyRent: 1850,
        deposit: 1850,
        status: 'ACTIVE' as const,
      };
      await scoped.createLease(base);
      await expect(
        scoped.createLease({
          ...base,
          startDate: new Date('2026-06-30T00:00:00.000Z'),
          endDate: new Date('2026-07-31T00:00:00.000Z'),
        }),
      ).rejects.toThrow();
      await expect(
        scoped.createLease({
          ...base,
          startDate: new Date('2026-07-01T00:00:00.000Z'),
          endDate: new Date('2026-12-31T00:00:00.000Z'),
        }),
      ).resolves.toBeDefined();
      await expect(organizationDb(orgB, prisma).createLease(base)).rejects.toThrow();
    });

    it('returns no records from another organization', async () => {
      expect(await organizationDb(orgA, prisma).getProperty(propertyB)).toBeNull();
      expect(await organizationDb(orgB, prisma).getProperty(propertyA)).toBeNull();
    });
  },
);
