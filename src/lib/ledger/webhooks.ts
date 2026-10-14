import type { PrismaClient } from '@prisma/client';
import { db } from '@/lib/db/client';
import { decodePayoutStatus, encodePayoutStatus, type PaymentStatusName } from './core';

export type LedgerWebhookEvent = {
  provider: 'mock' | 'stripe';
  organizationId: string;
  eventType: string;
};

export type WebhookOutcome =
  | { kind: 'payment'; status: PaymentStatusName; updated: number }
  | { kind: 'payout'; status: string; updated: number }
  | { kind: 'ignored' };

/** Event type -> the payment status it implies (mock `payment.*`, Stripe `payment_intent.*`/`charge.*`). */
const paymentEvents: Record<string, PaymentStatusName> = {
  'payment.succeeded': 'SUCCEEDED',
  'payment.failed': 'FAILED',
  'payment.refunded': 'REFUNDED',
  'payment_intent.succeeded': 'SUCCEEDED',
  'payment_intent.payment_failed': 'FAILED',
  'charge.refunded': 'REFUNDED',
};

const payoutEvents: Record<string, string> = {
  'payout.paid': 'paid',
  'payout.failed': 'failed',
};

/** Which statuses a payment may move from; settled states never move backwards. */
const allowedFrom: Record<PaymentStatusName, PaymentStatusName[]> = {
  SUCCEEDED: ['PENDING'],
  FAILED: ['PENDING'],
  REFUNDED: ['PENDING', 'SUCCEEDED'],
  PENDING: [],
};

/** The provider object id the event refers to (the stored Payment/Payout providerReference). */
export function referenceFromPayload(
  provider: 'mock' | 'stripe',
  eventType: string,
  body: string,
): string | null {
  let event: unknown;
  try {
    event = JSON.parse(body);
  } catch {
    return null;
  }
  const data = (event as { data?: Record<string, unknown> } | null)?.data;
  if (!data) return null;
  const object =
    provider === 'stripe' ? (data.object as Record<string, unknown> | undefined) : data;
  // Stripe charge.* events carry the charge id; the stored reference is the payment intent.
  const candidate =
    provider === 'stripe'
      ? eventType.startsWith('charge.')
        ? (object?.payment_intent ?? object?.id)
        : object?.id
      : object?.providerReference;
  return typeof candidate === 'string' && candidate ? candidate : null;
}

/**
 * Applies a verified, newly recorded webhook to the ledger. Call it after the webhook intake has
 * stored the event as 'created'; duplicates are filtered there, and this is safe to repeat anyway
 * because status transitions are guarded and only ever move forward.
 */
export async function applyPaymentWebhook(
  event: LedgerWebhookEvent,
  body: string,
  client: PrismaClient = db,
): Promise<WebhookOutcome> {
  const reference = referenceFromPayload(event.provider, event.eventType, body);
  if (!reference) return { kind: 'ignored' };
  const { organizationId } = event;

  const paymentStatus = paymentEvents[event.eventType];
  if (paymentStatus) {
    const result = await client.payment.updateMany({
      where: {
        organizationId,
        providerReference: reference,
        status: { in: allowedFrom[paymentStatus] },
      },
      data: {
        status: paymentStatus,
        ...(paymentStatus === 'SUCCEEDED' ? { paidAt: new Date() } : {}),
      },
    });
    return { kind: 'payment', status: paymentStatus, updated: result.count };
  }

  const payoutStatus = payoutEvents[event.eventType];
  if (payoutStatus) {
    const payout = await client.payout.findFirst({
      where: { organizationId, providerReference: reference },
    });
    if (!payout) return { kind: 'payout', status: payoutStatus, updated: 0 };
    const current = decodePayoutStatus(payout.status);
    if (current.status === 'paid' || current.status === 'failed')
      return { kind: 'payout', status: current.status, updated: 0 };
    await client.payout.update({
      where: { id: payout.id },
      data: {
        status:
          current.propertyId && current.month
            ? encodePayoutStatus(payoutStatus, current.propertyId, current.month)
            : payoutStatus,
      },
    });
    return { kind: 'payout', status: payoutStatus, updated: 1 };
  }
  return { kind: 'ignored' };
}
