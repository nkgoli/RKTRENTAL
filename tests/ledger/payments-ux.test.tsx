// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
const mocks = vi.hoisted(() => ({ overview: vi.fn(), refund: vi.fn() }));
vi.mock('@/lib/auth/access', () => ({
  requireManagerRole: async () => ({ organizationId: 'org' }),
}));
vi.mock('@/components/workspace/ScopedWorkspace', () => ({ ScopedWorkspace: () => null }));
vi.mock('@/lib/ledger', async (original) => ({
  ...(await original<typeof import('@/lib/ledger')>()),
  ensureRentCharges: vi.fn(),
  loadPaymentsOverview: mocks.overview,
}));
vi.mock('@/app/(manager)/payments/actions', () => ({
  applyLateFeeAction: vi.fn(),
  recordPaymentAction: vi.fn(),
  refundPaymentAction: mocks.refund,
  runPayoutsAction: vi.fn(),
}));
import PaymentsPage from '@/app/(manager)/payments/page';

beforeEach(() => {
  vi.clearAllMocks();
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
  mocks.overview.mockResolvedValue({
    rows: ['PAID', 'LATE', 'AUTOPAY', 'PENDING'].map((status) => ({
      leaseId: status,
      tenantName: `${status} Tenant`,
      initials: 'AT',
      tenantId: `tenant-${status}`,
      propertyId: 'property',
      propertyName: 'Maple Court',
      unitLabel: 'Unit 1',
      singleUnit: false,
      dueDate: new Date('2026-10-01'),
      rentCents: 150000,
      outstandingCents: status === 'PAID' ? 0 : 150000,
      status,
      lateFeeEligible: status === 'LATE',
      lateFeeApplied: false,
      lastPaymentId: status === 'PAID' ? 'payment-paid' : null,
    })),
    collectedCents: 150000,
    outstandingCents: 450000,
    lateCents: 150000,
    openCount: 3,
    lateCount: 1,
    payouts: [],
    payoutReadyCents: 0,
    recentPayouts: [],
  });
});
afterEach(cleanup);
describe('payment rent roll actions', () => {
  it('makes ledger rows accessible, preserves amounts as text and limits visible payment actions', async () => {
    const { container } = render(
      await PaymentsPage({ searchParams: Promise.resolve({ month: '2026-10' }) }),
    );
    expect(screen.getByRole('table', { name: 'Rent roll' }).getAttribute('data-mobile')).toBe(
      'cards',
    );
    const paid = container.querySelector('tr[data-lease="PAID"]') as HTMLElement;
    const late = container.querySelector('tr[data-lease="LATE"]') as HTMLElement;
    const autopay = container.querySelector('tr[data-lease="AUTOPAY"]') as HTMLElement;
    expect(within(paid).getByRole('link', { name: 'PAID Tenant' }).getAttribute('href')).toBe(
      '/leases/PAID?tab=payments',
    );
    expect(within(paid).queryByRole('link', { name: '$1,500' })).toBeNull();
    expect(within(late).getByRole('link', { name: 'Record payment' })).toBeTruthy();
    expect(within(autopay).queryByRole('link', { name: 'Record payment' })).toBeNull();
    expect(within(autopay).getByText('Autopay scheduled')).toBeTruthy();
    expect(screen.queryByRole('columnheader', { name: 'Due' })).toBeNull();
  });
  it('requires a refund confirmation and submits the original payment and scope', async () => {
    const user = userEvent.setup();
    const { container } = render(
      await PaymentsPage({
        searchParams: Promise.resolve({ month: '2026-10', propertyId: 'property', unitId: 'unit' }),
      }),
    );
    const row = container.querySelector('tr[data-lease="PAID"]') as HTMLElement;
    await user.click(within(row).getByLabelText('Actions for PAID Tenant'));
    await user.click(within(row).getByRole('button', { name: 'Refund' }));
    expect(mocks.refund).not.toHaveBeenCalled();
    const dialog = screen.getByRole('dialog', { name: 'Refund payment for PAID Tenant?' });
    expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: 'Cancel' }));
    await user.click(within(dialog).getByRole('button', { name: 'Refund payment' }));
    await waitFor(() => expect(mocks.refund).toHaveBeenCalledOnce());
    const form = mocks.refund.mock.calls[0][0] as FormData;
    expect(form.get('paymentId')).toBe('payment-paid');
    expect(form.get('month')).toBe('2026-10');
    expect(form.get('propertyId')).toBe('property');
    expect(form.get('unitId')).toBe('unit');
  });
});
