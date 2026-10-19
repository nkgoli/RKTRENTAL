import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  record: vi.fn(),
  refund: vi.fn(),
  fee: vi.fn(),
  payout: vi.fn(),
}));
vi.mock('@/lib/auth/access', () => ({
  requireManagerRole: async () => ({ organizationId: 'isolated-test' }),
}));
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(url);
  },
}));
vi.mock('@/lib/ledger', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/ledger')>()),
  recordPayment: mocks.record,
  refundPayment: mocks.refund,
  applyLateFee: mocks.fee,
  runOwnerPayouts: mocks.payout,
}));
import {
  recordPaymentAction,
  refundPaymentAction,
  applyLateFeeAction,
} from '@/app/(manager)/payments/actions';

const form = (amount = '100.00') => {
  const data = new FormData();
  Object.entries({
    amount,
    leaseId: 'lease-1',
    paymentId: 'payment-1',
    month: '2026-09',
    filter: 'late',
    propertyId: 'property-1',
    unitId: 'unit-1',
  }).forEach(([key, value]) => data.set(key, value));
  return data;
};
beforeEach(() => vi.clearAllMocks());
describe('payment return context', () => {
  it('keeps month, status and unit after an isolated successful recording', async () => {
    mocks.record.mockResolvedValue({ duplicate: false });
    await expect(recordPaymentAction(form())).rejects.toThrow(
      '/payments?notice=payment-recorded&month=2026-09&propertyId=property-1&unitId=unit-1&filter=late',
    );
    expect(mocks.record).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'isolated-test',
        amountCents: 10000,
        leaseId: 'lease-1',
      }),
    );
  });
  it('keeps an invalid payment form open without recording a transaction', async () => {
    await expect(recordPaymentAction(form('0'))).rejects.toThrow('filter=late&record=lease-1');
    expect(mocks.record).not.toHaveBeenCalled();
  });
  it('preserves context after refunds and late fee decisions', async () => {
    mocks.refund.mockResolvedValue({ duplicate: true });
    await expect(refundPaymentAction(form())).rejects.toThrow(
      'notice=refund-duplicate&month=2026-09&propertyId=property-1&unitId=unit-1&filter=late',
    );
    mocks.fee.mockResolvedValue({ eligible: false, reason: 'in-grace' });
    await expect(applyLateFeeAction(form())).rejects.toThrow(
      'notice=fee-in-grace&month=2026-09&propertyId=property-1&unitId=unit-1&filter=late',
    );
  });
});
