import type { AuthSession } from '@/lib/auth/session';
import { toCents } from '@/lib/ledger';
import { payRent, TenantPayError, type PayMethodType } from '@/lib/tenant-pay';

const text = (data: FormData, name: string) => String(data.get(name) ?? '').trim();

/** Parses "1,850.50" style input into cents; returns null when it is not a positive amount. */
function parseDollars(value: string): number | null {
  const cleaned = value.replace(/[$,\s]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const cents = toCents(cleaned);
  return cents > 0 ? cents : null;
}

const methodOf = (value: string): PayMethodType | null =>
  value === 'card' || value === 'ach' ? value : null;

export async function submitRent(data: FormData, session: AuthSession): Promise<string> {
  if (!session.tenantId) return 'payment-failed';
  if (text(data, 'confirmPayment') !== 'yes') return 'review-required';
  const cents = parseDollars(text(data, 'amount'));
  if (!cents) return 'invalid-amount';
  const method = methodOf(text(data, 'method'));
  if (!method) return 'invalid-method';
  try {
    const result = await payRent({
      organizationId: session.organizationId,
      tenantId: session.tenantId,
      leaseId: text(data, 'leaseId'),
      amountCents: cents,
      method,
      providerToken: text(data, 'providerToken') || undefined,
      paymentMethodId: text(data, 'paymentMethodId') || undefined,
      saveMethod: text(data, 'saveMethod') === 'on',
    });
    return result.duplicate
      ? 'payment-duplicate'
      : result.status === 'SUCCEEDED'
        ? 'paid'
        : 'pending';
  } catch (error) {
    if (error instanceof TenantPayError) {
      if (/amount/i.test(error.message)) return 'invalid-amount';
      if (/token|provider|card or bank/i.test(error.message)) return 'invalid-method';
      return 'payment-failed';
    }
    throw error;
  }
}
