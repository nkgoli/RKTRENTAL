'use server';

import { randomUUID } from 'node:crypto';
import { redirect } from 'next/navigation';
import { requireManagerRole } from '@/lib/auth/access';
import {
  applyLateFee,
  monthKey,
  recordPayment,
  refundPayment,
  runOwnerPayouts,
  toCents,
} from '@/lib/ledger';

const text = (data: FormData, name: string) => String(data.get(name) ?? '').trim();

function back(notice: string, data: FormData): never {
  const month = text(data, 'month');
  const params = new URLSearchParams({ notice });
  if (month && /^\d{4}-\d{2}$/.test(month)) params.set('month', month);
  for (const key of ['propertyId', 'unitId']) {
    const value = text(data, key);
    if (value) params.set(key, value);
  }
  const filter = text(data, 'filter');
  if (['paid', 'open', 'late'].includes(filter)) params.set('filter', filter);
  if (['invalid-amount', 'payment-failed'].includes(notice))
    params.set('record', text(data, 'leaseId') || '1');
  redirect(`/payments?${params}`);
}

/** Parses "1,850.50" style input into cents; returns null when it is not a positive amount. */
function parseDollars(value: string): number | null {
  const cleaned = value.replace(/[$,\s]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const cents = toCents(cleaned);
  return cents > 0 ? cents : null;
}

export async function recordPaymentAction(data: FormData) {
  const session = await requireManagerRole();
  const cents = parseDollars(text(data, 'amount'));
  if (!cents) back('invalid-amount', data);
  try {
    const result = await recordPayment({
      organizationId: session.organizationId,
      leaseId: text(data, 'leaseId'),
      amountCents: cents,
      idempotencyKey: randomUUID(),
    });
    back(result.duplicate ? 'payment-duplicate' : 'payment-recorded', data);
  } catch (error) {
    if (error instanceof Error && /^(Lease not found|Idempotency)/.test(error.message))
      back('payment-failed', data);
    throw error;
  }
}

export async function applyLateFeeAction(data: FormData) {
  const session = await requireManagerRole();
  const month = text(data, 'month');
  const decision = await applyLateFee({
    organizationId: session.organizationId,
    leaseId: text(data, 'leaseId'),
    month,
    asOf: new Date(),
  }).catch((error) => {
    if (error instanceof Error && error.message === 'Lease not found') return null;
    throw error;
  });
  if (!decision) back('payment-failed', data);
  back(decision.eligible ? 'fee-applied' : `fee-${decision.reason}`, data);
}

export async function refundPaymentAction(data: FormData) {
  const session = await requireManagerRole();
  try {
    const result = await refundPayment({
      organizationId: session.organizationId,
      paymentId: text(data, 'paymentId'),
      idempotencyKey: randomUUID(),
    });
    back(result.duplicate ? 'refund-duplicate' : 'refunded', data);
  } catch (error) {
    if (error instanceof Error && /^(Payment|Only a settled)/.test(error.message))
      back('refund-failed', data);
    throw error;
  }
}

export async function runPayoutsAction(data: FormData) {
  const session = await requireManagerRole();
  const month = text(data, 'month') || monthKey(new Date());
  const result = await runOwnerPayouts(session.organizationId, month);
  back(result.sent ? 'payouts-sent' : 'payouts-none', data);
}
