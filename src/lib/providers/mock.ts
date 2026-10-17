import { createHash } from 'node:crypto';
import type {
  Comparable,
  CompsProvider,
  CompsSearch,
  PaymentsProvider,
  PaymentResult,
  ScreeningProvider,
  ScreeningReportResult,
  ScreeningState,
} from './types';

const mockId = (prefix: string, value: string) =>
  `${prefix}_${createHash('sha256').update(value).digest('hex').slice(0, 16)}`;
const positive = (value: number) => Number.isSafeInteger(value) && value > 0;
// Plausible neighbourhood streets for sandbox comps, so the demo does not read "Sample St".
const MOCK_STREETS = ['Oltorf St', 'Lamar Blvd', 'Barton Hills Dr', 'Congress Ave', 'Riverside Dr', 'Cesar Chavez St'];

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
  async search(input: CompsSearch): Promise<Comparable[]> {
    if (
      !/^\d{5}$/.test(input.postalCode) ||
      !Number.isInteger(input.bedrooms) ||
      input.bedrooms < 0
    )
      throw new Error('Valid postal code and bedroom count required');
    const limit = Math.max(0, Math.min(input.limit ?? 3, 10));
    const radius = input.radiusMiles ?? this.radiusMiles;
    const baseSqft = input.squareFeet ?? 850;
    const today = Date.now();
    // Deterministic sandbox data derived from the search only; no keys and no network.
    return Array.from({ length: limit }, (_, index): Comparable => {
      const jitter = mockNumber(`${input.postalCode}:${input.bedrooms}:${index}`);
      const squareFeet = Math.round(baseSqft * (0.88 + (jitter % 25) / 100));
      const leased = index % 2 === 0;
      const daysAgo = 4 + index * 9 + (jitter % 5);
      return {
        id: mockId('comp', `${input.postalCode}:${input.bedrooms}:${index}`),
        address: `${210 + index * 12} ${MOCK_STREETS[index % MOCK_STREETS.length]}, ${input.postalCode}`,
        monthlyRentCents:
          150000 + input.bedrooms * 25000 + index * 5000 + (jitter % 9) * 2500 - 10000,
        bedrooms: input.bedrooms,
        bathrooms: index % 3 === 2 ? 1.5 : 1,
        squareFeet,
        distanceMiles: Number(((index + 1) * 0.3).toFixed(1)),
        bearingDegrees: (index * 137 + (jitter % 40)) % 360,
        status: leased ? 'leased' : 'listed',
        observedAt: new Date(today - daysAgo * 86_400_000).toISOString(),
        source: this.name === 'mock' ? 'Sandbox' : this.name,
        ...(index === 7 ? { caveat: 'furnished, short-term' } : {}),
      };
    }).filter(
      (comp) =>
        comp.distanceMiles <= radius &&
        (input.bathrooms === undefined || comp.bathrooms === input.bathrooms) &&
        (input.minSquareFeet === undefined || comp.squareFeet >= input.minSquareFeet) &&
        (input.maxSquareFeet === undefined || comp.squareFeet <= input.maxSquareFeet) &&
        (input.status === undefined || comp.status === input.status) &&
        (input.withinDays === undefined ||
          Date.parse(comp.observedAt!) >= today - input.withinDays * 86_400_000),
    );
  }
}

function mockNumber(value: string) {
  return createHash('sha256').update(value).digest().readUInt16BE(0);
}

export class MockRentometerProvider extends MockCompsProvider {
  override readonly name: string = 'rentometer';
}
