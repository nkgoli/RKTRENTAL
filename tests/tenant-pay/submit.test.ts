import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ session: vi.fn(), pay: vi.fn() }));
vi.mock('@/lib/auth/server-session', () => ({ getSession: mocks.session }));
vi.mock('@/lib/tenant-pay', () => ({ payRent: mocks.pay, TenantPayError: class extends Error {} }));
import { TenantPayError } from '@/lib/tenant-pay';
import { POST } from '@/app/(tenant)/pay/submit/route';

beforeEach(() => {
  vi.resetAllMocks();
  mocks.session.mockResolvedValue({ role: 'TENANT', tenantId: 'own', organizationId: 'org' });
  mocks.pay.mockResolvedValue({ status: 'SUCCEEDED', duplicate: false });
});
const data = (patch: Record<string, string> = {}) => {
  const form = new FormData();
  for (const [key, value] of Object.entries({
    leaseId: 'fixture',
    amount: '200.25',
    method: 'card',
    providerToken: 'tok_mock_card_4242',
    confirmPayment: 'yes',
    ...patch,
  }))
    form.set(key, value);
  return form;
};
const post = (patch = {}, origin = 'http://localhost:3229') =>
  POST(
    new Request('http://localhost:3229/pay/submit', {
      method: 'POST',
      headers: { Origin: origin },
      body: data(patch),
    }),
  );

it('uses same-host 303 result navigation and the existing authenticated service inputs once', async () => {
  const response = await post();
  expect(response.status).toBe(303);
  expect(response.headers.get('Location')).toBe('/pay?notice=paid#payment-result');
  expect(response.headers.get('Cache-Control')).toBe('no-store');
  expect(mocks.pay).toHaveBeenCalledTimes(1);
  expect(mocks.pay).toHaveBeenCalledWith(
    expect.objectContaining({
      tenantId: 'own',
      organizationId: 'org',
      leaseId: 'fixture',
      amountCents: 20025,
      method: 'card',
    }),
  );
});
it('requires tenant auth and rejects cross-origin submissions without charging', async () => {
  mocks.session.mockResolvedValue(null);
  expect((await post()).headers.get('Location')).toBe('/sign-in');
  mocks.session.mockResolvedValue({ role: 'MANAGER' });
  expect((await post()).headers.get('Location')).toBe('/sign-in');
  mocks.session.mockResolvedValue({ role: 'TENANT', tenantId: 'own' });
  expect((await post({}, 'https://other.invalid')).status).toBe(403);
  expect(mocks.pay).not.toHaveBeenCalled();
});
it.each([
  [{ confirmPayment: '' }, 'review-required'],
  [{ amount: '0' }, 'invalid-amount'],
  [{ amount: '10.001' }, 'invalid-amount'],
  [{ method: 'other' }, 'invalid-method'],
])('retains validation before payment %j', async (patch, notice) => {
  expect((await post(patch)).headers.get('Location')).toContain(`notice=${notice}`);
  expect(mocks.pay).not.toHaveBeenCalled();
});
it.each([
  [{ status: 'PENDING', duplicate: false }, 'pending'],
  [{ status: 'SUCCEEDED', duplicate: true }, 'payment-duplicate'],
])('routes service outcomes without retrying %j', async (result, notice) => {
  mocks.pay.mockResolvedValue(result);
  expect((await post()).headers.get('Location')).toContain(`notice=${notice}`);
  expect(mocks.pay).toHaveBeenCalledTimes(1);
});
it('shows known failure and preserves uncertainty after an unexpected error without retrying', async () => {
  mocks.pay.mockRejectedValue(new TenantPayError('Payment declined'));
  expect((await post()).headers.get('Location')).toContain('notice=payment-failed');
  mocks.pay.mockRejectedValue(new Error('Connection lost after submission'));
  expect((await post()).headers.get('Location')).toContain('notice=payment-unconfirmed');
  expect(mocks.pay).toHaveBeenCalledTimes(2);
});
