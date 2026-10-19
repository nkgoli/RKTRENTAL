'use server';

import { redirect } from 'next/navigation';
import { requireTenantRole } from '@/lib/auth/access';
import { submitRent } from './submission';
import { addPaymentMethod, setAutopay, TenantPayError, type PayMethodType } from '@/lib/tenant-pay';

const text = (data: FormData, name: string) => String(data.get(name) ?? '').trim();

function back(notice: string): never {
  redirect(`/pay?notice=${notice}`);
}

const methodOf = (value: string): PayMethodType | null =>
  value === 'card' || value === 'ach' ? value : null;

export async function payRentAction(data: FormData) {
  const session = await requireTenantRole();
  back(await submitRent(data, session));
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
