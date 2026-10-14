import {
  ApplicationStatus,
  ESignStatus,
  LeaseStatus,
  PaymentStatus,
  PrismaClient,
  PropertyType,
  UnitStatus,
  UserRole,
} from '@prisma/client';
import { deflateSync } from 'node:zlib';
import { hashPassword } from '../src/lib/auth/password';
import { buildLeasePdf } from '../src/lib/esign/pdf';
import { addMonths, monthStart, rentKey } from '../src/lib/ledger/core';
import { createStorageAdapter } from '../src/lib/storage/config';

const prisma = new PrismaClient();
const organizationId = 'seed-rocket-rental';
const date = (value: string) => new Date(value + 'T00:00:00.000Z');
const seedDemoPasswords =
  process.env.NODE_ENV !== 'production' || process.env.SEED_DEMO_PASSWORDS === '1';
const demoPasswords = {
  jordan: 'JordanDemo#2026',
  alex: 'AlexDemo#2026',
};

const amenitiesByProperty: Record<string, string[]> = {
  maple: ['In-unit laundry', 'Central A/C', 'Dishwasher', 'Assigned parking'],
  harbor: ['Harbor views', 'Elevator', 'Rooftop deck', 'Gym access'],
  cedar: ['Private garage', 'Fenced patio', 'Washer/dryer hookup'],
  elm: ['Fenced yard', 'Garage', 'Central A/C'],
};

/** Floor from the unit number ("4B" -> 4); loft numbers are spread over six floors. */
function floorFor(slug: string, number: string, index: number): number | null {
  if (slug === 'elm') return 1;
  if (slug === 'cedar') return 1;
  const leading = /^(\d)[A-Z]/.exec(number);
  if (slug === 'maple' && leading) return Number(leading[1]);
  if (slug === 'harbor') return Math.floor(index / 4) + 1;
  return null;
}

const emergencyContacts: Record<string, [string, string, string]> = {
  'Alex Rivera': ['Maria Rivera', '(512) 555-0142', 'Mother'],
  'Priya Shah': ['Dev Shah', '(512) 555-0177', 'Spouse'],
  'Sam Patel': ['Anita Patel', '(512) 555-0119', 'Sister'],
  'Tara Wu': ['Kevin Wu', '(512) 555-0163', 'Brother'],
  'Dana Kim': ['Joon Kim', '(512) 555-0108', 'Father'],
  'Marcus Okafor': ['Ngozi Okafor', '(512) 555-0134', 'Mother'],
};

