import {
  ESignStatus,
  LeaseStatus,
  PrismaClient,
  PropertyType,
  UnitStatus,
  UserRole,
} from '@prisma/client';
import { hashPassword } from '../src/lib/auth/password';

const prisma = new PrismaClient();
const organizationId = 'seed-rocket-rental';
const date = (value: string) => new Date(value + 'T00:00:00.000Z');
const seedDemoPasswords =
  process.env.NODE_ENV !== 'production' || process.env.SEED_DEMO_PASSWORDS === '1';
const demoPasswords = {
  jordan: 'JordanDemo#2026',
  alex: 'AlexDemo#2026',
};

type UnitSeed = {
  number: string;
  occupied: boolean;
  rent: number;
  tenant?: string;
  email?: string;
  start?: string;
  end?: string;
};

const maple: UnitSeed[] = [
  { number: '1A', occupied: true, rent: 1550, tenant: 'Dana Kim' },
  { number: '1B', occupied: true, rent: 1750 },
  { number: '1C', occupied: true, rent: 1650 },
  {
    number: '2A',
    occupied: true,
    rent: 1800,
    tenant: 'Priya Shah',
    email: 'priya.shah@email.com',
    end: '2027-03-31',
  },
  { number: '2B', occupied: true, rent: 1850 },
  { number: '2C', occupied: true, rent: 1800, tenant: 'Sam Patel' },
  { number: '3A', occupied: false, rent: 1600 },
  { number: '3B', occupied: true, rent: 2050 },
  { number: '3C', occupied: true, rent: 2050 },
  { number: '4A', occupied: true, rent: 2100 },
  {
    number: '4B',
    occupied: true,
    rent: 1850,
    tenant: 'Alex Rivera',
    email: 'alex.rivera@email.com',
    start: '2025-12-01',
    end: '2026-11-30',
  },
  { number: '5D', occupied: true, rent: 2950, tenant: 'Tara Wu' },
];

const harborNumbers = Array.from({ length: 24 }, (_, index) => String(index + 1));
harborNumbers[7] = '8D';
harborNumbers[11] = '12A';
harborNumbers[23] = '306';
const harbor: UnitSeed[] = harborNumbers.map((number, index) => ({
  number,
  occupied: index < 20 || index >= 22,
  rent: index === 23 ? 2240 : 1750,
  ...(number === '12A' ? { tenant: 'Marcus Okafor', email: 'm.okafor@email.com' } : {}),
  ...(number === '5' ? { tenant: 'Sofia Nguyen', email: 'sofia.n@email.com' } : {}),
  ...(number === '306' ? { tenant: 'Mina Patel', email: 'mina.patel@email.com' } : {}),
}));
const cedar: UnitSeed[] = Array.from({ length: 8 }, (_, index) => ({
  number: `Townhome ${index + 1}`,
  occupied: index < 7,
  rent: 1650,
  ...(index === 6 ? { tenant: 'Lena Castillo', email: 'lena.c@email.com' } : {}),
}));
const elm: UnitSeed[] = [
  {
    number: 'Whole property',
    occupied: true,
    rent: 1690,
    tenant: 'Sam Wilson',
    email: 'sam.wilson@email.com',
  },
];

