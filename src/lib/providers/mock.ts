import { createHash } from 'node:crypto';
import type {
  Comparable,
  CompsProvider,
  PaymentsProvider,
  PaymentResult,
  ScreeningProvider,
  ScreeningReportResult,
  ScreeningState,
} from './types';

const mockId = (prefix: string, value: string) =>
  `${prefix}_${createHash('sha256').update(value).digest('hex').slice(0, 16)}`;
const positive = (value: number) => Number.isSafeInteger(value) && value > 0;

export class MockPaymentsProvider implements PaymentsProvider {
  readonly name = 'mock';
  private results = new Map<string, PaymentResult>();

  async createCustomer(input: { organizationId: string; email: string; name: string }) {
    if (!input.organizationId || !input.email || !input.name)
      throw new Error('Customer details required');
    return { id: mockId('cus', `${input.organizationId}:${input.email}`) };
  }

  async attachPaymentMethod(input: {
    customerId: string;
    providerToken: string;
    type: 'card' | 'ach';
  }) {
    if (!input.customerId || !/^tok_|^pm_/.test(input.providerToken))
      throw new Error('Provider-issued payment token required');
    return { id: mockId('pm', input.providerToken), type: input.type };
  }

  async charge(input: {
    customerId: string;
    paymentMethodToken: string;
    type: 'card' | 'ach';
    money: { amountCents: number; currency: 'usd' };
    idempotencyKey: string;
  }) {
    if (
      !input.customerId ||
      !/^tok_|^pm_/.test(input.paymentMethodToken) ||
      !positive(input.money.amountCents)
    )
      throw new Error('Valid customer, token and amount required');
    return this.once(
      'charge',
      input.idempotencyKey,
      input.type === 'ach' ? 'pending' : 'succeeded',
    );
  }

  async refund(input: { chargeId: string; amountCents?: number; idempotencyKey: string }) {
    if (!input.chargeId || (input.amountCents !== undefined && !positive(input.amountCents)))
      throw new Error('Valid charge and amount required');
    return this.once('refund', input.idempotencyKey, 'succeeded');
  }

  async payout(input: { money: { amountCents: number; currency: 'usd' }; idempotencyKey: string }) {
    if (!positive(input.money.amountCents)) throw new Error('Valid payout amount required');
    return this.once('payout', input.idempotencyKey, 'pending');
  }

  private once(prefix: string, key: string, status: PaymentResult['status']) {
    if (!key) throw new Error('Idempotency key required');
    const mapKey = `${prefix}:${key}`;
    const previous = this.results.get(mapKey);
    if (previous) return previous;
    const result = { id: mockId(prefix, mapKey), status };
    this.results.set(mapKey, result);
    return result;
  }
}

export class MockScreeningProvider implements ScreeningProvider {
  readonly name = 'mock';
  private reports = new Map<string, ScreeningReportResult>();

  constructor(readonly screeningPackage = 'smartmove-plus') {}

  async request(input: {
    applicationId: string;
    applicantName: string;
    applicantEmail: string;
    consent: { consentedAt: Date; version: string; revokedAt?: Date | null };
  }) {
    if (
      !input.applicationId ||
      !input.applicantName ||
      !input.applicantEmail ||
      !input.consent.version ||
      !Number.isFinite(input.consent.consentedAt.getTime()) ||
      input.consent.consentedAt.getTime() > Date.now() ||
      input.consent.revokedAt
    )
      throw new Error('Current applicant consent required');
    const id = mockId('sm', input.applicationId);
    if (!this.reports.has(id))
      this.reports.set(id, {
        id,
        status: 'complete',
        creditScore: 742,
        background: 'clear',
        eviction: 'clear',
      });
    return { id, status: 'complete' as ScreeningState };
  }

  async status(requestId: string) {
    return this.reports.get(requestId)?.status ?? 'failed';
  }

  async report(requestId: string) {
    const report = this.reports.get(requestId);
    if (!report) throw new Error('Screening report not found');
    return report;
  }
}

export class MockCompsProvider implements CompsProvider {
  readonly name: string = 'mock';
  constructor(readonly radiusMiles = 5) {}
  async search(input: {
    postalCode: string;
    bedrooms: number;
    squareFeet?: number;
    limit?: number;
  }): Promise<Comparable[]> {
    if (
      !/^\d{5}$/.test(input.postalCode) ||
      !Number.isInteger(input.bedrooms) ||
      input.bedrooms < 0
    )
      throw new Error('Valid postal code and bedroom count required');
    const limit = Math.max(0, Math.min(input.limit ?? 3, 10));
    return Array.from({ length: limit }, (_, index) => ({
      address: `${210 + index * 12} Sample St, ${input.postalCode}`,
      monthlyRentCents: 150000 + input.bedrooms * 25000 + index * 5000,
      bedrooms: input.bedrooms,
      squareFeet: input.squareFeet ?? 850,
      distanceMiles: Number(((index + 1) * 0.3).toFixed(1)),
    })).filter((comparable) => comparable.distanceMiles <= this.radiusMiles);
  }
}

export class MockRentometerProvider extends MockCompsProvider {
  override readonly name: string = 'rentometer';
}