/** A small solid-colour gradient PNG so seeded cover photos render without binary fixtures. */
function gradientPng(top: [number, number, number], bottom: [number, number, number]): Uint8Array {
  const width = 480;
  const height = 300;
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (bytes: Buffer) => {
    let c = 0xffffffff;
    for (const byte of bytes) c = crcTable[(c ^ byte) & 0xff]! ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(type), data]);
    const out = Buffer.alloc(body.length + 8);
    out.writeUInt32BE(data.length, 0);
    body.copy(out, 4);
    out.writeUInt32BE(crc(body), body.length + 4);
    return out;
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2;
  const rows: Buffer[] = [];
  for (let y = 0; y < height; y++) {
    const row = Buffer.alloc(1 + width * 3);
    const t = y / (height - 1);
    for (let x = 0; x < width; x++) {
      for (let channel = 0; channel < 3; channel++) {
        row[1 + x * 3 + channel] = Math.round(
          top[channel]! + (bottom[channel]! - top[channel]!) * t,
        );
      }
    }
    rows.push(row);
  }
  return new Uint8Array(
    Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk('IHDR', header),
      chunk('IDAT', deflateSync(Buffer.concat(rows))),
      chunk('IEND', Buffer.alloc(0)),
    ]),
  );
}

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
          marketRent: item.rent + (index % 3 === 0 ? 75 : index % 3 === 1 ? 0 : -50),
          floor: floorFor(slug, item.number, index),
          amenities: amenitiesByProperty[slug] ?? [],
          isImplicit: property.type === PropertyType.SINGLE_UNIT,
        },
        create: {
          id: unitId,
          organizationId,
          propertyId,
          number: item.number,
          status: item.occupied ? UnitStatus.OCCUPIED : UnitStatus.VACANT,
          listedRent: item.rent,
          marketRent: item.rent + (index % 3 === 0 ? 75 : index % 3 === 1 ? 0 : -50),
          floor: floorFor(slug, item.number, index),
          amenities: amenitiesByProperty[slug] ?? [],
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
        ...(emergencyContacts[name]
          ? {
              emergencyContactName: emergencyContacts[name][0],
              emergencyContactPhone: emergencyContacts[name][1],
              emergencyContactRelationship: emergencyContacts[name][2],
            }
          : {}),
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
        signedAt: date('2025-11-24'),
        ...(name === 'Alex Rivera' ? { occupants: 'Alex Rivera, Casey Rivera' } : {}),
        ...(name === 'Sam Patel'
          ? { noticeGivenAt: date('2026-10-01'), moveOutDate: date('2026-11-30') }
          : {}),
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

  const connections = [
    {
      kind: 'PAYMENTS' as const,
      provider: 'stripe',
      status: process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_')
        ? ('CONNECTED' as const)
        : ('DISCONNECTED' as const),
      settings: { mode: 'test' },
    },
    {
      kind: 'PAYMENTS' as const,
      provider: 'mock',
      status: 'CONNECTED' as const,
      settings: { mode: 'development' },
    },
    {
      kind: 'BANKING' as const,
      provider: 'plaid',
      status: 'DISCONNECTED' as const,
      settings: { mode: 'sandbox' },
    },
    {
      kind: 'SCREENING' as const,
      provider: 'transunion',
      status: 'CONNECTED' as const,
      settings: { product: 'SmartMove' },
    },
    {
      kind: 'COMPS' as const,
      provider: 'rentrange',
      status: 'DISCONNECTED' as const,
      settings: {},
    },
    {
      kind: 'EMAIL' as const,
      provider: 'mock',
      status: 'CONNECTED' as const,
      settings: { mode: 'sandbox' },
    },
  ];
  for (const connection of connections) {
    await prisma.providerConnection.upsert({
      where: {
        organizationId_kind_provider: {
          organizationId,
          kind: connection.kind,
          provider: connection.provider,
        },
      },
      update: { status: connection.status, settings: connection.settings },
      create: { organizationId, ...connection },
    });
  }

  const applicants = [
    {
      id: 'seed-application-olivia',
      name: 'Olivia Reed',
      email: 'olivia.reed@example.com',
      unitId: 'seed-unit-maple-7',
      status: ApplicationStatus.REVIEW,
      appliedAt: date('2026-10-08'),
      consentAt: date('2026-10-08'),
      reportId: 'SM-48291',
      reportStatus: 'complete',
      score: 742,
    },
    {
      id: 'seed-application-marcus',
      name: 'Marcus Bell',
      email: 'marcus.bell@example.com',
      unitId: 'seed-unit-harbor-21',
      status: ApplicationStatus.SCREENING,
      appliedAt: date('2026-10-10'),
      consentAt: date('2026-10-10'),
      reportId: 'SM-48292',
      reportStatus: 'pending',
    },
    {
      id: 'seed-application-nina',
      name: 'Nina Park',
      email: 'nina.park@example.com',
      unitId: 'seed-unit-cedar-8',
      status: ApplicationStatus.REVIEW,
      appliedAt: date('2026-10-09'),
      consentAt: date('2026-10-09'),
      reportId: 'SM-48293',
      reportStatus: 'complete',
    },
    {
      id: 'seed-application-rohan',
      name: 'Rohan Das',
      email: 'rohan.das@example.com',
      unitId: 'seed-unit-maple-7',
      status: ApplicationStatus.SUBMITTED,
      appliedAt: date('2026-10-11'),
    },
  ];
  for (const applicant of applicants) {
    await prisma.application.upsert({
      where: { id: applicant.id },
      update: {
        applicantName: applicant.name,
        applicantEmail: applicant.email,
        unitId: applicant.unitId,
        status: applicant.status,
        appliedAt: applicant.appliedAt,
      },
      create: {
        id: applicant.id,
        organizationId,
        applicantName: applicant.name,
        applicantEmail: applicant.email,
        unitId: applicant.unitId,
        status: applicant.status,
        appliedAt: applicant.appliedAt,
      },
    });
    if ('consentAt' in applicant && applicant.consentAt) {
      await prisma.screeningConsent.upsert({
        where: { applicationId_provider: { applicationId: applicant.id, provider: 'transunion' } },
        update: { consentedAt: applicant.consentAt, consentVersion: 'demo-2026' },
        create: {
          organizationId,
          applicationId: applicant.id,
          provider: 'transunion',
          consentedAt: applicant.consentAt,
          consentVersion: 'demo-2026',
        },
      });
    }
    if ('reportId' in applicant && applicant.reportId) {
      await prisma.screeningReport.upsert({
        where: {
          provider_providerReference: {
            provider: 'transunion',
            providerReference: applicant.reportId,
          },
        },
        update: {
          status: applicant.reportStatus!,
          summary: applicant.score
            ? { creditScore: applicant.score, background: 'clear', eviction: 'clear' }
            : undefined,
        },
        create: {
          organizationId,
          applicationId: applicant.id,
          provider: 'transunion',
          providerReference: applicant.reportId,
          status: applicant.reportStatus!,
          summary: applicant.score
            ? { creditScore: applicant.score, background: 'clear', eviction: 'clear' }
            : undefined,
          completedAt: applicant.reportStatus === 'complete' ? date('2026-10-12') : undefined,
        },
      });
    }
  }

  for (const [month, amount] of [
    ['2026-08', 1850],
    ['2026-09', 1850],
    ['2026-10', 1850],
  ] as const) {
    await prisma.payment.upsert({
      where: { id: `seed-payment-alex-${month}` },
      update: { amount, status: PaymentStatus.SUCCEEDED },
      create: {
        id: `seed-payment-alex-${month}`,
        organizationId,
        leaseId: 'seed-lease-maple-11',
        amount,
        status: PaymentStatus.SUCCEEDED,
        providerReference: `mock-payment-alex-${month}`,
        paidAt: date(`${month}-03`),
      },
    });
  }
  // Keep the rent roll useful on first load: prior months are settled, three
  // current tenants are late, and five have an upcoming automatic collection.
  const leases = await prisma.lease.findMany({
    where: { organizationId, status: LeaseStatus.ACTIVE },
    include: { tenants: { orderBy: { isPrimary: 'desc' } } },
    orderBy: { id: 'asc' },
  });
  const late = new Set(
    leases
      .filter((lease) => lease.id !== 'seed-lease-maple-11')
      .slice(0, 3)
      .map((lease) => lease.id),
  );
  const autopay = new Set(
    leases
      .filter((lease) => lease.id !== 'seed-lease-maple-11' && !late.has(lease.id))
      .slice(0, 5)
      .map((lease) => lease.id),
  );
  for (const lease of leases) {
    for (const month of ['2026-08', '2026-09', '2026-10']) {
      if (new Date(`${month}-01T00:00:00.000Z`) < lease.startDate) continue;
      await prisma.charge.upsert({
        where: { id: `seed-charge-${lease.id}-${month}` },
        update: {},
        create: {
          id: `seed-charge-${lease.id}-${month}`,
          organizationId,
          leaseId: lease.id,
          kind: 'RENT',
          amount: lease.monthlyRent,
          dueDate: date(`${month}-01`),
          description: `rent:${lease.id}:${month}`,
        },
      });
      if (
        lease.id === 'seed-lease-maple-11' ||
        (month === '2026-10' && (late.has(lease.id) || autopay.has(lease.id)))
      )
        continue;
      await prisma.payment.upsert({
        where: { id: `seed-payment-${lease.id}-${month}` },
        update: {},
        create: {
          id: `seed-payment-${lease.id}-${month}`,
          organizationId,
          leaseId: lease.id,
          amount: lease.monthlyRent,
          status: PaymentStatus.SUCCEEDED,
          providerReference: `seed:${lease.id}:${month}`,
          paidAt: date(`${month}-03`),
        },
      });
    }
    if (autopay.has(lease.id) && lease.tenants[0]) {
      const tenantId = lease.tenants[0].tenantId;
      const methodId = `seed-method-${lease.id}`;
      await prisma.paymentMethod.upsert({
        where: { id: methodId },
        update: {},
        create: {
          id: methodId,
          organizationId,
          tenantId,
          provider: 'mock',
          providerToken: `pm_seed_${lease.id}`,
          type: 'ach',
          last4: '4082',
        },
      });
      await prisma.autopaySetting.upsert({
        where: { leaseId_tenantId: { leaseId: lease.id, tenantId } },
        update: {},
        create: {
          organizationId,
          leaseId: lease.id,
          tenantId,
          paymentMethodId: methodId,
          enabled: true,
        },
      });
    }
  }
  for (const propertyId of [
    'seed-property-maple',
    'seed-property-harbor',
    'seed-property-cedar',
    'seed-property-elm',
  ]) {
    await prisma.payout.upsert({
      where: { id: `seed-payout-${propertyId}-2026-09` },
      update: {},
      create: {
        id: `seed-payout-${propertyId}-2026-09`,
        organizationId,
        propertyId,
        month: '2026-09',
        provider: 'mock',
        providerReference: `seed:payout:${propertyId}:2026-09`,
        amount: 1000,
        status: 'paid',
        arrivalDate: date('2026-09-18'),
      },
    });
  }
  await seedPortfolioDetails();
  await seedMaintenance();
  console.log(
    'Seeded 4 properties, 45 units, 41 occupied leases, 4 applications, charges, payments, autopay and property payouts.',
  );
}

