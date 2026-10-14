import type { PaymentsProvider, PaymentResult, PaymentMethodType, Money } from './types';

type StripeObject = {
  id: string;
  status?: string;
  type?: string;
  card?: { last4?: string };
  us_bank_account?: { last4?: string };
};

/** Stripe's REST API in test mode. Browser-side Stripe SDK supplies all payment method tokens. */
export class StripeTestPaymentsProvider implements PaymentsProvider {
  readonly name = 'stripe';
  constructor(
    private readonly secretKey: string,
    private readonly fetcher: typeof fetch = fetch,
    private readonly connectedAccountId?: string,
  ) {
    if (!secretKey.startsWith('sk_test_')) throw new Error('Stripe test secret required');
  }

  private async post(
    path: string,
    fields: Record<string, string | number | undefined>,
    key: string,
  ) {
    const body = new URLSearchParams();
    for (const [name, value] of Object.entries(fields))
      if (value !== undefined) body.set(name, String(value));
    const response = await this.fetcher(`https://api.stripe.com/v1/${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Idempotency-Key': key,
        ...(this.connectedAccountId ? { 'Stripe-Account': this.connectedAccountId } : {}),
      },
      body,
    });
    const result = (await response.json()) as StripeObject & { error?: { message?: string } };
    if (!response.ok || !result.id)
      throw new Error(result.error?.message ?? 'Stripe request failed');
    return result;
  }

  async createCustomer(input: { organizationId: string; email: string; name: string }) {
    if (!input.organizationId || !input.email || !input.name)
      throw new Error('Customer details required');
    const result = await this.post(
      'customers',
      {
        email: input.email,
        name: input.name,
        'metadata[organizationId]': input.organizationId,
      },
      `customer:${input.organizationId}:${input.email}`,
    );
    return { id: result.id };
  }

  async attachPaymentMethod(input: {
    customerId: string;
    providerToken: string;
    type: PaymentMethodType;
  }) {
    if (!input.customerId || !input.providerToken.startsWith('pm_'))
      throw new Error('Stripe payment method token required');
    const result = await this.post(
      `payment_methods/${encodeURIComponent(input.providerToken)}/attach`,
      {
        customer: input.customerId,
      },
      `attach:${input.customerId}:${input.providerToken}`,
    );
    if (result.type !== input.type && !(input.type === 'ach' && result.type === 'us_bank_account'))
      throw new Error('Payment method type mismatch');
    return {
      id: result.id,
      type: input.type,
      last4: result.card?.last4 ?? result.us_bank_account?.last4,
    };
  }

  async charge(input: {
    customerId: string;
    paymentMethodToken: string;
    type: PaymentMethodType;
    money: Money;
    idempotencyKey: string;
  }): Promise<PaymentResult> {
    if (
      !input.customerId ||
      !input.paymentMethodToken.startsWith('pm_') ||
      !Number.isSafeInteger(input.money.amountCents) ||
      input.money.amountCents <= 0 ||
      !input.idempotencyKey
    )
      throw new Error('Valid customer, token, amount and idempotency key required');
    const result = await this.post(
      'payment_intents',
      {
        amount: input.money.amountCents,
        currency: input.money.currency,
        customer: input.customerId,
        payment_method: input.paymentMethodToken,
        'payment_method_types[0]': input.type === 'ach' ? 'us_bank_account' : 'card',
        confirm: 'true',
        off_session: 'true',
      },
      input.idempotencyKey,
    );
    return { id: result.id, status: paymentStatus(result.status) };
  }

  async refund(input: {
    chargeId: string;
    amountCents?: number;
    idempotencyKey: string;
  }): Promise<PaymentResult> {
    if (
      !input.chargeId ||
      !input.idempotencyKey ||
      (input.amountCents !== undefined &&
        (!Number.isSafeInteger(input.amountCents) || input.amountCents <= 0))
    )
      throw new Error('Valid charge, amount and idempotency key required');
    const result = await this.post(
      'refunds',
      {
        payment_intent: input.chargeId,
        amount: input.amountCents,
      },
      input.idempotencyKey,
    );
    return { id: result.id, status: paymentStatus(result.status) };
  }

  async payout(input: { money: Money; idempotencyKey: string }): Promise<PaymentResult> {
    if (
      !Number.isSafeInteger(input.money.amountCents) ||
      input.money.amountCents <= 0 ||
      !input.idempotencyKey
    )
      throw new Error('Valid payout amount and idempotency key required');
    const result = await this.post(
      'payouts',
      {
        amount: input.money.amountCents,
        currency: input.money.currency,
      },
      input.idempotencyKey,
    );
    return { id: result.id, status: paymentStatus(result.status) };
  }
}

function paymentStatus(status?: string): PaymentResult['status'] {
  if (status === 'succeeded' || status === 'paid') return 'succeeded';
  if (status === 'failed' || status === 'canceled') return 'failed';
  if (status === 'requires_action' || status === 'requires_payment_method')
    return 'requires_action';
  return 'pending';
}
