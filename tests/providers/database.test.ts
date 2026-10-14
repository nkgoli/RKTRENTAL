import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';

describe.skipIf(process.env.RUN_DB_INTEGRATION !== '1')('provider persistence', () => {
  const prisma = new PrismaClient();
  const organizationId = `test-provider-${randomUUID()}`;
  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: organizationId } });
    await prisma.$disconnect();
  });

  it('stores a webhook event once and ties it to a connected organization', async () => {
    await prisma.organization.create({ data: { id: organizationId, name: 'Provider test' } });
    await prisma.providerConnection.create({
      data: { organizationId, kind: 'PAYMENTS', provider: 'mock', status: 'CONNECTED' },
    });
    const event = {
      organizationId,
      provider: 'mock',
      externalEventId: `evt-${randomUUID()}`,
      eventType: 'payment.succeeded',
      payloadHash: 'a'.repeat(64),
    };
    await prisma.webhookEvent.create({ data: event });
    await expect(prisma.webhookEvent.create({ data: event })).rejects.toMatchObject({
      code: 'P2002',
    });
    expect(await prisma.webhookEvent.count({ where: { organizationId } })).toBe(1);
  });

  it('keeps the established portfolio counts while seeding four applications and payments', async () => {
    const demo = 'seed-rocket-rental';
    expect(
      await prisma.property.count({
        where: { organizationId: demo, id: { startsWith: 'seed-property-' } },
      }),
    ).toBe(4);
    expect(
      await prisma.unit.count({
        where: { organizationId: demo, id: { startsWith: 'seed-unit-' } },
      }),
    ).toBe(45);
    expect(
      await prisma.lease.count({
        where: { organizationId: demo, id: { startsWith: 'seed-lease-' }, status: 'ACTIVE' },
      }),
    ).toBe(41);
    expect(
      await prisma.application.count({
        where: { organizationId: demo, id: { startsWith: 'seed-application-' } },
      }),
    ).toBe(4);
    expect(
      await prisma.charge.count({
        where: { organizationId: demo, id: { startsWith: 'seed-charge-' }, kind: 'RENT' },
      }),
    ).toBe(123); // 41 active leases across August–October 2026
    expect(
      await prisma.payment.count({
        where: { organizationId: demo, id: { startsWith: 'seed-payment-' } },
      }),
    ).toBe(123);
  });
});
