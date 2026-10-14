import { describe, expect, it, vi } from 'vitest';
import {
  MockCompsProvider,
  MockPaymentsProvider,
  MockRentometerProvider,
  MockScreeningProvider,
} from '../../src/lib/providers/mock';
import { StripeTestPaymentsProvider } from '../../src/lib/providers/stripe';

describe('mock adapters', () => {
  it('uses provider tokens and idempotency keys for payments', async () => {
    const provider = new MockPaymentsProvider();
    const customer = await provider.createCustomer({
      organizationId: 'org-1',
      name: 'Alex Rivera',
      email: 'alex@example.com',
    });
    const method = await provider.attachPaymentMethod({
      customerId: customer.id,
      providerToken: 'pm_test_123',
      type: 'card',
    });
    const input = {
      customerId: customer.id,
      paymentMethodToken: method.id,
      type: 'card' as const,
      money: { amountCents: 185000, currency: 'usd' as const },
      idempotencyKey: 'rent-1',
    };
    expect(await provider.charge(input)).toEqual(await provider.charge(input));
    expect((await provider.charge({ ...input, type: 'ach', idempotencyKey: 'ach-1' })).status).toBe(
      'pending',
    );
    await expect(
      provider.attachPaymentMethod({
        customerId: customer.id,
        providerToken: '4111111111111111',
        type: 'card',
      }),
    ).rejects.toThrow();
    expect((await provider.refund({ chargeId: 'ch_1', idempotencyKey: 'refund-1' })).status).toBe(
      'succeeded',
    );
    expect((await provider.payout({ money: input.money, idempotencyKey: 'payout-1' })).status).toBe(
      'pending',
    );
  });

  it('requires consent before requesting screening and returns a report', async () => {
    const provider = new MockScreeningProvider();
    const request = {
      applicationId: 'app-1',
      applicantName: 'Olivia Reed',
      applicantEmail: 'olivia@example.com',
      consent: { consentedAt: new Date('2026-10-08'), version: 'v1' },
    };
    const result = await provider.request(request);
    expect(await provider.status(result.id)).toBe('complete');
    expect((await provider.report(result.id)).creditScore).toBe(742);
    await expect(
      provider.request({ ...request, consent: { ...request.consent, revokedAt: new Date() } }),
    ).rejects.toThrow('consent');
  });

  it('returns bounded comparable rentals', async () => {
    const comps = await new MockCompsProvider().search({
      postalCode: '78704',
      bedrooms: 2,
      limit: 12,
    });
    expect(comps).toHaveLength(10);
    expect(comps[0].monthlyRentCents).toBeGreaterThan(0);
    const rentometer = new MockRentometerProvider(1);
    expect(rentometer.name).toBe('rentometer');
    expect((await rentometer.search({ postalCode: '78704', bedrooms: 2, limit: 10 })).length).toBe(
      3,
    );
  });
});

describe('Stripe test adapter', () => {
  it('requires a test key and sends tokens to Stripe with idempotency', async () => {
    expect(() => new StripeTestPaymentsProvider('sk_live_bad')).toThrow();
    const fetcher = vi.fn(
      async () =>
        new Response(JSON.stringify({ id: 'pi_test_1', status: 'succeeded' }), { status: 200 }),
    );
    const provider = new StripeTestPaymentsProvider('sk_test_example', fetcher as typeof fetch);
    const result = await provider.charge({
      customerId: 'cus_test',
      paymentMethodToken: 'pm_test',
      type: 'card',
      money: { amountCents: 185000, currency: 'usd' },
      idempotencyKey: 'charge-1',
    });
    expect(result).toEqual({ id: 'pi_test_1', status: 'succeeded' });
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.stripe.com/v1/payment_intents');
    expect((init.headers as Record<string, string>)['Idempotency-Key']).toBe('charge-1');
    expect(String(init.body)).toContain('payment_method=pm_test');
  });
});
