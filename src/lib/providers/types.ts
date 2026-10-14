export type Money = { amountCents: number; currency: 'usd' };
export type PaymentResult = {
  id: string;
  status: 'pending' | 'succeeded' | 'failed' | 'requires_action';
};
export type PaymentMethodType = 'card' | 'ach';

export interface PaymentsProvider {
  readonly name: string;
  createCustomer(input: {
    organizationId: string;
    email: string;
    name: string;
  }): Promise<{ id: string }>;
  // The token must come from provider-hosted fields or a provider SDK. Never pass PAN/CVV/account numbers.
  attachPaymentMethod(input: {
    customerId: string;
    providerToken: string;
    type: PaymentMethodType;
  }): Promise<{ id: string; type: PaymentMethodType; last4?: string }>;
  charge(input: {
    customerId: string;
    paymentMethodToken: string;
    type: PaymentMethodType;
    money: Money;
    idempotencyKey: string;
  }): Promise<PaymentResult>;
  refund(input: {
    chargeId: string;
    amountCents?: number;
    idempotencyKey: string;
  }): Promise<PaymentResult>;
  payout(input: { money: Money; idempotencyKey: string }): Promise<PaymentResult>;
}

export type ScreeningState = 'pending' | 'complete' | 'failed';
export type ScreeningReportResult = {
  id: string;
  status: ScreeningState;
  creditScore?: number;
  background?: 'clear' | 'review';
  eviction?: 'clear' | 'review';
};
export interface ScreeningProvider {
  readonly name: string;
  request(input: {
    applicationId: string;
    applicantName: string;
    applicantEmail: string;
    consent: { consentedAt: Date; version: string; revokedAt?: Date | null };
  }): Promise<{ id: string; status: ScreeningState }>;
  status(requestId: string): Promise<ScreeningState>;
  report(requestId: string): Promise<ScreeningReportResult>;
}

export type CompStatus = 'listed' | 'leased';
export type Comparable = {
  id?: string;
  address: string;
  monthlyRentCents: number;
  bedrooms: number;
  bathrooms?: number;
  squareFeet: number;
  distanceMiles: number;
  /** Compass bearing from the subject, used to place the comp on the map. */
  bearingDegrees?: number;
  status?: CompStatus;
  /** ISO date the comp was listed or leased. */
  observedAt?: string;
  source?: string;
  /** Property features that make a comp a poor match (for example furnished, short-term). */
  caveat?: string;
};
export type CompsSearch = {
  postalCode: string;
  bedrooms: number;
  bathrooms?: number;
  squareFeet?: number;
  minSquareFeet?: number;
  maxSquareFeet?: number;
  radiusMiles?: number;
  withinDays?: number;
  status?: CompStatus;
  limit?: number;
};
export interface CompsProvider {
  readonly name: string;
  search(input: CompsSearch): Promise<Comparable[]>;
}
