'use server';

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

function back(notice: string, month?: string): never {
  const params = new URLSearchParams({ notice });
  if (month && /^\d{4}-\d{2}$/.test(month)) params.set('month', month);
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
  if (!cents) back('invalid-amount');
  try {
    const result = await recordPayment({
      organizationId: session.organizationId,
      leaseId: text(data, 'leaseId'),
      amountCents: cents,
      idempotencyKey: text(data, 'key'),
    });
    back(result.duplicate ? 'payment-duplicate' : 'payment-recorded');
  } catch (error) {
    if (error instanceof Error && /^(Lease not found|Idempotency)/.test(error.message))
      back('payment-failed');
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
  if (!decision) back('payment-failed', month);
  back(decision.eligible ? 'fee-applied' : `fee-${decision.reason}`, month);
}

export async function refundPaymentAction(data: FormData) {
  const session = await requireManagerRole();
  try {
    const result = await refundPayment({
      organizationId: session.organizationId,
      paymentId: text(data, 'paymentId'),
      idempotencyKey: text(data, 'key'),
    });
    back(result.duplicate ? 'refund-duplicate' : 'refunded', text(data, 'month'));
  } catch (error) {
    if (error instanceof Error && /^(Payment|Only a settled)/.test(error.message))
      back('refund-failed', text(data, 'month'));
    throw error;
  }
}

export async function runPayoutsAction(data: FormData) {
  const session = await requireManagerRole();
  const month = text(data, 'month') || monthKey(new Date());
  const result = await runOwnerPayouts(session.organizationId, month);
  back(result.sent ? 'payouts-sent' : 'payouts-none', month);
}
