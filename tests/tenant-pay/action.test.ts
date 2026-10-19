import { beforeEach, expect, it, vi } from 'vitest';
const payment = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(`redirect:${url}`);
  },
}));
vi.mock('@/lib/auth/access', () => ({
  requireTenantRole: async () => ({ tenantId: 'demo-tenant', organizationId: 'demo-org' }),
}));
vi.mock('@/lib/tenant-pay', () => ({
  payRent: payment,
  addPaymentMethod: vi.fn(),
  setAutopay: vi.fn(),
  TenantPayError: class extends Error {},
}));
import { payRentAction } from '@/app/(tenant)/pay/actions';

beforeEach(() => payment.mockReset());
function data() {
  const form = new FormData();
  form.set('leaseId', 'demo-lease');
  form.set('amount', '100.00');
  form.set('method', 'ach');
  form.set('providerToken', 'tok_mock_bank_6789');
  return form;
}
it('refuses an implicit or unconfirmed submission before reaching the payment service', async () => {
  await expect(payRentAction(data())).rejects.toThrow('redirect:/pay?notice=review-required');
  expect(payment).not.toHaveBeenCalled();
});
it('passes the confirmed amount and authenticated tenant to the mocked service', async () => {
  payment.mockResolvedValue({ status: 'PENDING', duplicate: false });
  const form = data();
  form.set('confirmPayment', 'yes');
  await expect(payRentAction(form)).rejects.toThrow('redirect:/pay?notice=pending');
  expect(payment).toHaveBeenCalledWith(
    expect.objectContaining({
      tenantId: 'demo-tenant',
      organizationId: 'demo-org',
      leaseId: 'demo-lease',
      amountCents: 10000,
    }),
  );
});