async function main() {
  const [jordanPasswordHash, alexPasswordHash] = seedDemoPasswords
    ? await Promise.all([hashPassword(demoPasswords.jordan), hashPassword(demoPasswords.alex)])
    : [undefined, undefined];

  await prisma.organization.upsert({
    where: { id: organizationId },
    update: { name: 'RocketRental Demo' },
    create: { id: organizationId, name: 'RocketRental Demo' },
  });
  await prisma.user.upsert({
    where: { id: 'seed-jordan-mills' },
    update: {
      organizationId,
      name: 'Jordan Mills',
      role: UserRole.MANAGER,
      ...(jordanPasswordHash ? { passwordHash: jordanPasswordHash } : {}),
    },
    create: {
      id: 'seed-jordan-mills',
      organizationId,
      email: 'jordan.mills@rocketrental.example',
      name: 'Jordan Mills',
      role: UserRole.MANAGER,
      ...(jordanPasswordHash ? { passwordHash: jordanPasswordHash } : {}),
    },
  });
  await prisma.user.upsert({
    where: { id: 'seed-alex-rivera' },
    update: {
      organizationId,
      email: 'alex.rivera@email.com',
      name: 'Alex Rivera',
      role: UserRole.TENANT,
      ...(alexPasswordHash ? { passwordHash: alexPasswordHash } : {}),
    },
    create: {
      id: 'seed-alex-rivera',
      organizationId,
      email: 'alex.rivera@email.com',
      name: 'Alex Rivera',
      role: UserRole.TENANT,
      ...(alexPasswordHash ? { passwordHash: alexPasswordHash } : {}),
    },
  });
  await prisma.user.upsert({
    where: { id: 'seed-harbor-owner' },
    update: { organizationId, name: 'Harbor Holdings LLC', role: UserRole.OWNER },
    create: {
      id: 'seed-harbor-owner',
      organizationId,
      email: 'owner@harborholdings.example',
      name: 'Harbor Holdings LLC',
      role: UserRole.OWNER,
    },
  });

  const properties = [
    {
      slug: 'maple',
      name: 'Maple Court',
      type: PropertyType.MULTI_UNIT,
      street: '214 Maple Ave',
      city: 'Austin',
      state: 'TX',
      postalCode: '78704',
      yearBuilt: 1998,
      units: maple,
    },
    {
      slug: 'harbor',
      name: 'Harbor View Lofts',
      type: PropertyType.MULTI_UNIT,
      street: '80 Harbor St',
      city: 'Austin',
      state: 'TX',
      postalCode: '78701',
      units: harbor,
    },
    {
      slug: 'cedar',
      name: 'Cedar Row Townhomes',
      type: PropertyType.MULTI_UNIT,
      street: '9 Cedar Row',
      city: 'Austin',
      state: 'TX',
      postalCode: '78702',
      units: cedar,
    },
    {
      slug: 'elm',
      name: '18 Elm Street',
      type: PropertyType.SINGLE_UNIT,
      street: '18 Elm St',
      city: 'Austin',
      state: 'TX',
      postalCode: '78745',
      units: elm,
    },
  ];

  for (const property of properties) {
    const propertyId = `seed-property-${property.slug}`;
    const { units, slug, ...propertyData } = property;
    await prisma.property.upsert({
      where: { id: propertyId },
      update: { ...propertyData, ownerId: 'seed-harbor-owner' },
      create: { id: propertyId, organizationId, ownerId: 'seed-harbor-owner', ...propertyData },
    });
    for (const [index, item] of units.entries()) {
      const unitId = `seed-unit-${slug}-${index + 1}`;
      await prisma.unit.upsert({
        where: { id: unitId },
        update: {
          number: item.number,
          status: item.occupied ? UnitStatus.OCCUPIED : UnitStatus.VACANT,
          listedRent: item.rent,
          isImplicit: property.type === PropertyType.SINGLE_UNIT,
        },
        create: {
          id: unitId,
          organizationId,
          propertyId,
          number: item.number,
          status: item.occupied ? UnitStatus.OCCUPIED : UnitStatus.VACANT,
          listedRent: item.rent,
          isImplicit: property.type === PropertyType.SINGLE_UNIT,
        },
      });
      if (!item.occupied) continue;

      const tenantId = `seed-tenant-${slug}-${index + 1}`;
      const name = item.tenant ?? `Sample Tenant ${slug.toUpperCase()}-${index + 1}`;
      const tenantData = {
        name,
        email: item.email,
        ...(name === 'Alex Rivera' ? { userId: 'seed-alex-rivera' } : {}),
      };
      await prisma.tenant.upsert({
        where: { id: tenantId },
        update: tenantData,
        create: { id: tenantId, organizationId, ...tenantData },
      });

      const leaseId = `seed-lease-${slug}-${index + 1}`;
      const leaseData = {
        unitId,
        startDate: date(item.start ?? '2026-01-01'),
        endDate: date(item.end ?? '2026-12-31'),
        monthlyRent: item.rent,
        deposit: item.rent,
        lateFee: 75,
        graceDays: 5,
        status: LeaseStatus.ACTIVE,
        eSignStatus: ESignStatus.SIGNED,
      };
      await prisma.lease.upsert({
        where: { id: leaseId },
        update: leaseData,
        create: { id: leaseId, organizationId, ...leaseData },
      });
      await prisma.leaseTenant.upsert({
        where: { leaseId_tenantId: { leaseId, tenantId } },
        update: { isPrimary: true },
        create: { leaseId, tenantId, organizationId, isPrimary: true },
      });
    }
  }

  await prisma.maintenanceRequest.upsert({
    where: { id: 'seed-request-maple-4b' },
    update: { title: 'Kitchen sink leak', priority: 'URGENT', status: 'NEW' },
    create: {
      id: 'seed-request-maple-4b',
      organizationId,
      propertyId: 'seed-property-maple',
      unitId: 'seed-unit-maple-11',
      title: 'Kitchen sink leak',
      priority: 'URGENT',
      status: 'NEW',
    },
  });
  console.log('Seeded 4 properties, 45 units, 41 occupied leases, Jordan Mills and Alex Rivera.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
