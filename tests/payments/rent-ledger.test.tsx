// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RentLedger, RentLedgerRows } from '@/components/payments/RentLedger';
import type { LedgerRowView } from '@/components/payments/ledger-view';
import {
  PaymentsBoard,
  type BoardGroup,
} from '@/components/workspace/panels/leasing/PaymentsBoard';

const mocks = vi.hoisted(() => ({ charge: vi.fn(), payment: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => '/properties/property/payments',
}));
vi.mock('@/components/workspace/panels/leasing/actions', () => ({
  createPropertyChargeAction: mocks.charge,
  recordPropertyPaymentAction: mocks.payment,
}));

const row = (over: Partial<LedgerRowView>): LedgerRowView => ({
  key: 'k',
  type: 'Rent',
  description: 'October rent',
  dateLabel: 'Oct 1, 2026',
  amountCents: 169_000,
  paidCents: 0,
  balanceCents: 169_000,
  status: 'LATE',
  derived: false,
  applied: [],
  ...over,
});
const rows = [
  row({
    key: 'nov',
    description: 'November rent',
    dateLabel: 'Nov 1, 2026',
    status: 'SCHEDULED',
    derived: true,
  }),
  row({ key: 'oct' }),
  row({
    key: 'sep',
    description: 'September rent',
    dateLabel: 'Sep 1, 2026',
    status: 'PARTIAL',
    paidCents: 100_000,
    balanceCents: 69_000,
    applied: [
      {
        id: 'p1',
        amountCents: 100_000,
        dateLabel: 'Sep 3, 2026',
        method: 'Cash or check (recorded manually)',
      },
    ],
  }),
  row({
    key: 'fee',
    type: 'Late fee',
    description: 'September late fee',
    amountCents: 5_000,
    balanceCents: 5_000,
  }),
];
const groups: BoardGroup[] = [
  {
    leaseId: 'A',
    label: 'Jan 2026 – Dec 2026',
    place: '',
    active: true,
    tenantNames: 'Sam Wilson',
    balanceCents: 243_000,
    rows,
    payments: [],
  },
  {
    leaseId: 'OLD',
    label: 'Jan 2025 – Dec 2025',
    place: '',
    active: false,
    tenantNames: 'Olive Old',
    balanceCents: 0,
    rows: [
      row({
        key: 'old',
        description: 'December rent',
        dateLabel: 'Dec 1, 2025',
        status: 'PAID',
        paidCents: 169_000,
        balanceCents: 0,
      }),
    ],
    payments: [],
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
});
afterEach(cleanup);