async function seedPortfolioDetails() {
  const storage = createStorageAdapter(process.env);
  const alexLease = 'seed-lease-maple-11';
  const alexTenant = 'seed-tenant-maple-11';

  // Alex Rivera: a full ledger (every month since move-in charged and paid), so his pages are populated.
  for (let month = '2025-12'; month <= '2026-10'; month = addMonths(month, 1)) {
    const description = rentKey(alexLease, month);
    const existing = await prisma.charge.findFirst({
      where: { organizationId, leaseId: alexLease, description },
    });
    if (!existing) {
      await prisma.charge.create({
        data: {
          organizationId,
          leaseId: alexLease,
          kind: 'RENT',
          amount: 1850,
          dueDate: monthStart(month),
          description,
        },
      });
    }
    await prisma.payment.upsert({
      where: { id: `seed-payment-alex-${month}` },
      update: {},
      create: {
        id: `seed-payment-alex-${month}`,
        organizationId,
        leaseId: alexLease,
        amount: 1850,
        status: PaymentStatus.SUCCEEDED,
        providerReference: `mock-payment-alex-${month}`,
        paidAt: date(`${month}-03`),
      },
    });
  }

  // Tenant notes.
  const notes = [
    {
      id: 'seed-note-alex-1',
      tenantId: alexTenant,
      body: 'Asked about a second parking permit. Told him to email the request.',
      at: '2026-09-12T15:30:00.000Z',
    },
    {
      id: 'seed-note-alex-2',
      tenantId: alexTenant,
      body: 'Kitchen sink leak reported; plumber scheduled for this week.',
      at: '2026-10-09T09:10:00.000Z',
    },
    {
      id: 'seed-note-sam-1',
      tenantId: 'seed-tenant-maple-6',
      body: 'Gave 60 days notice by email. Moving out November 30.',
      at: '2026-10-01T13:00:00.000Z',
    },
  ];
  for (const note of notes) {
    await prisma.tenantNote.upsert({
      where: { id: note.id },
      update: {},
      create: {
        id: note.id,
        organizationId,
        tenantId: note.tenantId,
        authorName: 'Jordan Mills',
        body: note.body,
        createdAt: new Date(note.at),
      },
    });
  }

  // Lease activity: per-signer e-sign events and notice.
  const events = [
    {
      id: 'seed-event-alex-1',
      kind: 'CREATED',
      at: '2025-11-20T10:00:00.000Z',
      message: 'Created from wizard',
    },
    {
      id: 'seed-event-alex-2',
      kind: 'SENT',
      at: '2025-11-21T09:00:00.000Z',
      message: 'Sent to alex.rivera@email.com',
      tenantId: alexTenant,
    },
    {
      id: 'seed-event-alex-3',
      kind: 'SIGNED',
      at: '2025-11-24T17:42:00.000Z',
      tenantId: alexTenant,
    },
    {
      id: 'seed-event-alex-4',
      kind: 'COMPLETED',
      at: '2025-11-24T17:42:00.000Z',
      message: 'Signed lease agreement.pdf',
    },
  ] as const;
  for (const event of events) {
    await prisma.leaseEvent.upsert({
      where: { id: event.id },
      update: {},
      create: {
        id: event.id,
        organizationId,
        leaseId: alexLease,
        kind: event.kind,
        tenantId: 'tenantId' in event ? event.tenantId : null,
        message: 'message' in event ? event.message : null,
        actorName: event.kind === 'CREATED' ? 'Jordan Mills' : null,
        createdAt: new Date(event.at),
      },
    });
  }
  await prisma.leaseEvent.upsert({
    where: { id: 'seed-event-sam-notice' },
    update: {},
    create: {
      id: 'seed-event-sam-notice',
      organizationId,
      leaseId: 'seed-lease-maple-6',
      kind: 'NOTICE_GIVEN',
      actorName: 'Jordan Mills',
      message: 'Planned move-out 2026-11-30',
      createdAt: new Date('2026-10-01T13:00:00.000Z'),
    },
  });

  // Documents: stored in the configured storage so previews and downloads work.
  const leasePdf = buildLeasePdf([
    `Lease: ${alexLease}`,
    'Premises: Maple Court - Unit 4B',
    'Tenants: Alex Rivera',
    'Term: Dec 1, 2025 - Nov 30, 2026',
    'Monthly rent: $1850 - Deposit: $1850',
    'Signed electronically via RocketRental (mock e-signature).',
    'Signer: Alex Rivera - signed',
  ]);
  const inspectionPdf = buildLeasePdf([
    'Move-in inspection report',
    'Premises: Maple Court - Unit 4B',
    'Inspected: Dec 1, 2025',
    'Kitchen: good. Bathroom: good. Floors: minor scuff near entry.',
  ]);
  const idPdf = buildLeasePdf(['Photo ID on file', 'Tenant: Alex Rivera', 'Verified Nov 20, 2025']);
  const documents = [
    {
      id: 'seed-doc-alex-lease',
      leaseId: alexLease,
      kind: 'LEASE' as const,
      name: 'Signed lease agreement.pdf',
      mimeType: 'application/pdf',
      body: leasePdf,
      createdAt: '2025-11-24T17:42:00.000Z',
    },
    {
      id: 'seed-doc-alex-inspection',
      leaseId: alexLease,
      kind: 'INSPECTION' as const,
      name: 'Move-in inspection.pdf',
      mimeType: 'application/pdf',
      body: inspectionPdf,
      createdAt: '2025-12-01T16:00:00.000Z',
    },
    {
      id: 'seed-doc-alex-id',
      leaseId: alexLease,
      kind: 'ID' as const,
      name: 'Photo ID.pdf',
      mimeType: 'application/pdf',
      body: idPdf,
      createdAt: '2025-11-20T11:00:00.000Z',
    },
    {
      id: 'seed-doc-maple-cover',
      propertyId: 'seed-property-maple',
      kind: 'PHOTO' as const,
      name: 'maple-court-front.png',
      mimeType: 'image/png',
      body: gradientPng([201, 223, 255], [58, 94, 168]),
      isCover: true,
      caption: 'Maple Court street view',
      createdAt: '2025-06-01T12:00:00.000Z',
    },
    {
      id: 'seed-doc-maple-lobby',
      propertyId: 'seed-property-maple',
      kind: 'PHOTO' as const,
      name: 'maple-court-lobby.png',
      mimeType: 'image/png',
      body: gradientPng([255, 226, 189], [168, 112, 58]),
      caption: 'Lobby',
      createdAt: '2025-06-02T12:00:00.000Z',
    },
    {
      id: 'seed-doc-unit-4b-photo',
      unitId: 'seed-unit-maple-11',
      kind: 'PHOTO' as const,
      name: 'unit-4b-living-room.png',
      mimeType: 'image/png',
      body: gradientPng([214, 240, 214], [74, 140, 96]),
      isCover: true,
      caption: 'Living room',
      createdAt: '2025-11-15T12:00:00.000Z',
    },
  ];
  for (const doc of documents) {
    const { body, createdAt, id, ...fields } = doc;
    const storageKey = `seed/${id}`;
    await storage.put(storageKey, body, doc.mimeType);
    const data = { ...fields, storageKey, sizeBytes: body.byteLength };
    await prisma.document.upsert({
      where: { id },
      update: data,
      create: { id, organizationId, ...data, createdAt: new Date(createdAt) },
    });
  }
}

