'use server';

import { randomUUID } from 'node:crypto';
import { redirect } from 'next/navigation';
import { requireManagerRole } from '@/lib/auth/access';
import { db } from '@/lib/db/client';
import { ChargeInputError, createCharge, recordPayment, toCents } from '@/lib/ledger';
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
  const lease = await db.lease.findFirst({
    where: {
      id: text(data, 'leaseId'),
      organizationId: session.organizationId,
      unit: { propertyId, ...(unitId ? { id: unitId } : {}) },
    },
    select: { id: true },
  });
  if (!lease) return back('payment-failed');
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

/** Adds a one-off charge from the property Payments tab; access is enforced by createCharge. */
export async function createPropertyChargeAction(data: FormData) {
  const session = await requireManagerRole();
  const propertyId = text(data, 'propertyId');
  const unitId = text(data, 'unitId') || undefined;
  const back = (notice: string): never =>
    redirect(withUnit(`/properties/${propertyId}/payments`, unitId, { notice }));
  const amount = text(data, 'amount').replace(/[$,\s]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(amount) || toCents(amount) <= 0) return back('invalid-amount');
  const date = text(data, 'dueDate');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return back('charge-invalid');
  try {
    await createCharge({
      organizationId: session.organizationId,
      propertyId,
      unitId,
      leaseId: text(data, 'leaseId'),
      kind: text(data, 'kind'),
      description: text(data, 'description'),
      dueDate: new Date(`${date}T00:00:00.000Z`),
      amountCents: toCents(amount),
    });
  } catch (error) {
    if (error instanceof ChargeInputError) return back('charge-invalid');
    throw error;
  }
  return back('charge-created');
}