describe('shared Rent ledger', () => {
  it('reads the lease view: balance, last payment and every row with status', async () => {
    const user = userEvent.setup();
    render(
      <RentLedger
        scope="This lease only · Jan 2026 – Dec 2026"
        balanceCents={243_000}
        lastPayment={{ dateLabel: 'Sep 3, 2026', amountCents: 100_000 }}
      >
        <RentLedgerRows
          groups={[
            {
              id: 'A',
              heading: '18 Elm Street',
              meta: '',
              balanceCents: 243_000,
              active: true,
              rows,
            },
          ]}
          groupHeadings={false}
        />
      </RentLedger>,
    );
    const ledger = screen.getByRole('region', { name: 'Rent ledger' });
    expect(within(ledger).getByTestId('ledger-scope').textContent).toBe(
      'This lease only · Jan 2026 – Dec 2026',
    );
    expect(within(ledger).getByTestId('balance').textContent).toBe('$2,430.00');
    expect(within(ledger).getByTestId('last-payment').textContent).toBe('Sep 3, 2026$1,000.00');
    const items = within(ledger).getAllByRole('listitem');
    expect(items).toHaveLength(4);
    expect(items.map((li) => li.getAttribute('data-status'))).toEqual([
      'SCHEDULED',
      'LATE',
      'PARTIAL',
      'LATE',
    ]);
    expect(within(items[2]).getByText('Partially paid')).toBeTruthy();
    expect(within(items[2]).getByText('$690.00 left')).toBeTruthy();
    expect(within(items[3]).getByText('Late fee')).toBeTruthy();
    expect(screen.queryByRole('checkbox')).toBeNull();
    // Details open from the keyboard and list the applied payment.
    within(items[2])
      .getByRole('button', { name: 'Details for September rent, Sep 1, 2026' })
      .focus();
    await user.keyboard('{Enter}');
    const dialog = screen.getByRole('dialog', { name: 'September rent' });
    expect(within(dialog).getByText('Cash or check (recorded manually)')).toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: 'Done' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('labels credit and an empty ledger plainly', () => {
    render(
      <RentLedger scope="Whole property" balanceCents={-2_500} lastPayment={null}>
        <RentLedgerRows groups={[]} groupHeadings />
      </RentLedger>,
    );
    expect(screen.getByText('Credit on account')).toBeTruthy();
    expect(screen.getByTestId('balance').textContent).toBe('$25.00');
    expect(screen.getByTestId('last-payment').textContent).toBe('None yet');
    expect(screen.getByText('No charges due yet.')).toBeTruthy();
  });
});

describe('property Payments board in the Rent ledger language', () => {
  const props = {
    propertyId: 'property',
    scopeLabel: 'Whole property · 1 active lease · 1 ended lease',
    balanceCents: 243_000,
    lastPayment: { dateLabel: 'Sep 3, 2026', amountCents: 100_000 },
    endedBalanceCents: 0,
    providerLabel: 'Sandbox payments',
    providerConnected: true,
    remindersHref: '/notifications?propertyId=property',
    tenants: [{ id: 't', name: 'Sam Wilson', initials: 'SW' }],
    groups,
    summary: null,
    openRecord: false,
    today: '2026-10-21',
  };

  it('keeps every action, the full history and ended leases folded but listed', async () => {
    const user = userEvent.setup();
    render(<PaymentsBoard {...props} endedBalanceCents={90_000} />);
    const ledger = screen.getByRole('region', { name: 'Rent ledger' });
    expect(within(ledger).getByTestId('ledger-scope').textContent).toBe(props.scopeLabel);
    expect(within(ledger).getByTestId('last-payment').textContent).toContain('Sep 3, 2026');
    for (const name of ['Create a charge', 'Record payment'])
      expect(screen.getByRole('button', { name })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Reminders & history' }).getAttribute('href')).toBe(
      props.remindersHref,
    );
    expect(screen.getByRole('link', { name: 'Settings' })).toBeTruthy();
    expect(screen.getByTestId('ended-balance').textContent).toContain('$900.00');
    const ended = screen.getByRole('button', { name: /Olive Old/ });
    expect(ended.getAttribute('aria-expanded')).toBe('false');
    expect(ended.textContent).toContain('Ended');
    await user.click(ended);
    expect(screen.getByRole('list', { name: 'Olive Old' })).toBeTruthy();
    expect(
      within(screen.getByRole('list', { name: 'Sam Wilson' })).getAllByRole('listitem'),
    ).toHaveLength(4);
  });

  it('records a payment for selected charges with their outstanding total', async () => {
    const user = userEvent.setup();
    render(<PaymentsBoard {...props} />);
    await user.click(screen.getByRole('checkbox', { name: 'Select October rent, Oct 1, 2026' }));
    await user.click(screen.getByRole('checkbox', { name: 'Select September rent, Sep 1, 2026' }));
    expect(screen.getByRole('status').textContent).toContain('2 selected · $2,380.00 outstanding');
    await user.click(screen.getByRole('button', { name: 'Record payment for selected' }));
    const dialog = screen.getByRole('dialog', { name: 'Record payment' });
    expect(
      (within(dialog).getByRole('textbox', { name: /^Amount/ }) as HTMLInputElement).value,
    ).toBe('2380.00');
    await user.click(within(dialog).getByRole('button', { name: 'Save payment' }));
    await waitFor(() => expect(mocks.payment).toHaveBeenCalledOnce());
    expect(mocks.payment.mock.calls[0][0].get('leaseId')).toBe('A');
    await user.click(screen.getByRole('checkbox', { name: 'Select all charges' }));
    expect(screen.getByRole('status').textContent).toContain('5 selected');
  });
});

describe('Record payment keeps the lease it was started for', () => {
  // Two non-overlapping ACTIVE terms on one unit: the current one and an already active renewal.
  const terms: BoardGroup[] = [
    {
      leaseId: 'NEXT',
      label: 'Jan 2027 – Dec 2027',
      place: 'Townhome 1',
      active: true,
      tenantNames: 'Sam Wilson',
      balanceCents: 0,
      rows: [row({ key: 'jan', description: 'January rent', status: 'SCHEDULED', derived: true })],
      payments: [],
    },
    {
      leaseId: 'NOW',
      label: 'Jan 2026 – Dec 2026',
      place: 'Townhome 1',
      active: true,
      tenantNames: 'Sam Wilson',
      balanceCents: 169_000,
      rows: [row({ key: 'oct' })],
      payments: [],
    },
  ];
  const base = {
    propertyId: 'property',
    unitId: 'unit-1',
    balanceCents: 169_000,
    providerLabel: 'Sandbox payments',
    providerConnected: true,
    tenants: [],
    groups: terms,
    summary: null,
    today: '2026-10-21',
  };
  const leaseSelect = (dialog: HTMLElement) =>
    within(dialog).getByRole('combobox', { name: 'Lease' }) as HTMLSelectElement;

  it('preselects exactly the originating term even when it is not the newest', async () => {
    const user = userEvent.setup();
    render(<PaymentsBoard {...base} openRecord recordLeaseId="NOW" />);
    const dialog = screen.getByRole('dialog', { name: 'Record payment' });
    expect(leaseSelect(dialog).value).toBe('NOW');
    expect(leaseSelect(dialog).selectedOptions[0].textContent).toBe(
      'Townhome 1 · Sam Wilson · Jan 2026 – Dec 2026',
    );
    expect(within(dialog).queryByRole('alert')).toBeNull();
    await user.type(within(dialog).getByRole('textbox', { name: /^Amount/ }), '100');
    await user.click(within(dialog).getByRole('button', { name: 'Save payment' }));
    await waitFor(() => expect(mocks.payment).toHaveBeenCalledOnce());
    expect(mocks.payment.mock.calls[0][0].get('leaseId')).toBe('NOW');
  });

  it('never substitutes another term for a stale or foreign target', async () => {
    const user = userEvent.setup();
    render(<PaymentsBoard {...base} openRecord recordLeaseId="ENDED-OR-FOREIGN" />);
    const dialog = screen.getByRole('dialog', { name: 'Record payment' });
    expect(within(dialog).getByRole('alert').textContent).toContain(
      'can no longer take payments here',
    );
    const select = leaseSelect(dialog);
    expect(select.value).toBe('');
    expect(select.required).toBe(true);
    await user.selectOptions(select, 'NEXT');
    expect(select.value).toBe('NEXT');
  });

  it('asks for a choice with a single active lease when the target is stale', () => {
    render(
      <PaymentsBoard {...base} groups={[terms[1]]} openRecord recordLeaseId="OLD-TERM" />,
    );
    const dialog = screen.getByRole('dialog', { name: 'Record payment' });
    expect(leaseSelect(dialog).value).toBe('');
    expect(within(dialog).getByRole('alert')).toBeTruthy();
  });

  it('explains a stale target when nothing in scope can take payments', () => {
    render(
      <PaymentsBoard
        {...base}
        groups={[{ ...terms[1], active: false }]}
        openRecord
        recordLeaseId="NOW"
      />,
    );
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByTestId('stale-lease').textContent).toContain('not in this unit');
  });

  it('does not default to the newest term when several are active', async () => {
    const user = userEvent.setup();
    render(<PaymentsBoard {...base} openRecord={false} />);
    await user.click(screen.getByRole('button', { name: 'Record payment' }));
    const dialog = screen.getByRole('dialog', { name: 'Record payment' });
    expect(leaseSelect(dialog).value).toBe('');
  });

  it('names the single lease in the dialog when there is no choice to make', async () => {
    const user = userEvent.setup();
    render(<PaymentsBoard {...base} groups={[terms[1]]} openRecord={false} />);
    await user.click(screen.getByRole('button', { name: 'Record payment' }));
    const dialog = screen.getByRole('dialog', { name: 'Record payment' });
    expect(within(dialog).getByTestId('dialog-lease').textContent).toBe(
      'Townhome 1 · Sam Wilson · Jan 2026 – Dec 2026',
    );
  });
});

describe('payment-only and ended-only history stays discoverable', () => {
  const credit: BoardGroup = {
    leaseId: 'PREV',
    label: 'Jan 2025 – Dec 2025',
    place: '',
    active: false,
    tenantNames: 'Pat Prev',
    balanceCents: -10_000,
    rows: [],
    payments: [
      {
        id: 'p-prev',
        dateLabel: 'Jun 1, 2025',
        amountCents: 10_000,
        status: 'SUCCEEDED',
        method: 'Cash or check (recorded manually)',
        reference: 'Recorded manually',
        creditCents: 10_000,
      },
      {
        id: 'p-fail',
        dateLabel: 'May 1, 2025',
        amountCents: 80_000,
        status: 'FAILED',
        method: 'Online payment',
        reference: 'Online payment',
        creditCents: 0,
      },
    ],
  };

  it('lists payments with credit for a lease with no charges, by keyboard', async () => {
    const user = userEvent.setup();
    render(
      <PaymentsBoard
        propertyId="property"
        unitId="unit-2"
        balanceCents={0}
        providerLabel="Sandbox payments"
        providerConnected
        tenants={[]}
        groups={[credit]}
        summary={null}
        openRecord={false}
        today="2026-10-21"
      />,
    );
    expect(screen.queryByText('No charges due yet.')).toBeNull();
    const toggle = screen.getByRole('button', { name: /Pat Prev/ });
    expect(toggle.textContent).toContain('Credit $100.00');
    toggle.focus();
    await user.keyboard('{Enter}');
    expect(screen.getByText('No charges on this lease · $100.00 credit.')).toBeTruthy();
    const history = screen.getByRole('list', { name: 'Payments on Pat Prev' });
    const items = within(history).getAllByRole('listitem');
    expect(items.map((li) => li.getAttribute('data-status'))).toEqual(['SUCCEEDED', 'FAILED']);
    expect(within(items[0]).getByText('$100.00 credit')).toBeTruthy();
    expect(within(items[0]).getByText(/Jun 1, 2025/)).toBeTruthy();
    expect(within(items[1]).getByText('Failed')).toBeTruthy();
    expect(screen.queryByRole('checkbox', { name: 'Select all charges' })).toBeNull();
  });

  it('keeps payment history on the lease view and the lease name in charge details', async () => {
    const user = userEvent.setup();
    render(
      <RentLedgerRows
        groups={[
          {
            id: 'A',
            heading: '18 Elm Street',
            meta: 'Jan 2026 – Dec 2026',
            balanceCents: 0,
            active: true,
            rows: [rows[2]],
            payments: [{ ...credit.payments![0], creditCents: 0, reference: 'Rent · Sep 2026' }],
          },
        ]}
        groupHeadings={false}
      />,
    );
    const summary = screen.getByText('Payment history (1 payment)');
    expect(summary.closest('details')?.open).toBe(false);
    await user.click(summary);
    expect(screen.getByText('Rent · Sep 2026')).toBeTruthy();
    await user.click(
      screen.getByRole('button', { name: 'Details for September rent, Sep 1, 2026' }),
    );
    const dialog = screen.getByRole('dialog', { name: 'September rent' });
    expect(within(dialog).getByText('18 Elm Street · Jan 2026 – Dec 2026')).toBeTruthy();
  });

  it('lists ended-only units in the summary without adding them to Balance due', () => {
    render(
      <PaymentsBoard
        propertyId="property"
        balanceCents={169_000}
        endedBalanceCents={50_000}
        providerLabel="Sandbox payments"
        providerConnected
        tenants={[]}
        groups={[]}
        summary={{
          totalBalanceCents: 169_000,
          units: [
            {
              unitId: 'u1',
              leaseId: 'NOW',
              unitLabel: 'Townhome 1',
              tenantNames: 'Sam Wilson',
              balanceCents: 169_000,
              endedBalanceCents: 0,
              endedLeaseCount: 0,
              status: 'LATE',
              nextDue: { dateLabel: 'Nov 1, 2026', amountCents: 169_000 },
            },
            {
              unitId: 'u2',
              leaseId: 'GONE',
              unitLabel: 'Townhome 2',
              tenantNames: 'Gale Gone',
              balanceCents: 0,
              endedBalanceCents: 50_000,
              endedLeaseCount: 1,
              status: 'ENDED',
              nextDue: null,
            },
          ],
        }}
        openRecord={false}
        today="2026-10-21"
      />,
    );
    const table = screen.getByRole('table', { name: 'Unit balances' });
    const ended = within(table).getByRole('link', { name: 'Townhome 2' }).closest('tr')!;
    expect(ended.getAttribute('data-status')).toBe('ENDED');
    expect(ended.textContent).toContain('Previous tenant · 1 ended lease');
    expect(ended.textContent).toContain('$500.00 on ended lease');
    expect(within(ended).getByRole('link', { name: 'Open Townhome 2 Rent ledger' })).toBeTruthy();
    expect(table.querySelector('tfoot')?.textContent).toContain('$1,690.00');
    expect(screen.getByTestId('occupied-units').textContent).toBe(
      '1 occupied unit · 1 with ended leases only',
    );
    expect(screen.getByTestId('ended-balance').textContent).toContain(
      'listed on each unit’s Rent ledger',
    );
  });
});