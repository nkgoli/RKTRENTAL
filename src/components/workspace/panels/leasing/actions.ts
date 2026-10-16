'use server';

import { randomUUID } from 'node:crypto';
import { redirect } from 'next/navigation';
import { requireManagerRole } from '@/lib/auth/access';
import { recordPayment, toCents } from '@/lib/ledger';
import { withUnit } from './scope';

const text = (data: FormData, name: string) => String(data.get(name) ?? '').trim();

/** Records a payment from the property Payments tab and returns to that tab. */
export async function recordPropertyPaymentAction(data: FormData) {
  const session = await requireManagerRole();
  const propertyId = text(data, 'propertyId');
  const unitId = text(data, 'unitId') || undefined;
  const back = (notice: string): never =>
    redirect(withUnit(`/properties/${propertyId}/payments`, unitId, { notice }));
  const amount = text(data, 'amount').replace(/[$,\s]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(amount) || toCents(amount) <= 0) return back('invalid-amount');
  try {
    const result = await recordPayment({
      organizationId: session.organizationId,
      leaseId: text(data, 'leaseId'),
      amountCents: toCents(amount),
      idempotencyKey: randomUUID(),
    });
    return back(result.duplicate ? 'payment-duplicate' : 'payment-recorded');
  } catch (error) {
    if (error instanceof Error && /^(Lease not found|Idempotency)/.test(error.message)) return back('payment-failed');
    throw error;
  }
}
