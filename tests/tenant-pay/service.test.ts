import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  applyPaymentWebhook,
  computeBalance,
  toLedgerCharge,
  toLedgerPayment,
} from '../../src/lib/ledger';
import { MockPaymentsProvider } from '../../src/lib/providers/mock';
import { loadTenantPayView, payRent, setAutopay } from '../../src/lib/tenant-pay';

/**
 * Database-backed flow, mirroring tests/ledger/store.test.ts. Runs only with
 * RUN_DB_INTEGRATION=1 against a migrated, disposable database (DATABASE_URL).
 */
describe.skipIf(process.env.RUN_DB_INTEGRATION !== '1')('tenant pay (PostgreSQL)', () => {
  const prisma = new PrismaClient();
  const org = `test-tenant-pay-${randomUUID()}`;
  const provider = new MockPaymentsProvider();
  const now = new Date('2026-10-14T15:00:00.000Z');
  let leaseId = '';
  let tenantId = '';

  beforeAll(async () => {
    await prisma.organization.create({ data: { id: org, name: 'Tenant pay test' } });
    const property = await prisma.property.create({
      data: {
        organizationId: org,
        name: 'Maple Court',
        type: 'MULTI_UNIT',
        street: '1 Maple St',
        city: 'Austin',
        state: 'TX',
        postalCode: '78701',
      },
    });
    const unit = await prisma.unit.create({
      data: { organizationId: org, propertyId: property.id, number: '4B', status: 'OCCUPIED' },
    });
    const tenant = await prisma.tenant.create({
      data: { organizationId: org, name: 'Alex Rivera', email: 'alex.rivera@email.com' },
    });
    tenantId = tenant.id;
    const lease = await prisma.lease.create({
      data: {
        organizationId: org,
        unitId: unit.id,
        startDate: new Date('2026-01-01T00:00:00.000Z'),
        endDate: new Date('2026-12-31T00:00:00.000Z'),
        monthlyRent: '1850.00',
        deposit: '1850.00',
        lateFee: '75.00',
        graceDays: 5,
        status: 'ACTIVE',
      },
    });
    leaseId = lease.id;
    await prisma.leaseTenant.create({
      data: { leaseId, tenantId, organizationId: org, isPrimary: true },
    });
    // October rent exists and is settled, so the portal bills November ($1,850).
    await prisma.charge.create({
      data: {
        organizationId: org,
        leaseId,
        kind: 'RENT',
        amount: '1850.00',
        dueDate: new Date('2026-10-01T00:00:00.000Z'),
        description: `rent:${leaseId}:2026-10`,
      },
    });
    await prisma.payment.create({
      data: {
        organizationId: org,
        leaseId,
        amount: '1850.00',
        status: 'SUCCEEDED',
        providerReference: `mock-payment-oct-${leaseId}`,
        paidAt: new Date('2026-10-03T00:00:00.000Z'),
      },
    });
  });

  afterAll(async () => {
    await prisma.organization.delete({ where: { id: org } });
    await prisma.$disconnect();
  });

  it('shows only the tenant own lease with November $1,850 due', async () => {
    const view = await loadTenantPayView(org, tenantId, now, prisma);
    expect(view?.leaseId).toBe(leaseId);
    expect(view?.amountDue.totalDueCents).toBe(185_000);
    expect(view?.amountDue.billingMonth).toBe('2026-11');
    expect(view?.receipts[0]).toMatchObject({ label: 'October rent', statusLabel: 'Paid' });
    // Another tenant id sees nothing.
    expect(await loadTenantPayView(org, 'someone-else', now, prisma)).toBeNull();
  });

  it('pays $1,850 by card through the mock provider and settles the ledger', async () => {
    const result = await payRent(
      {
        organizationId: org,
        tenantId,
        leaseId,
        amountCents: 185_000,
        method: 'card',
        providerToken: 'tok_mock_card_4242',
        idempotencyKey: `pay-card-${leaseId}`,
        saveMethod: true,
      },
      { client: prisma, provider, now },
    );
    expect(result).toMatchObject({ status: 'SUCCEEDED', duplicate: false, feeCents: 5_365 });
    expect(result.chargedCents).toBe(190_365);

    const [charges, payments] = await Promise.all([
      prisma.charge.findMany({ where: { organizationId: org, leaseId } }),
      prisma.payment.findMany({ where: { organizationId: org, leaseId } }),
    ]);
    const balance = computeBalance(charges.map(toLedgerCharge), payments.map(toLedgerPayment));
    expect(balance.outstandingCents).toBe(0);

    const view = await loadTenantPayView(org, tenantId, now, prisma);
    expect(view?.amountDue.totalDueCents).toBe(0);
    expect(view?.receipts[0]).toMatchObject({ label: 'October rent', amountCents: 185_000 });
    expect(view?.methods).toHaveLength(1);
    // Only token display metadata is stored, never card details.
    const stored = await prisma.paymentMethod.findFirstOrThrow({
      where: { organizationId: org, tenantId },
    });
    expect(stored.providerToken).toMatch(/^pm_/);
    expect(stored.last4).toBe('4242');

    // Replaying the same submission charges nothing twice.
    const replay = await payRent(
      {
        organizationId: org,
        tenantId,
        leaseId,
        amountCents: 185_000,
        method: 'card',
        providerToken: 'tok_mock_card_4242',
        idempotencyKey: `pay-card-${leaseId}`,
      },
      { client: prisma, provider, now },
    );
    expect(replay.duplicate).toBe(true);
  });

  it('rejects raw card numbers and payments on another tenant lease', async () => {
    await expect(
      payRent(
        {
          organizationId: org,
          tenantId,
          leaseId,
          amountCents: 100,
          method: 'card',
          providerToken: '4242424242424242',
          idempotencyKey: 'raw-card',
        },
        { client: prisma, provider, now },
      ),
    ).rejects.toThrow(/provider fields/);
    await expect(
      payRent(
        {
          organizationId: org,
          tenantId: 'someone-else',
          leaseId,
          amountCents: 100,
          method: 'card',
          providerToken: 'tok_mock_card_4242',
          idempotencyKey: 'foreign-lease',
        },
        { client: prisma, provider, now },
      ),
    ).rejects.toThrow(/Lease not found/);
  });

  it('keeps bank debits pending until the provider webhook settles them', async () => {
    // December rent on the same lease (November was settled by card above), paid by bank.
    await prisma.charge.create({
      data: {
        organizationId: org,
        leaseId,
        kind: 'RENT',
        amount: '1850.00',
        dueDate: new Date('2026-12-01T00:00:00.000Z'),
        description: `rent:${leaseId}:2026-12`,
      },
    });
    const result = await payRent(
      {
        organizationId: org,
        tenantId,
        leaseId,
        amountCents: 185_000,
        method: 'ach',
        providerToken: 'tok_mock_bank_6789',
        idempotencyKey: `pay-ach-${leaseId}`,
      },
      { client: prisma, provider, now },
    );
    expect(result).toMatchObject({ status: 'PENDING', feeCents: 0 });
    const payment = await prisma.payment.findFirstOrThrow({
      where: { organizationId: org, leaseId, providerReference: { startsWith: 'charge_' } },
      orderBy: { createdAt: 'desc' },
    });
    expect(payment.status).toBe('PENDING');

    const outcome = await applyPaymentWebhook(
      { provider: 'mock', organizationId: org, eventType: 'payment.succeeded' },
      JSON.stringify({ data: { providerReference: payment.providerReference } }),
      prisma,
    );
    expect(outcome).toEqual({ kind: 'payment', status: 'SUCCEEDED', updated: 1 });
    const settled = await prisma.payment.findUniqueOrThrow({ where: { id: payment.id } });
    expect(settled.status).toBe('SUCCEEDED');
    expect(settled.paidAt).not.toBeNull();
  });

  it('turns autopay on and off with a saved method', async () => {
    const method = await prisma.paymentMethod.findFirstOrThrow({
      where: { organizationId: org, tenantId },
    });
    await expect(
      setAutopay(
        { organizationId: org, tenantId, leaseId, enabled: true, paymentMethodId: 'missing' },
        { client: prisma },
      ),
    ).rejects.toThrow(/not found/);
    expect(
      await setAutopay(
        { organizationId: org, tenantId, leaseId, enabled: true, paymentMethodId: method.id },
        { client: prisma },
      ),
    ).toEqual({ enabled: true });
    const view = await loadTenantPayView(org, tenantId, now, prisma);
    expect(view?.autopay.enabled).toBe(true);
    expect(
      await setAutopay(
        { organizationId: org, tenantId, leaseId, enabled: false },
        { client: prisma },
      ),
    ).toEqual({ enabled: false });
  });
});
