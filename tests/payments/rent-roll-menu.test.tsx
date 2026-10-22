// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Synthetic rent roll only: the ledger loader and the server actions are mocked, so no record is
// read or written.
const mocks = vi.hoisted(() => ({ overview: vi.fn(), lateFee: vi.fn(), refund: vi.fn() }));
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
  applyLateFeeAction: mocks.lateFee,
  recordPaymentAction: vi.fn(),
  refundPaymentAction: mocks.refund,
  runPayoutsAction: vi.fn(),
}));
import PaymentsPage from '@/app/(manager)/payments/page';

const tenants = ['Chloe Fisher', 'Lily Dixon', 'Samuel Hunt'];

beforeEach(() => {
  vi.clearAllMocks();
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
  mocks.overview.mockResolvedValue({
    rows: tenants.map((tenantName, i) => ({
      leaseId: `lease-${i}`,
      tenantName,
      initials: 'CF',
      tenantId: `tenant-${i}`,
      propertyId: 'cedar',
      propertyName: 'Cedar Row Townhomes',
      unitLabel: `Townhome ${i + 1}`,
      singleUnit: false,
      dueDate: new Date('2026-10-01'),
      rentCents: 165000,
      outstandingCents: 165000,
      status: 'LATE',
      lateFeeEligible: true,
      lateFeeApplied: false,
      lastPaymentId: null,
    })),
    collectedCents: 0,
    outstandingCents: 495000,
    lateCents: 495000,
    openCount: 3,
    lateCount: 3,
    payouts: [],
    payoutReadyCents: 0,
    recentPayouts: [],
  });
});
afterEach(cleanup);

async function renderRoll() {
  const { container } = render(
    await PaymentsPage({ searchParams: Promise.resolve({ month: '2026-10' }) }),
  );
  const row = (i: number) => container.querySelector(`tr[data-lease="lease-${i}"]`) as HTMLElement;
  const trigger = (i: number) =>
    within(row(i)).getByRole('button', { name: `Actions for ${tenants[i]}` });
  const panel = (i: number) =>
    document.getElementById(trigger(i).getAttribute('aria-controls')!) as HTMLElement;
  return { row, trigger, panel };
}

describe('rent-roll row menu targeting', () => {
  it('each row records payment for its own lease', async () => {
    const { row } = await renderRoll();
    tenants.forEach((_, i) => {
      const href = within(row(i))
        .getByRole('link', { name: 'Record payment' })
        .getAttribute('href');
      expect(href).toBe(`/payments?month=2026-10&record=lease-${i}#record-payment`);
    });
  });

  it('opens one menu at a time and adds the late fee to the selected lease only', async () => {
    const user = userEvent.setup();
    const { trigger, panel } = await renderRoll();
    await user.click(trigger(0));
    await user.click(trigger(1));
    expect(panel(0).hidden).toBe(true);
    expect(panel(1).hidden).toBe(false);
    expect(document.querySelectorAll('.row-menu-panel:not([hidden])')).toHaveLength(1);

    await user.click(within(panel(1)).getByRole('button', { name: 'Add late fee' }));
    const dialog = screen.getByRole('dialog', { name: 'Add late fee for Lily Dixon?' });
    expect(screen.getAllByRole('dialog')).toHaveLength(1);
    await user.click(within(dialog).getByRole('button', { name: 'Add late fee' }));
    await waitFor(() => expect(mocks.lateFee).toHaveBeenCalledOnce());
    const form = mocks.lateFee.mock.calls[0][0] as FormData;
    expect(form.get('leaseId')).toBe('lease-1');
    expect(form.get('month')).toBe('2026-10');
    expect(mocks.refund).not.toHaveBeenCalled();
  });

  it('cancelling the confirmation submits nothing and returns focus to the action', async () => {
    const user = userEvent.setup();
    const { trigger, panel } = await renderRoll();
    await user.click(trigger(2));
    const fee = within(panel(2)).getByRole('button', { name: 'Add late fee' });
    await user.click(fee);
    const dialog = screen.getByRole('dialog', { name: 'Add late fee for Samuel Hunt?' });
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(mocks.lateFee).not.toHaveBeenCalled();
    expect(panel(2).hidden).toBe(false);
    expect(document.activeElement).toBe(fee);
  });
});
