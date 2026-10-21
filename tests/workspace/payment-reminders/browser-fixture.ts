/** Dedicated local synthetic browser data. Never run against a production database. */
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../../../src/lib/auth/password';
import { rentKey } from '../../../src/lib/ledger/core';

const db = new PrismaClient();
const org = 'synthetic-reminder-browser';
if (!process.env.DATABASE_URL?.includes('localhost:55491/'))
  throw new Error('Requires the dedicated local reminder check database on port 55491');
async function main() {
  try {
    await db.organization.upsert({
      where: { id: org },
      update: {},
      create: { id: org, name: 'Synthetic reminder browser checks' },
    });
    await db.user.upsert({
      where: { id: `${org}-manager` },
      update: {},
      create: {
        id: `${org}-manager`,
        organizationId: org,
        name: 'Synthetic Manager',
        email: 'reminder-manager@example.invalid',
        passwordHash: await hashPassword('SyntheticReminder#2026'),
        role: 'MANAGER',
      },
    });
    await db.property.upsert({
      where: { id: org },
      update: {},
      create: {
        id: org,
        organizationId: org,
        name: 'Synthetic Court',
        type: 'MULTI_UNIT',
        street: '1 Test Street',
        city: 'Austin',
        state: 'TX',
        postalCode: '00000',
      },
    });
    for (const [index, label] of ['Arrears', 'Cotenant', 'Paid', 'Contact checks'].entries()) {
      const id = `${org}-${index + 1}`;
      if (await db.lease.findUnique({ where: { id } })) continue;
      await db.unit.create({
        data: {
          id,
          organizationId: org,
          propertyId: org,
          number: label,
          status: index === 0 ? 'VACANT' : 'OCCUPIED',
          listedRent: '1000',
        },
      });
      const tenants = await Promise.all(
        Array.from({ length: index === 1 ? 2 : 1 }, (_, n) =>
          db.tenant.create({
            data: {
              id: `${id}-${n}`,
              organizationId: org,
              name:
                index === 1
                  ? ['Synthetic Alice', 'Synthetic Bob'][n]
                  : index === 3
                    ? 'Synthetic Opt-out'
                    : `Synthetic Resident ${index + 1}`,
              email: `${id}-${n}@example.invalid`,
              phone: index === 3 ? 'invalid' : n === 1 ? '+15005550007' : '+15005550006',
              emailRemindersEnabled: index !== 3,
              smsRemindersEnabled: true,
            },
          }),
        ),
      );
      const month = index === 0 ? '2026-09' : '2026-10';
      await db.lease.create({
        data: {
          id,
          organizationId: org,
          unitId: id,
          status: index === 0 ? 'ENDED' : 'ACTIVE',
          monthlyRent: '1000',
          deposit: '0',
          graceDays: 3,
          startDate: new Date(`${month}-01`),
          endDate: new Date(index === 0 ? '2026-09-30' : '2027-09-30'),
          tenants: { create: tenants.map((t, n) => ({ tenantId: t.id, isPrimary: n === 0 })) },
          charges: {
            create: [
              {
                kind: 'RENT',
                amount: '1000',
                dueDate: new Date(`${month}-01`),
                description: rentKey(id, month),
              },
              ...(index === 0
                ? [{ kind: 'LATE_FEE' as const, amount: '50', dueDate: new Date('2026-09-05') }]
                : []),
            ],
          },
          payments:
            index === 0 || index === 2
              ? {
                  create: [
                    {
                      status: 'SUCCEEDED',
                      amount: index === 0 ? '200' : '1000',
                      paidAt: new Date('2026-10-05'),
                    },
                  ],
                }
              : undefined,
        },
      });
    }
    console.log(
      'Dedicated synthetic reminder browser fixtures ready (four units; no live transport).',
    );
  } finally {
    await db.$disconnect();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
