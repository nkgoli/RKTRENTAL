'use server';

import { redirect } from 'next/navigation';
import { requireTenantRole } from '@/lib/auth/access';
import { toCents } from '@/lib/ledger';
import {
  addPaymentMethod,
  payRent,
  setAutopay,
  TenantPayError,
  type PayMethodType,
} from '@/lib/tenant-pay';

const text = (data: FormData, name: string) => String(data.get(name) ?? '').trim();

function back(notice: string): never {
  redirect(`/pay?notice=${notice}`);
}

/** Parses "1,850.50" style input into cents; returns null when it is not a positive amount. */
function parseDollars(value: string): number | null {
  const cleaned = value.replace(/[$,\s]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const cents = toCents(cleaned);
  return cents > 0 ? cents : null;
}

const methodOf = (value: string): PayMethodType | null =>
  value === 'card' || value === 'ach' ? value : null;

export async function payRentAction(data: FormData) {
  const session = await requireTenantRole();
  if (!session.tenantId) back('payment-failed');
  const cents = parseDollars(text(data, 'amount'));
  if (!cents) back('invalid-amount');
  const method = methodOf(text(data, 'method'));
  if (!method) back('invalid-method');
  try {
    const result = await payRent({
      organizationId: session.organizationId,
      tenantId: session.tenantId,
      leaseId: text(data, 'leaseId'),
      amountCents: cents,
      method,
      providerToken: text(data, 'providerToken') || undefined,
      paymentMethodId: text(data, 'paymentMethodId') || undefined,
      idempotencyKey: text(data, 'key'),
      saveMethod: text(data, 'saveMethod') === 'on',
    });
    back(
      result.duplicate ? 'payment-duplicate' : result.status === 'SUCCEEDED' ? 'paid' : 'pending',
    );
  } catch (error) {
    if (error instanceof TenantPayError) {
      if (/amount/i.test(error.message)) back('invalid-amount');
      if (/token|provider|card or bank/i.test(error.message)) back('invalid-method');
      back('payment-failed');
    }
    throw error;
  }
}

export async function addPaymentMethodAction(data: FormData) {
  const session = await requireTenantRole();
  if (!session.tenantId) back('method-failed');
  const method = methodOf(text(data, 'method'));
  if (!method) back('invalid-method');
  try {
    await addPaymentMethod({
      organizationId: session.organizationId,
      tenantId: session.tenantId,
      method,
      providerToken: text(data, 'providerToken'),
    });
    back('method-added');
  } catch (error) {
    if (error instanceof TenantPayError) back('method-failed');
    throw error;
  }
}

/** Called from the autopay switch; the page re-reads the setting on refresh. */
export async function setAutopayAction(input: {
  leaseId: string;
  enabled: boolean;
  paymentMethodId?: string | null;
}): Promise<{ ok: boolean; enabled: boolean; error?: string }> {
  const session = await requireTenantRole();
  if (!session.tenantId) return { ok: false, enabled: false, error: 'Tenant session required' };
  try {
    const result = await setAutopay({
      organizationId: session.organizationId,
      tenantId: session.tenantId,
      leaseId: input.leaseId,
      enabled: input.enabled,
      paymentMethodId: input.paymentMethodId,
    });
    return { ok: true, enabled: result.enabled };
  } catch (error) {
    if (error instanceof TenantPayError)
      return { ok: false, enabled: !input.enabled, error: error.message };
    throw error;
  }
}