async function seedMaintenance() {
  const storage = createStorageAdapter(process.env);
  const vendors = [
    { id: 'seed-vendor-northstar', name: 'Northstar Repairs', trade: 'General repairs' },
    { id: 'seed-vendor-brightline', name: 'Brightline HVAC', trade: 'Heating and cooling' },
    { id: 'seed-vendor-keyline', name: 'Keyline Services', trade: 'Locks and doors' },
  ];
  for (const vendor of vendors) {
    await prisma.vendor.upsert({
      where: { id: vendor.id },
      update: { name: vendor.name, trade: vendor.trade },
      create: { ...vendor, organizationId },
    });
  }
  const requests = [
    {
      id: 'seed-request-maple-4b',
      propertyId: 'seed-property-maple',
      unitId: 'seed-unit-maple-11',
      tenantId: 'seed-tenant-maple-11',
      title: 'Kitchen sink leak',
      priority: 'URGENT',
      status: 'NEW',
      at: '2026-10-14T08:00:00.000Z',
      colors: [
        [191, 211, 225],
        [104, 140, 163],
      ],
    },
    {
      id: 'seed-maint-light',
      propertyId: 'seed-property-elm',
      unitId: 'seed-unit-elm-1',
      title: 'Hallway light flickering',
      priority: 'NORMAL',
      status: 'NEW',
      at: '2026-10-13T09:00:00.000Z',
      colors: [
        [228, 226, 204],
        [149, 151, 144],
      ],
    },
    {
      id: 'seed-maint-window',
      propertyId: 'seed-property-harbor',
      unitId: 'seed-unit-harbor-12',
      title: 'Window latch loose',
      priority: 'NORMAL',
      status: 'ASSIGNED',
      vendorId: 'seed-vendor-northstar',
      vendorName: 'Northstar Repairs',
      at: '2026-10-11T10:00:00.000Z',
      colors: [
        [216, 224, 233],
        [143, 158, 176],
      ],
    },
    {
      id: 'seed-maint-ac',
      propertyId: 'seed-property-cedar',
      unitId: 'seed-unit-cedar-3',
      title: 'AC not cooling',
      priority: 'HIGH',
      status: 'IN_PROGRESS',
      vendorId: 'seed-vendor-brightline',
      vendorName: 'Brightline HVAC',
      at: '2026-10-10T12:00:00.000Z',
      colors: [
        [206, 223, 232],
        [126, 159, 175],
      ],
    },
    {
      id: 'seed-maint-tile',
      propertyId: 'seed-property-maple',
      unitId: 'seed-unit-maple-6',
      title: 'Bathroom tile repair',
      priority: 'NORMAL',
      status: 'IN_PROGRESS',
      vendorId: 'seed-vendor-northstar',
      vendorName: 'Northstar Repairs',
      at: '2026-10-09T13:00:00.000Z',
      colors: [
        [223, 223, 218],
        [159, 161, 157],
      ],
    },
    {
      id: 'seed-maint-lock',
      propertyId: 'seed-property-harbor',
      unitId: 'seed-unit-harbor-8',
      title: 'Entry door lock replaced',
      priority: 'NORMAL',
      status: 'DONE',
      vendorId: 'seed-vendor-keyline',
      vendorName: 'Keyline Services',
      at: '2026-10-08T09:00:00.000Z',
      completedAt: '2026-10-12T12:00:00.000Z',
      colors: [
        [212, 221, 223],
        [123, 143, 149],
      ],
    },
  ] as const;
  for (const request of requests) {
    const { at, colors, ...fields } = request;
    await prisma.maintenanceRequest.upsert({
      where: { id: fields.id },
      update: { tenantId: 'tenantId' in fields ? fields.tenantId : null },
      create: {
        ...fields,
        organizationId,
        priority: fields.priority,
        status: fields.status,
        vendorId: 'vendorId' in fields ? fields.vendorId : null,
        vendorName: 'vendorName' in fields ? fields.vendorName : null,
        tenantId: 'tenantId' in fields ? fields.tenantId : null,
        completedAt: 'completedAt' in fields ? new Date(fields.completedAt) : null,
        createdAt: new Date(at),
      },
    });
    const image = gradientPng(
      colors[0] as [number, number, number],
      colors[1] as [number, number, number],
    );
    const documentId = `${request.id}-photo`;
    const storageKey = `seed/${documentId}`;
    await storage.put(storageKey, image, 'image/png');
    await prisma.document.upsert({
      where: { id: documentId },
      update: {},
      create: {
        id: documentId,
        organizationId,
        unitId: request.unitId,
        kind: 'PHOTO',
        name: `${request.id}.png`,
        storageKey,
        sizeBytes: BigInt(image.byteLength),
        mimeType: 'image/png',
        createdAt: new Date(at),
      },
    });
    await prisma.maintenancePhoto.upsert({
      where: { id: `${request.id}-attachment` },
      update: {},
      create: {
        id: `${request.id}-attachment`,
        organizationId,
        maintenanceRequestId: request.id,
        documentId,
        storageKey,
        sizeBytes: BigInt(image.byteLength),
        mimeType: 'image/png',
        createdAt: new Date(at),
      },
    });
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
