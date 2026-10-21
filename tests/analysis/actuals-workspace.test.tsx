// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RoiWorkspace } from '@/components/analysis/RoiWorkspace';
import { browser } from '@/components/analysis/browser';
import { computeActualReturns, actualPeriod } from '@/lib/returns/actual';
import { payload } from './fixture';
import {
  loadActualReturnsAction,
  loadRoiDraftAction,
  loadSavedRoiAnalysisAction,
} from '@/app/(manager)/roi-analysis/actions';

const routeQuery = vi.hoisted(() => ({ value: null as URLSearchParams | null }));
vi.mock('next/navigation', () => ({ useSearchParams: () => routeQuery.value }));
vi.mock('@/app/(manager)/roi-analysis/actions', () => ({
  loadActualReturnsAction: vi.fn(),
  loadRoiDraftAction: vi.fn(),
  loadSavedRoiAnalysisAction: vi.fn(),
  saveRoiAnalysisAction: vi.fn(),
}));

const properties = ['a', 'b'].map((id) => ({
  id,
  name: `Property ${id}`,
  street: `${id} Main`,
  city: 'Austin',
  state: 'TX',
  postalCode: '78701',
  units: [],
}));
const facts = {
  downPayment: null,
  annualDebtService: 0,
  scheduledMonthlyRent: null,
  expenses: [],
  expenseHistoryTruncated: false,
};
const d = (value: string) => new Date(`${value}T00:00:00.000Z`);

/** Recorded actuals for the requested window, as the server action would serialize them. */
function recorded(request: { propertyId: string; from: string; to: string }, empty = false) {
  const p = actualPeriod(request.from, request.to);
  if (!p.ok) throw new Error('bad period');
  const month = request.from.slice(0, 7);
  // A rent charge in every month of the window: the lease ledger evidences the whole period.
  const months: string[] = [];
  for (
    let m = d(`${month}-01`);
    m <= d(request.to);
    m = new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth() + 1, 1))
  )
    months.push(m.toISOString().slice(0, 7));
  const data = computeActualReturns({
    property: {
      id: request.propertyId,
      name: `Property ${request.propertyId}`,
      purchasePriceCents: 30_000_000,
      downPaymentCents: 6_000_000,
      loanAmountCents: 24_000_000,
      annualDebtServiceCents: 1_800_000,
    },
    period: p.period,
    asOf: new Date(`${request.to}T23:00:00Z`),
    leases: empty ? [] : [{ id: 'L1', startDate: d('2020-01-01'), endDate: d('2030-12-31') }],
    charges: empty
      ? []
      : months.map((m) => ({
          id: `c-${m}`,
          leaseId: 'L1',
          kind: 'RENT' as const,
          amountCents: 123_400,
          dueDate: d(`${m}-01`),
        })),
    payments: empty
      ? []
      : [
          {
            id: 'p1',
            leaseId: 'L1',
            amountCents: 123_400,
            paidAt: d(`${month}-02`),
            createdAt: d(`${month}-02`),
          },
        ],
    excludedPayments: [],
    expenses: [],
    expenseDays: [],
    earliestExpenseOn: null,
  });
  return { ok: true as const, data: JSON.parse(JSON.stringify(data)) };
}

const make = (id = 'a') => {
  const p = payload(id);
  p.scenarios = [];
  p.benchmarks = [];
  return p;
};
const lastRequest = () =>
  vi.mocked(loadActualReturnsAction).mock.calls.at(-1)![0] as {
    propertyId: string;
    from: string;
    to: string;
  };
const panel = () => within(document.getElementById('roi-section-panel-actual')!);

beforeEach(() => {
  vi.resetAllMocks();
  routeQuery.value = null;
  vi.mocked(loadSavedRoiAnalysisAction).mockResolvedValue({ ok: true, data: null });
  vi.mocked(loadRoiDraftAction).mockImplementation(async (id) => ({
    ok: true,
    data: { payload: make(id), missing: [], facts },
  }));
  vi.mocked(loadActualReturnsAction).mockImplementation(async (request) =>
    recorded(request as { propertyId: string; from: string; to: string }),
  );
  window.history.replaceState(null, '', '/roi-analysis');
});
afterEach(cleanup);

async function open(query?: string) {
  if (query) {
    routeQuery.value = new URLSearchParams(query);
    window.history.replaceState(null, '', `/roi-analysis?${query}`);
  }
  render(<RoiWorkspace selection={{ ok: true, data: properties }} />);
  if (!query) fireEvent.click(screen.getByRole('button', { name: /Property a/ }));
  await screen.findByRole('button', { name: 'Save draft' });
}

