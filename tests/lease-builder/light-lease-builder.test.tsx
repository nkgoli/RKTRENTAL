// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { emptyDraft } from '@/lib/lease-create/types';
import { withResolvedEnd } from '@/lib/lease-create/validation';
import { STANDARD_FEES, STANDARD_ITEMS } from '@/lib/lease-create/templates';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/app/(manager)/leases/new/actions', () => ({
  saveWizardStepAction: vi.fn().mockResolvedValue({ ok: true, leaseId: 'd1', furthestStep: 1 }),
  sendWizardLeaseAction: vi.fn(),
  completeSigningAction: vi.fn(),
}));
vi.mock('@/components/upload', () => ({ FileUploader: () => <div>Upload files</div> }));

import { LeaseBuilder } from '@/components/lease-builder/LeaseBuilder';
import { RentStep, TermStep } from '@/components/lease-builder/steps';

const template = {
  id: 't1',
  name: 'Standard',
  version: 1,
  items: STANDARD_ITEMS,
  defaultFees: STANDARD_FEES,
};
const draft = withResolvedEnd(
  emptyDraft({
    unitId: 'u1',
    startDate: '2035-01-15',
    monthlyRent: '1600',
    deposit: '1600',
    template,
  }),
);

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(cleanup);

describe('light Term and Rent steps', () => {
  it('renders term choices with computed end dates and no hard-coded specimen dates', () => {
    render(<TermStep draft={draft} update={vi.fn()} errors={{}} />);
    expect(screen.getByText('Full year')).toBeTruthy();
    expect(screen.getByText(/Ends January 14, 2036/)).toBeTruthy();
    expect(screen.getByText(/First period ends January 31, 2035/)).toBeTruthy();
    expect(screen.queryByText(/May 14, 2028/)).toBeNull();
    expect(screen.getByLabelText(/^Start date/)).toBeTruthy();
  });

  it('shows rent, due-day options, proration and charge preview from the draft', () => {
    render(<RentStep draft={draft} update={vi.fn()} errors={{}} />);
    expect(screen.getByLabelText(/Monthly rent/)).toBeTruthy();
    expect(screen.getByLabelText(/Security deposit/)).toBeTruthy();
    expect(screen.getAllByRole('option')).toHaveLength(28);
    expect(screen.getByText('Scheduled charges preview')).toBeTruthy();
  });

  it('links the custom end-date error to its control and shows the preview disclosure', () => {
    const errors = { endDate: 'End date must be on or after start date.' };
    const { unmount } = render(<TermStep draft={draft} update={vi.fn()} errors={errors} />);
    const custom = document.getElementById('custom-end-date') as HTMLInputElement;
    expect(custom).toBeTruthy();
    expect(custom.getAttribute('aria-invalid')).toBe('true');
    const describedBy = custom.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy as string)?.textContent).toContain(
      'End date must be on or after start date.',
    );
    unmount();
    render(<RentStep draft={draft} update={vi.fn()} errors={{}} />);
    expect(
      screen.getByText('Preview only. Charges are created when the lease is sent or activated.'),
    ).toBeTruthy();
  });

  it('toggles optional fees and associates enabled amount errors with labelled fields', () => {
    const update = vi.fn();
    const enabled = {
      ...draft,
      moveInFeeEnabled: true,
      moveInFee: '',
      petDepositEnabled: true,
      petDeposit: '0',
      lateFeeEnabled: true,
      graceDays: 40,
    };
    const errors = {
      moveInFee: 'Enter a move-in fee greater than zero.',
      petDeposit: 'Enter a pet deposit greater than zero.',
      graceDays: 'Enter 0 to 31 days.',
      lateFee: 'Enter a valid late fee.',
    };
    render(<RentStep draft={enabled} update={update} errors={errors} />);
    for (const [label, message] of [
      ['Move-in fee amount', errors.moveInFee],
      ['Pet deposit amount', errors.petDeposit],
      ['Late fee grace period (days)', errors.graceDays],
      ['Late fee amount', errors.lateFee],
    ] as const) {
      const field = screen.getByLabelText((text) => text.startsWith(label));
      expect(field.getAttribute('aria-invalid')).toBe('true');
      const id = field.getAttribute('aria-describedby');
      expect(id).toBeTruthy();
      expect(document.getElementById(id as string)?.textContent).toContain(message);
      fireEvent.click(field);
      expect(update).not.toHaveBeenCalled();
    }
    fireEvent.click(screen.getByRole('checkbox', { name: /Move-in fee/ }));
    expect(update).toHaveBeenCalledWith({ moveInFeeEnabled: false });
  });

  it('exposes the accessible step list, draft status and next destination', () => {
    render(
      <LeaseBuilder
        placeLabel="Maple Court · Unit 3A"
        tenants={[]}
        leaseId={null}
        renewId={null}
        draft={draft}
        templates={[template]}
        step={0}
        furthestStep={0}
        attachments={[]}
        backHref="/properties/maple/leases"
        exitHref="/leases?tab=drafts"
      />,
    );
    expect(screen.getByRole('list', { name: 'All 10 lease creation steps' })).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe('Not saved yet');
    const next = screen.getByRole('button', { name: /Next/ });
    expect(next.getAttribute('data-next-step')).toBe('1');
    expect(screen.getByRole('button', { name: 'Back' }).hasAttribute('disabled')).toBe(true);
  });
});
