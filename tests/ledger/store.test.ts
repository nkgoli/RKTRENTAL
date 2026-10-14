import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  applyLateFee,
  applyPaymentWebhook,
  ensureRentCharges,
  loadPaymentsOverview,
  recordPayment,
  refundPayment,
  runOwnerPayouts,
  ownerPayouts,
  referenceFromPayload,
} from '../../src/lib/ledger';
import { MockPaymentsProvider } from '../../src/lib/providers/mock';

const d = (value: string) => new Date(`${value}T00:00:00.000Z`);
const asOf = new Date('2026-10-14T15:00:00.000Z');

describe('webhook payload parsing', () => {
  it('reads the provider reference per provider and event type', () => {
    expect(
      referenceFromPayload('mock', 'payment.succeeded', '{"data":{"providerReference":"pay_1"}}'),
    ).toBe('pay_1');
    const stripe = (type: string) =>
      referenceFromPayload(
        'stripe',
        type,
        '{"data":{"object":{"id":"ch_1","payment_intent":"pi_1"}}}',
      );
    expect(stripe('payment_intent.succeeded')).toBe('ch_1');
    expect(stripe('charge.refunded')).toBe('pi_1');
    expect(referenceFromPayload('mock', 'payment.succeeded', 'not json')).toBeNull();
    expect(referenceFromPayload('mock', 'payment.succeeded', '{}')).toBeNull();
  });
});

