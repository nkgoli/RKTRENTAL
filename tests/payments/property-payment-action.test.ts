import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ findFirst: vi.fn(), record: vi.fn() }));
vi.mock('@/lib/auth/access', () => ({
  requireManagerRole: async () => ({ organizationId: 'org-1' }),
}));
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    throw new Error(url);
  },
}));
vi.mock('@/lib/db/client', () => ({ db: { lease: { findFirst: mocks.findFirst } } }));
vi.mock('@/lib/ledger', async (original) => ({
  ...(await original<typeof import('@/lib/ledger')>()),
  recordPayment: mocks.record,
}));

import { recordPropertyPaymentAction } from '@/components/workspace/panels/leasing/actions';

const form = (leaseId: string) => {
  const data = new FormData();
  Object.entries({ propertyId: 'p-1', unitId: 'u-1', leaseId, amount: '100.00' }).forEach(
    ([key, value]) => data.set(key, value),
  );
  return data;
};

beforeEach(() => vi.clearAllMocks());

describe('recording a payment from property or unit Payments', () => {
  it('only accepts an ACTIVE lease in this organization, property and unit', async () => {
    mocks.findFirst.mockResolvedValue({ id: 'lease-now' });
    mocks.record.mockResolvedValue({ duplicate: false });
    await expect(recordPropertyPaymentAction(form('lease-now'))).rejects.toThrow(
      '/properties/p-1/payments?notice=payment-recorded&unit=u-1',
    );
    expect(mocks.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'lease-now',
        organizationId: 'org-1',
        status: 'ACTIVE',
        unit: { propertyId: 'p-1', id: 'u-1' },
      },
      select: { id: true },
    });
    expect(mocks.record).toHaveBeenCalledWith(
      expect.objectContaining({ leaseId: 'lease-now', amountCents: 10_000 }),
    );
  });

  it('fails a stale, ended or missing lease instead of recording elsewhere', async () => {
    mocks.findFirst.mockResolvedValue(null);
    await expect(recordPropertyPaymentAction(form('lease-ended'))).rejects.toThrow(
      'notice=payment-failed',
    );
    await expect(recordPropertyPaymentAction(form(''))).rejects.toThrow('notice=payment-failed');
    expect(mocks.findFirst).toHaveBeenCalledTimes(1);
    expect(mocks.record).not.toHaveBeenCalled();
  });
});