describe('actual versus projected in the ROI workspace', () => {
  it('shows recorded actuals beside the projection and keeps view and period in the URL', async () => {
    await open();
    await waitFor(() => expect(loadActualReturnsAction).toHaveBeenCalled());
    expect(lastRequest()).toMatchObject({ propertyId: 'a' });
    // The Summary card already pairs recorded and projected income.
    expect(await screen.findByRole('heading', { name: 'Actual vs projected' })).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: 'Actual vs projected' }));
    expect(window.location.search).toBe('?property=a&view=actual');
    const table = await panel().findByRole('table');
    const income = within(table).getByRole('row', { name: /Operating income/ });
    expect(within(income).getByText('$1,234')).toBeTruthy();
    expect(within(income).getByText('Recorded')).toBeTruthy();
    expect(within(income).getAllByText('Projected').length).toBeGreaterThan(0);
    // Expenses were never recorded: unavailable, not $0, with a way to add them.
    const expenses = within(table).getByRole('row', { name: /Operating expenses/ });
    expect(within(expenses).getByText('Not recorded')).toBeTruthy();
    expect(within(expenses).queryByText('$0')).toBeNull();
    expect(panel().getByRole('link', { name: 'Add expense' }).getAttribute('href')).toBe(
      '/returns?property=a&add=1#add-expense',
    );

    fireEvent.click(panel().getByRole('button', { name: 'YTD' }));
    expect(window.location.search).toBe('?property=a&view=actual&period=YTD');
    await waitFor(() => expect(lastRequest().from).toMatch(/^\d{4}-01-01$/));
    // The shared period stays in the address on other tabs, so a reload keeps it.
    fireEvent.click(screen.getByRole('tab', { name: 'Summary' }));
    expect(window.location.search).toBe('?property=a&period=YTD');
  });

  it('keeps the actual view and period when switching properties', async () => {
    await open('property=a&view=actual&period=QTD');
    expect(
      screen.getByRole('tab', { name: 'Actual vs projected' }).getAttribute('aria-selected'),
    ).toBe('true');
    await waitFor(() => expect(lastRequest()).toMatchObject({ propertyId: 'a' }));
    const qtdFrom = lastRequest().from;
    fireEvent.click(screen.getByRole('button', { name: 'Change property' }));
    fireEvent.click(await screen.findByRole('button', { name: /Property b/ }));
    await screen.findByRole('button', { name: 'Save draft' });
    expect(window.location.search).toBe('?property=b&view=actual&period=QTD');
    expect(
      screen.getByRole('tab', { name: 'Actual vs projected' }).getAttribute('aria-selected'),
    ).toBe('true');
    await waitFor(() => expect(lastRequest()).toMatchObject({ propertyId: 'b', from: qtdFrom }));
    expect(await panel().findByText(/Property b · Whole property/)).toBeTruthy();
  });

  it('shows missing actuals and missing assumptions as needed inputs, each side independently', async () => {
    const incomplete = make('a');
    if (incomplete.input.income) incomplete.input.income.monthlyRent = null as never;
    vi.mocked(loadRoiDraftAction).mockResolvedValue({
      ok: true,
      data: { payload: incomplete, missing: [], facts },
    });
    vi.mocked(loadActualReturnsAction).mockImplementation(async (request) =>
      recorded(request as { propertyId: string; from: string; to: string }, true),
    );
    await open('property=a&view=actual');
    const table = await panel().findByRole('table');
    for (const name of [/Operating income/, /Net operating income/])
      expect(
        within(within(table).getByRole('row', { name })).getByText('Not recorded'),
      ).toBeTruthy();
    expect(within(table).getAllByText('No projection').length).toBe(5);
    expect(within(table).queryByText('Projected')).toBeNull();
    expect(panel().getByRole('link', { name: 'Add a lease' }).getAttribute('href')).toBe(
      '/properties/a/leases',
    );
    // Baseline assumptions are completed in the property's editor, returning to this view.
    const assign = vi.spyOn(browser, 'assign').mockImplementation(() => {});
    fireEvent.click(panel().getByRole('button', { name: 'Review assumptions' }));
    const href = new URL(assign.mock.calls[0][0], 'http://local.test');
    expect(href.pathname).toBe('/properties/a/edit');
    expect(href.searchParams.get('returnTo')).toBe('/roi-analysis?property=a&view=actual');
    expect(href.searchParams.get('field')).toBe('input.income.monthlyRent');
    expect(href.hash).toBe('#roi-details');
    assign.mockRestore();
  });

  it('restores view and period from the complete URL on Back, including absent parameters', async () => {
    await open('property=a');
    expect(screen.getByRole('tab', { name: 'Summary' }).getAttribute('aria-selected')).toBe('true');
    await waitFor(() => expect(lastRequest()).toMatchObject({ propertyId: 'a' }));
    const defaultFrom = lastRequest().from;
    fireEvent.click(screen.getByRole('tab', { name: 'Actual vs projected' }));
    fireEvent.click(panel().getByRole('button', { name: 'YTD' }));
    // Switching property pushes a history entry that keeps the shared view and period.
    fireEvent.click(screen.getByRole('button', { name: 'Change property' }));
    fireEvent.click(await screen.findByRole('button', { name: /Property b/ }));
    await screen.findByRole('button', { name: 'Save draft' });
    expect(window.location.search).toBe('?property=b&view=actual&period=YTD');

    // Back to the plain default address: Summary and the default period, not the last tab.
    window.history.replaceState(null, '', '/roi-analysis?property=a');
    fireEvent(window, new PopStateEvent('popstate'));
    await waitFor(() =>
      expect(screen.getByRole('tab', { name: 'Summary' }).getAttribute('aria-selected')).toBe(
        'true',
      ),
    );
    await waitFor(() =>
      expect(lastRequest()).toMatchObject({ propertyId: 'a', from: defaultFrom }),
    );
    expect(
      panel().getByRole('button', { name: '12M', hidden: true }).getAttribute('aria-pressed'),
    ).toBe('true');

    // Forward to a custom address restores its exact months.
    window.history.replaceState(
      null,
      '',
      '/roi-analysis?property=a&view=actual&period=CUSTOM&from=2026-01&to=2026-03',
    );
    fireEvent(window, new PopStateEvent('popstate'));
    await waitFor(() =>
      expect(lastRequest()).toMatchObject({ from: '2026-01-01', to: '2026-03-31' }),
    );
    expect(
      screen.getByRole('tab', { name: 'Actual vs projected' }).getAttribute('aria-selected'),
    ).toBe('true');
  });

  it('exports exactly the displayed property, days and statuses', async () => {
    let blob: Blob | null = null;
    const create = vi.fn((b: Blob) => {
      blob = b;
      return 'blob:test';
    });
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    await open('property=a&view=actual&period=CUSTOM&from=2026-01&to=2026-03');
    const table = await panel().findByRole('table');
    expect(within(table).getByRole('row', { name: /Operating income/ })).toBeTruthy();
    fireEvent.click(panel().getByRole('button', { name: 'Export this comparison (CSV)' }));
    expect(create).toHaveBeenCalledTimes(1);
    const csv = await blob!.text();
    expect(csv).toContain('Property,Property a');
    expect(csv).toContain('Period from,2026-01-01');
    expect(csv).toContain('Period to (inclusive),2026-03-31');
    expect(csv).toMatch(/Operating income,recorded,1234\.00,projected,/);
    // Unavailable stays blank with its status, never 0.
    expect(csv).toMatch(/Operating expenses,unavailable,,projected,/);
    expect(
      await panel().findByText(
        'Exported actual-vs-projected-property-a-2026-01-01-to-2026-03-31.csv',
      ),
    ).toBeTruthy();
    expect(
      panel().getByRole('link', { name: 'Portfolio returns (estimates)' }).getAttribute('href'),
    ).toBe('/returns?property=a&period=CUSTOM&from=2026-01&to=2026-03');
    click.mockRestore();
  });

  it('keeps the projection usable when actuals cannot load', async () => {
    vi.mocked(loadActualReturnsAction).mockRejectedValue(new Error('offline'));
    await open();
    const summary = within(screen.getByRole('region', { name: 'Year 1 at a glance' }));
    expect(summary.queryAllByText('Unavailable').length).toBe(0);
    fireEvent.click(screen.getByRole('tab', { name: 'Actual vs projected' }));
    expect(
      await panel().findByText(
        'Could not load recorded returns. Your analysis is unaffected. Try again.',
      ),
    ).toBeTruthy();
    vi.mocked(loadActualReturnsAction).mockImplementation(async (request) =>
      recorded(request as { propertyId: string; from: string; to: string }),
    );
    fireEvent.click(panel().getByRole('button', { name: 'Retry loading actuals' }));
    expect(await panel().findByRole('table')).toBeTruthy();
  });
});