describe.skipIf(process.env.RUN_DB_INTEGRATION !== '1')('ledger store (PostgreSQL)', () => {
  const prisma = new PrismaClient();
  const org = `test-ledger-${randomUUID()}`;
  const provider = new MockPaymentsProvider();

  beforeAll(async () => {
    await prisma.organization.create({ data: { id: org, name: 'Ledger test' } });
    await prisma.user.create({
      data: {
        id: `${org}-owner`,
        organizationId: org,
        email: 'o@x.test',
        name: 'Owner',
        role: 'OWNER',
      },
    });
    await prisma.property.create({
      data: {
        id: `${org}-p`,
        organizationId: org,
        ownerId: `${org}-owner`,
        name: 'Test Court',
        type: 'MULTI_UNIT',
        street: '1 Main',
        city: 'Austin',
        state: 'TX',
        postalCode: '78701',
      },
    });
    for (const n of ['1', '2']) {
      await prisma.unit.create({
        data: { id: `${org}-u${n}`, organizationId: org, propertyId: `${org}-p`, number: n },
      });
      await prisma.lease.create({
        data: {
          id: `${org}-l${n}`,
          organizationId: org,
          unitId: `${org}-u${n}`,
          startDate: d('2026-01-01'),
          endDate: d('2026-12-31'),
          monthlyRent: n === '1' ? '1850.00' : '1200.00',
          deposit: '1000.00',
          lateFee: '75.00',
          graceDays: 5,
          status: 'ACTIVE',
        },
      });
    }
  });

  afterAll(async () => {
    await prisma.organization.deleteMany({ where: { id: org } });
    await prisma.$disconnect();
  });

  const L1 = `${org}-l1`;
  const L2 = `${org}-l2`;
  const rows = async (leaseId: string) =>
    (await loadPaymentsOverview(org, '2026-10', asOf, prisma)).rows.find(
      (r) => r.leaseId === leaseId,
    );

  it('creates monthly rent charges once per lease, however often it runs', async () => {
    expect(await ensureRentCharges(org, asOf, prisma)).toBe(2);
    expect(await ensureRentCharges(org, asOf, prisma)).toBe(0);
    await Promise.all([ensureRentCharges(org, asOf, prisma), ensureRentCharges(org, asOf, prisma)]);
    const charges = await prisma.charge.findMany({ where: { organizationId: org } });
    expect(charges).toHaveLength(2);
    expect(charges.map((c) => c.amount.toString()).sort()).toEqual(['1200', '1850']);
    expect((await rows(L1))?.status).toBe('LATE');
  });

  it('records a payment once per idempotency key and applies it to the balance', async () => {
    const key = randomUUID();
    const first = await recordPayment(
      { organizationId: org, leaseId: L1, amountCents: 100000, idempotencyKey: key, paidAt: asOf },
      prisma,
    );
    const again = await recordPayment(
      { organizationId: org, leaseId: L1, amountCents: 100000, idempotencyKey: key },
      prisma,
    );
    expect(again).toEqual({ paymentId: first.paymentId, duplicate: true });
    await expect(
      recordPayment(
        { organizationId: org, leaseId: L1, amountCents: 5, idempotencyKey: key },
        prisma,
      ),
    ).rejects.toThrow('different payment');
    await expect(
      recordPayment(
        { organizationId: 'other-org', leaseId: L1, amountCents: 5, idempotencyKey: 'x' },
        prisma,
      ),
    ).rejects.toThrow('Lease not found');
    expect(await prisma.payment.count({ where: { leaseId: L1 } })).toBe(1);
    expect((await rows(L1))?.outstandingCents).toBe(85000);
  });

  it('applies the late fee once and adds it to the amount owed', async () => {
    const input = { organizationId: org, leaseId: L1, month: '2026-10', asOf };
    expect((await applyLateFee(input, prisma)).eligible).toBe(true);
    expect(await applyLateFee(input, prisma)).toEqual({
      eligible: false,
      reason: 'already-applied',
    });
    expect((await rows(L1))?.outstandingCents).toBe(92500);
    expect(await prisma.charge.count({ where: { leaseId: L1, kind: 'LATE_FEE' } })).toBe(1);
    const early = await applyLateFee({ ...input, leaseId: L2, asOf: d('2026-10-03') }, prisma);
    expect(early).toEqual({ eligible: false, reason: 'in-grace' });
  });

  it('refunds a manual payment in part and then in full without double counting', async () => {
    const { paymentId } = await recordPayment(
      {
        organizationId: org,
        leaseId: L2,
        amountCents: 120000,
        idempotencyKey: 'l2-full',
        paidAt: asOf,
      },
      prisma,
    );
    expect((await rows(L2))?.status).toBe('PAID');
    const partial = { organizationId: org, paymentId, amountCents: 20000, idempotencyKey: 'r1' };
    expect(await refundPayment(partial, { client: prisma })).toEqual({
      refundedCents: 20000,
      duplicate: false,
    });
    expect(await refundPayment(partial, { client: prisma })).toMatchObject({ duplicate: true });
    const parts = await prisma.payment.findMany({
      where: { leaseId: L2 },
      orderBy: { amount: 'desc' },
    });
    expect(parts.map((p) => [p.amount.toString(), p.status])).toEqual([
      ['1000', 'SUCCEEDED'],
      ['200', 'REFUNDED'],
    ]);
    expect((await rows(L2))?.outstandingCents).toBe(20000);
    expect(
      await refundPayment(
        { organizationId: org, paymentId, idempotencyKey: 'r2' },
        { client: prisma },
      ),
    ).toEqual({ refundedCents: 100000, duplicate: false });
    expect(
      await refundPayment(
        { organizationId: org, paymentId, idempotencyKey: 'r2' },
        { client: prisma },
      ),
    ).toMatchObject({ duplicate: true });
    expect((await rows(L2))?.outstandingCents).toBe(120000);
  });

  it('sends provider refunds through the adapter with a stable idempotency key', async () => {
    const calls: unknown[] = [];
    const spy = Object.assign(Object.create(provider), {
      refund: async (input: unknown) => {
        calls.push(input);
        return provider.refund(input as Parameters<typeof provider.refund>[0]);
      },
    }) as MockPaymentsProvider;
    const payment = await prisma.payment.create({
      data: {
        organizationId: org,
        leaseId: L2,
        amount: '50.00',
        status: 'SUCCEEDED',
        providerReference: `mock-${randomUUID()}`,
        paidAt: asOf,
      },
    });
    await refundPayment(
      { organizationId: org, paymentId: payment.id, idempotencyKey: 'p1' },
      { client: prisma, provider: spy },
    );
    expect(calls).toEqual([
      expect.objectContaining({ amountCents: 5000, idempotencyKey: `refund:${payment.id}:p1` }),
    ]);
  });

  it('pays owners per property once for the same collected money', async () => {
    const before = (await ownerPayouts(org, '2026-10', prisma)).find(
      (p) => p.propertyId === `${org}-p`,
    );
    expect(before?.collectedCents).toBe(100000);
    expect(before?.readyCents).toBe(100000);
    expect(await runOwnerPayouts(org, '2026-10', { client: prisma, provider })).toMatchObject({
      sent: expect.any(Number),
    });
    const sent = await prisma.payout.findMany({ where: { organizationId: org } });
    expect(sent.map((p) => p.amount.toString())).toEqual(['1000']);
    expect(await runOwnerPayouts(org, '2026-10', { client: prisma, provider })).toEqual({
      sent: 0,
      totalCents: 0,
    });
    await recordPayment(
      {
        organizationId: org,
        leaseId: L1,
        amountCents: 30000,
        idempotencyKey: 'late',
        paidAt: asOf,
      },
      prisma,
    );
    const next = (await ownerPayouts(org, '2026-10', prisma)).find(
      (p) => p.propertyId === `${org}-p`,
    );
    expect(next).toMatchObject({ collectedCents: 130000, paidOutCents: 100000, readyCents: 30000 });
    await runOwnerPayouts(org, '2026-10', { client: prisma, provider });
    expect(await prisma.payout.count({ where: { organizationId: org } })).toBe(2);
  });

  it('updates payment status from webhooks, only moving forward', async () => {
    const ref = `mock-${randomUUID()}`;
    const payment = await prisma.payment.create({
      data: {
        organizationId: org,
        leaseId: L1,
        amount: '10.00',
        status: 'PENDING',
        providerReference: ref,
      },
    });
    const body = (type: string) =>
      JSON.stringify({
        id: randomUUID(),
        type,
        organizationId: org,
        data: { providerReference: ref },
      });
    const event = (eventType: string) => ({
      provider: 'mock' as const,
      organizationId: org,
      eventType,
    });
    const status = async () =>
      (await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).status;

    expect(
      await applyPaymentWebhook(event('payment.succeeded'), body('payment.succeeded'), prisma),
    ).toEqual({
      kind: 'payment',
      status: 'SUCCEEDED',
      updated: 1,
    });
    expect(await status()).toBe('SUCCEEDED');
    expect(
      (await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } })).paidAt,
    ).not.toBeNull();
    // Replays and out-of-order failures are ignored once settled.
    expect(
      await applyPaymentWebhook(event('payment.succeeded'), body('payment.succeeded'), prisma),
    ).toMatchObject({ updated: 0 });
    expect(
      await applyPaymentWebhook(event('payment.failed'), body('payment.failed'), prisma),
    ).toMatchObject({ updated: 0 });
    expect(await status()).toBe('SUCCEEDED');
    await applyPaymentWebhook(event('payment.refunded'), body('payment.refunded'), prisma);
    expect(await status()).toBe('REFUNDED');
    expect(
      await applyPaymentWebhook(event('customer.created'), body('customer.created'), prisma),
    ).toEqual({ kind: 'ignored' });
  });

  it('does not let one organization update another organization payment', async () => {
    const ref = `mock-${randomUUID()}`;
    await prisma.payment.create({
      data: {
        organizationId: org,
        leaseId: L1,
        amount: '10.00',
        status: 'PENDING',
        providerReference: ref,
      },
    });
    const outcome = await applyPaymentWebhook(
      { provider: 'mock', organizationId: 'someone-else', eventType: 'payment.succeeded' },
      JSON.stringify({ data: { providerReference: ref } }),
      prisma,
    );
    expect(outcome).toMatchObject({ updated: 0 });
    expect(
      (await prisma.payment.findUniqueOrThrow({ where: { providerReference: ref } })).status,
    ).toBe('PENDING');
  });

  it('marks a failed ACH debit and a settled payout from webhooks', async () => {
    const ref = `mock-${randomUUID()}`;
    await prisma.payment.create({
      data: {
        organizationId: org,
        leaseId: L2,
        amount: '10.00',
        status: 'PENDING',
        providerReference: ref,
      },
    });
    await applyPaymentWebhook(
      { provider: 'mock', organizationId: org, eventType: 'payment.failed' },
      JSON.stringify({ data: { providerReference: ref } }),
      prisma,
    );
    expect(
      (await prisma.payment.findUniqueOrThrow({ where: { providerReference: ref } })).status,
    ).toBe('FAILED');

    const payout = await prisma.payout.findFirstOrThrow({ where: { organizationId: org } });
    await prisma.payout.update({
      where: { id: payout.id },
      data: { status: `pending|property:${org}-p|period:2026-10` },
    });
    const outcome = await applyPaymentWebhook(
      { provider: 'mock', organizationId: org, eventType: 'payout.paid' },
      JSON.stringify({ data: { providerReference: payout.providerReference } }),
      prisma,
    );
    expect(outcome).toEqual({ kind: 'payout', status: 'paid', updated: 1 });
    expect((await prisma.payout.findUniqueOrThrow({ where: { id: payout.id } })).status).toBe(
      `paid|property:${org}-p|period:2026-10`,
    );
  });
});
