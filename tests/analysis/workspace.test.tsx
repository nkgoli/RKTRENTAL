// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RoiWorkspace } from '@/components/analysis/RoiWorkspace';
import { applyValues, valuesFrom } from '@/components/analysis/fields';
import { PayloadSchema, calculatePayload, issues } from '@/lib/analysis';
import { payload } from './fixture';
import { cashPayload } from './cash-fixture';
import {
  loadRoiDraftAction,
  loadSavedRoiAnalysisAction,
  saveRoiAnalysisAction,
} from '@/app/(manager)/roi-analysis/actions';
const routeQuery = vi.hoisted(() => ({ value: null as URLSearchParams | null }));
vi.mock('next/navigation', () => ({ useSearchParams: () => routeQuery.value }));
vi.mock('@/app/(manager)/roi-analysis/actions', () => ({
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
const make = (id = 'a') => {
  const p = payload(id);
  p.scenarios = [];
  p.benchmarks = [];
  return p;
};
beforeEach(() => {
  vi.resetAllMocks();
  routeQuery.value = null;
  vi.mocked(loadSavedRoiAnalysisAction).mockResolvedValue({ ok: true, data: null });
  vi.mocked(loadRoiDraftAction).mockImplementation(async (id) => ({
    ok: true,
    data: { payload: make(id), missing: [], facts },
  }));
  vi.mocked(saveRoiAnalysisAction).mockImplementation(async (request) => {
    const r = request as {
      propertyId: string;
      payload: ReturnType<typeof make>;
      status: 'DRAFT' | 'READY';
      expectedRevision: number;
    };
    return {
      ok: true,
      data: {
        ...r,
        revision: r.expectedRevision + 1,
        missing: [],
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
    };
  });
  window.history.replaceState(null, '', '/roi-analysis');
});
afterEach(cleanup);
async function open() {
  render(<RoiWorkspace selection={{ ok: true, data: properties }} />);
  fireEvent.click(screen.getByRole('button', { name: /Property a/ }));
  await screen.findByRole('button', { name: 'Save draft' });
}
const rent = () => document.getElementById('input.income.monthlyRent') as HTMLInputElement;
describe('property autofill and calculation sufficiency', () => {
  it('calculates cash with unknown loan terms and stops when its applicable cost basis is cleared', async () => {
    const p = cashPayload('a');
    vi.mocked(loadRoiDraftAction).mockResolvedValueOnce({
      ok: true,
      data: { payload: p, missing: [], facts },
    });
    await open();
    const summary = () => within(screen.getByRole('region', { name: 'Year 1 at a glance' }));
    const field = (path: string) => document.getElementById(path) as HTMLInputElement;
    expect(summary().getByText('$10,800')).toBeTruthy();
    expect(field('input.financing.loanTermYears').value).toBe('');
    expect(field('input.expenses.maintenancePercent').value).toBe('');
    fireEvent.change(field('input.expenses.maintenance'), { target: { value: '' } });
    expect(summary().queryByText('$10,800')).toBeNull();
    expect(
      screen.getByRole('link', { name: /Maintenance.*fixed annual cost or percentage/ }),
    ).toBeTruthy();
    fireEvent.change(field('input.expenses.maintenancePercent'), { target: { value: '0' } });
    expect(summary().getByText('$10,800')).toBeTruthy();
    fireEvent.change(field('input.financing.loanAmount'), { target: { value: '50000' } });
    expect(summary().queryByText('$10,800')).toBeNull();
    expect(screen.getByRole('link', { name: /Interest rate.*financed purchase/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Pay in cash · No loan' }));
    expect(summary().getByText('$10,800')).toBeTruthy();
    expect(field('input.financing.downPaymentPercent').value).toBe('');
    expect(field('input.financing.loanTermYears').value).toBe('');
  });
  it('chooses cash without overwriting saved financing assumptions', async () => {
    const p = make();
    p.input.financing = {
      ...p.input.financing,
      loanAmount: 60000,
      downPaymentPercent: 40,
      interestRate: 5,
    };
    vi.mocked(loadRoiDraftAction).mockResolvedValueOnce({
      ok: true,
      data: { payload: p, missing: [], facts },
    });
    await open();
    fireEvent.click(screen.getByRole('button', { name: 'Pay in cash · No loan' }));
    expect(
      within(screen.getByRole('region', { name: 'Year 1 at a glance' })).getByText('$10,800'),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Save ready' }));
    await waitFor(() => expect(saveRoiAnalysisAction).toHaveBeenCalledOnce());
    expect(vi.mocked(saveRoiAnalysisAction).mock.calls[0][0]).toMatchObject({
      payload: {
        input: {
          financing: { loanAmount: 0, downPaymentPercent: 40, interestRate: 5, loanTermYears: 30 },
        },
      },
    });
  });
  it.each([0, 60000])(
    'calculates saved property defaults on selection with loan %s',
    async (loanAmount) => {
      const p = make();
      p.input.financing = {
        ...p.input.financing,
        loanAmount,
        downPaymentPercent: loanAmount ? 40 : 100,
        interestRate: loanAmount ? 5 : 0,
      };
      vi.mocked(loadRoiDraftAction).mockResolvedValueOnce({
        ok: true,
        data: { payload: p, missing: [], facts },
      });
      await open();
      const expected = calculatePayload(p).base.summaryMetrics.annualCashFlow;
      const formatted = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
      }).format(expected);
      expect(
        within(screen.getByRole('region', { name: 'Year 1 at a glance' })).getByText(formatted),
      ).toBeTruthy();
      expect(rent().value).toBe('1000');
      expect(document.body.textContent).not.toContain('Required');
    },
  );
  it('automatically calculates when the last missing assumption is entered and removes results when cleared', async () => {
    const p = make();
    delete p.input.income!.monthlyRent;
    vi.mocked(loadRoiDraftAction).mockResolvedValueOnce({
      ok: true,
      data: { payload: p, missing: [], facts },
    });
    await open();
    expect(screen.getByRole('link', { name: /Scheduled rent.*Enter a value/ })).toBeTruthy();
    expect(document.body.textContent).not.toContain('input.income');
    fireEvent.change(rent(), { target: { value: '1000' } });
    expect(
      within(screen.getByRole('region', { name: 'Year 1 at a glance' })).getByText('$10,800'),
    ).toBeTruthy();
    fireEvent.change(rent(), { target: { value: '' } });
    expect(screen.queryByText('$10,800')).toBeNull();
  });
  it('loads a saved zero and intentionally missing assumption ahead of complete property defaults', async () => {
    const p = make();
    p.input.income!.monthlyRent = 0;
    delete p.input.expenses!.insurance;
    vi.mocked(loadSavedRoiAnalysisAction).mockResolvedValue({
      ok: true,
      data: {
        propertyId: 'a',
        payload: p,
        revision: 3,
        status: 'DRAFT',
        missing: [],
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
    });
    await open();
    expect(rent().value).toBe('0');
    expect((document.getElementById('input.expenses.insurance') as HTMLInputElement).value).toBe(
      '',
    );
    expect(screen.getByRole('link', { name: /Insurance.*Enter a value/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Reload saved analysis' }));
    await screen.findByText('Loaded draft - revision 3');
    expect(rent().value).toBe('0');
    expect(screen.queryByText('$10,800')).toBeNull();
  });
  it('expands missing sections into real focus targets and keeps a recorded price', async () => {
    const p = make();
    p.input = { purchase: { purchasePrice: 250000 } };
    p.options = {};
    vi.mocked(loadRoiDraftAction).mockResolvedValueOnce({
      ok: true,
      data: { payload: p, missing: [], facts },
    });
    await open();
    expect(
      (document.getElementById('input.purchase.purchasePrice') as HTMLInputElement).value,
    ).toBe('250000');
    const link = screen.getByRole('link', { name: /Property tax.*Enter a value/ });
    fireEvent.click(link);
    await waitFor(() => expect(document.activeElement?.id).toBe('input.expenses.propertyTax'));
    expect(document.body.textContent).not.toMatch(/input\.|options\.|Required/);
  });
});
describe('ROI summary workspace', () => {
  it('supports keyboard selection, guarded switching and correction in a closed disclosure', async () => {
    const user = userEvent.setup();
    render(<RoiWorkspace selection={{ ok: true, data: properties }} />);
    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole('searchbox'));
    await user.keyboard('Property a');
    await user.tab();
    await user.keyboard('{Enter}');
    await screen.findByRole('button', { name: 'Save draft' });
    fireEvent.change(rent(), { target: { value: '' } });
    const disclosure = rent().closest('details')!;
    disclosure.open = false;
    fireEvent.click(screen.getByRole('button', { name: 'Recalculate' }));
    await waitFor(() => expect(document.activeElement).toBe(rent()));
    expect(disclosure.open).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Change property' }));
    const keep = screen.getByRole('button', { name: 'Keep editing' });
    expect(document.activeElement).toBe(keep);
    await user.tab({ shift: true });
    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Correct highlighted assumption' }),
    );
    await user.tab();
    expect(document.activeElement).toBe(keep);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(rent().value).toBe('');
  });
  it('requires explicit searchable selection and rejects foreign URLs', async () => {
    const { unmount } = render(<RoiWorkspace selection={{ ok: true, data: properties }} />);
    expect(loadRoiDraftAction).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'b Main' } });
    expect(screen.queryByRole('button', { name: /Property a/ })).toBeNull();
    unmount();
    render(<RoiWorkspace selection={{ ok: true, data: properties }} initialPropertyId="foreign" />);
    await screen.findByText(/unavailable or archived/);
    expect(loadRoiDraftAction).not.toHaveBeenCalled();
  });
  it('calculates automatically, preserves zero, and clears invalid prior results', async () => {
    await open();
    expect(
      screen.getByText('Calculated automatically from your current assumptions.'),
    ).toBeTruthy();
    fireEvent.change(rent(), { target: { value: '0' } });
    expect(
      within(screen.getByRole('region', { name: 'Year 1 at a glance' })).getByText('-$1,200'),
    ).toBeTruthy();
    fireEvent.change(rent(), { target: { value: '' } });
    expect(screen.queryByText('-$1,200')).toBeNull();
    expect(screen.getByText(/No valid projection is available yet/)).toBeTruthy();
    expect(rent().value).toBe('');
    fireEvent.click(screen.getByRole('button', { name: 'Save ready' }));
    expect(saveRoiAnalysisAction).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    await waitFor(() => expect(saveRoiAnalysisAction).toHaveBeenCalled());
    expect(
      (vi.mocked(saveRoiAnalysisAction).mock.calls[0][0] as { payload: ReturnType<typeof make> })
        .payload.input.income?.monthlyRent,
    ).toBeUndefined();
  });
  it('saves ready, reloads revisions, and keeps edits on conflict and transport failure', async () => {
    await open();
    fireEvent.click(screen.getByRole('button', { name: 'Save ready' }));
    await screen.findByText('Saved ready - revision 1');
    fireEvent.change(rent(), { target: { value: '1200' } });
    vi.mocked(saveRoiAnalysisAction).mockResolvedValueOnce({
      ok: false,
      code: 'CONFLICT',
      currentRevision: 2,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    await screen.findByText(/A newer revision exists/);
    expect(rent().value).toBe('1200');
    fireEvent.click(screen.getByRole('button', { name: 'Reload saved analysis' }));
    fireEvent.click(screen.getByRole('button', { name: 'Discard and continue' }));
    await screen.findByText(/New analysis/);
    vi.mocked(saveRoiAnalysisAction).mockRejectedValueOnce(Error('offline'));
    fireEvent.change(rent(), { target: { value: '1400' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    await screen.findByText(/Could not save/);
    expect(rent().value).toBe('1400');
  });
  it('guards property change with save/discard and ignores a late property response', async () => {
    let resolve!: (v: Awaited<ReturnType<typeof loadRoiDraftAction>>) => void;
    vi.mocked(loadRoiDraftAction).mockImplementationOnce(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    render(<RoiWorkspace selection={{ ok: true, data: properties }} />);
    fireEvent.click(screen.getByRole('button', { name: /Property a/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Change property' }));
    fireEvent.click(screen.getByRole('button', { name: /Property b/ }));
    await screen.findByRole('button', { name: 'Save draft' });
    await act(async () => resolve({ ok: true, data: { payload: make('a'), missing: [], facts } }));
    expect(window.location.search).toBe('?property=b');
    fireEvent.change(rent(), { target: { value: '2222' } });
    fireEvent.click(screen.getByRole('button', { name: 'Change property' }));
    expect(screen.getByRole('alertdialog')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Save draft and continue' }));
    await screen.findByRole('searchbox');
    expect(
      (vi.mocked(saveRoiAnalysisAction).mock.calls[0][0] as { propertyId: string }).propertyId,
    ).toBe('b');
  });
  it('follows changed property props, bare entry and history without stale results', async () => {
    const view = render(
      <RoiWorkspace selection={{ ok: true, data: properties }} initialPropertyId="a" />,
    );
    await screen.findByRole('button', { name: 'Save draft' });
    let resolve!: (v: Awaited<ReturnType<typeof loadRoiDraftAction>>) => void;
    vi.mocked(loadRoiDraftAction).mockImplementationOnce(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    view.rerender(
      <RoiWorkspace selection={{ ok: true, data: properties }} initialPropertyId="b" />,
    );
    expect(screen.queryByRole('button', { name: 'Save draft' })).toBeNull();
    expect(screen.getByText('Property b')).toBeTruthy();
    view.rerender(
      <RoiWorkspace selection={{ ok: true, data: properties }} initialPropertyId="foreign" />,
    );
    await screen.findByText(/unavailable or archived/);
    await act(async () => resolve({ ok: true, data: { payload: make('b'), missing: [], facts } }));
    expect(screen.queryByRole('button', { name: 'Save draft' })).toBeNull();
    view.rerender(<RoiWorkspace selection={{ ok: true, data: properties }} />);
    expect(screen.getByRole('searchbox')).toBeTruthy();
    act(() => {
      window.history.replaceState(null, '', '/roi-analysis?property=a');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await screen.findByRole('button', { name: 'Save draft' });
    act(() => {
      window.history.replaceState(null, '', '/roi-analysis');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(screen.getByRole('searchbox')).toBeTruthy();
  });
  it('guards external navigation, restores cancel focus and preserves the intended destination through correction', async () => {
    const view = render(
      <RoiWorkspace selection={{ ok: true, data: properties }} initialPropertyId="a" />,
    );
    await screen.findByRole('button', { name: 'Save draft' });
    fireEvent.change(rent(), { target: { value: 'invalid rent' } });
    rent().focus();
    view.rerender(
      <RoiWorkspace selection={{ ok: true, data: properties }} initialPropertyId="b" />,
    );
    expect(screen.getByRole('alertdialog')).toBeTruthy();
    expect(window.location.search).toBe('?property=a');
    fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }));
    await waitFor(() => expect(document.activeElement).toBe(rent()));
    const change = screen.getByRole('button', { name: 'Change property' });
    change.focus();
    fireEvent.click(change);
    fireEvent.click(screen.getByRole('button', { name: 'Save draft and continue' }));
    expect(saveRoiAnalysisAction).not.toHaveBeenCalled();
    expect(screen.getByRole('alertdialog').contains(document.activeElement)).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Correct highlighted assumption' }));
    await waitFor(() => expect(document.activeElement).toBe(rent()));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(rent().value).toBe('invalid rent');
    fireEvent.change(rent(), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue property change' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save draft and continue' }));
    await screen.findByRole('searchbox');
    expect(saveRoiAnalysisAction).toHaveBeenCalledWith(
      expect.objectContaining({ propertyId: 'a' }),
    );
  });
  it('discards invalid edits explicitly and clears revoked authorization', async () => {
    const view = render(
      <RoiWorkspace selection={{ ok: true, data: properties }} initialPropertyId="a" />,
    );
    await screen.findByRole('button', { name: 'Save draft' });
    fireEvent.change(rent(), { target: { value: 'bad' } });
    view.rerender(
      <RoiWorkspace selection={{ ok: true, data: properties }} initialPropertyId="b" />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Discard and continue' }));
    await screen.findByRole('button', { name: 'Save draft' });
    expect(screen.getByText('Property b')).toBeTruthy();
    expect(rent().value).not.toBe('bad');
    view.rerender(<RoiWorkspace selection={{ ok: true, data: [] }} initialPropertyId="b" />);
    await screen.findByText(/unavailable or archived/);
    expect(screen.queryByRole('button', { name: 'Save draft' })).toBeNull();
  });
  it('keeps failed draft focus visible and resumes navigation after correction', async () => {
    const user = userEvent.setup();
    await open();
    fireEvent.change(rent(), { target: { value: 'not a number' } });
    const disclosure = rent().closest('details')!;
    disclosure.open = false;
    await user.click(screen.getByRole('button', { name: 'Change property' }));
    await user.click(screen.getByRole('button', { name: 'Save draft and continue' }));
    const dialog = screen.getByRole('alertdialog');
    expect(dialog.contains(document.activeElement)).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Correct highlighted assumption' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(document.activeElement).toBe(rent());
    expect(disclosure.open).toBe(true);
    expect(rent().value).toBe('not a number');
    fireEvent.change(rent(), { target: { value: '1111' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue property change' }));
    fireEvent.click(screen.getByRole('button', { name: 'Discard and continue' }));
    await screen.findByRole('searchbox');
  });
  it('retains a dirty router destination while correcting and saving', async () => {
    const view = render(
      <RoiWorkspace selection={{ ok: true, data: properties }} initialPropertyId="a" />,
    );
    await screen.findByRole('button', { name: 'Save draft' });
    fireEvent.change(rent(), { target: { value: 'bad' } });
    view.rerender(
      <RoiWorkspace selection={{ ok: true, data: properties }} initialPropertyId="b" />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save draft and continue' }));
    fireEvent.click(screen.getByRole('button', { name: 'Correct highlighted assumption' }));
    fireEvent.change(rent(), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue property change' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save draft and continue' }));
    await screen.findByText('Property b');
    await screen.findByRole('button', { name: 'Save draft' });
    expect(window.location.search).toBe('?property=b');
    expect(saveRoiAnalysisAction).toHaveBeenCalledWith(
      expect.objectContaining({ propertyId: 'a' }),
    );
  });
  it('invalidates a late save when clean URL navigation is accepted', async () => {
    const view = render(
      <RoiWorkspace selection={{ ok: true, data: properties }} initialPropertyId="a" />,
    );
    await screen.findByRole('button', { name: 'Save draft' });
    let resolve!: (v: Awaited<ReturnType<typeof saveRoiAnalysisAction>>) => void;
    vi.mocked(saveRoiAnalysisAction).mockImplementationOnce(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    view.rerender(
      <RoiWorkspace selection={{ ok: true, data: properties }} initialPropertyId="b" />,
    );
    await screen.findByRole('button', { name: 'Save draft' });
    await act(async () => resolve({ ok: false, code: 'CONFLICT', currentRevision: 7 }));
    expect(screen.queryByText(/A newer revision exists/)).toBeNull();
    expect(screen.getByText('Property b')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save draft' }).hasAttribute('disabled')).toBe(false);
  });
  it('uses live router queries even when the server initial property prop is unchanged', async () => {
    const selection = { ok: true as const, data: properties };
    routeQuery.value = new URLSearchParams('property=a');
    const view = render(<RoiWorkspace selection={selection} initialPropertyId="a" />);
    await screen.findByRole('button', { name: 'Save draft' });
    routeQuery.value = new URLSearchParams('property=b');
    view.rerender(<RoiWorkspace selection={selection} initialPropertyId="a" />);
    await screen.findByText('Property b');
    await screen.findByRole('button', { name: 'Save draft' });
    routeQuery.value = new URLSearchParams();
    view.rerender(<RoiWorkspace selection={selection} initialPropertyId="a" />);
    expect(screen.getByRole('searchbox')).toBeTruthy();
    routeQuery.value = new URLSearchParams('property=foreign');
    view.rerender(<RoiWorkspace selection={selection} initialPropertyId="a" />);
    await screen.findByText(/unavailable or archived/);
    expect(screen.queryByRole('button', { name: 'Save draft' })).toBeNull();
  });
  it('guards ordinary same-route sidebar links while preserving modified-click gestures', async () => {
    render(
      <>
        <a href="/roi-analysis">ROI sidebar entry</a>
        <a href="/roi-analysis?property=b">Other property route</a>
        <RoiWorkspace selection={{ ok: true, data: properties }} initialPropertyId="a" />
      </>,
    );
    await screen.findByRole('button', { name: 'Save draft' });
    fireEvent.change(rent(), { target: { value: 'bad' } });
    const link = screen.getByRole('link', { name: 'ROI sidebar entry' });
    expect(fireEvent.click(link, { ctrlKey: true })).toBe(true);
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(fireEvent.click(link)).toBe(false);
    expect(screen.getByRole('alertdialog')).toBeTruthy();
    fireEvent.keyDown(screen.getByRole('alertdialog'), { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(rent().value).toBe('bad');
    fireEvent.click(screen.getByRole('link', { name: 'Other property route' }));
    fireEvent.click(screen.getByRole('button', { name: 'Discard and continue' }));
    await screen.findByText('Property b');
    fireEvent.click(link);
    expect(screen.getByRole('searchbox')).toBeTruthy();
  });
  it('keeps all-cash and fixed zero cost overrides in the public payload', () => {
    const p = make();
    const v = valuesFrom(p);
    v['input.financing.loanAmount'] = '0';
    v['input.financing.downPaymentPercent'] = '100';
    v['input.expenses.maintenance'] = '0';
    v['input.expenses.maintenancePercent'] = '8';
    const edited = PayloadSchema.parse(applyValues(p, v, false));
    expect(edited.input.expenses?.maintenance).toBe(0);
    expect(edited.input.financing?.loanAmount).toBe(0);
    v['input.expenses.maintenance'] = '';
    expect(applyValues(p, v, false).input.expenses?.maintenance).toBeUndefined();
  });
});

describe('ROI projection interactions', () => {
  const tab = (name: string) => fireEvent.click(screen.getByRole('tab', { name }));
  const change = (label: string, value: string) =>
    fireEvent.change(screen.getByLabelText(label, { exact: true }), { target: { value } });

  it('supports arrow/Home/End navigation across six working views and exact tables', async () => {
    await open();
    tab('Charts');
    const cash = screen.getByRole('tab', { name: 'Cash Flow' });
    cash.focus();
    const expected = ['Equity', 'Expenses', 'Amortization', 'Exit', 'Sensitivity'];
    for (const name of expected) {
      fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' });
      expect(document.activeElement).toBe(screen.getByRole('tab', { name }));
      expect(document.activeElement?.getAttribute('aria-selected')).toBe('true');
    }
    fireEvent.keyDown(document.activeElement!, { key: 'Home' });
    expect(document.activeElement).toBe(cash);
    const annual = screen.getByRole('table', { name: /Projection amounts/ });
    expect(within(annual).getAllByRole('row')).toHaveLength(2);
    expect(within(annual).getAllByText('$10,800.00')).toHaveLength(3);
    fireEvent.keyDown(cash, { key: 'End' });
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Sensitivity' }));
    tab('Amortization');
    expect(screen.getByText(/All-cash purchase · debt service/)).toBeTruthy();
    expect(screen.queryByRole('table', { name: /Annual loan payments/ })).toBeNull();
  });

  it('preserves typed invalid assumptions across tabs and focuses their recovery from Charts', async () => {
    await open();
    fireEvent.change(rent(), { target: { value: 'not-rent' } });
    tab('Charts');
    tab('Sensitivity');
    expect(screen.queryByRole('button', { name: 'Update sensitivity' })).toBeNull();
    expect(
      screen.getByRole('heading', { name: 'Complete your assumptions to see charts' }),
    ).toBeTruthy();
    expect(screen.queryByRole('table', { name: /Year 1 cash-on-cash/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Recalculate' }));
    await waitFor(() => expect(document.activeElement).toBe(rent()));
    expect(screen.getByRole('tab', { name: 'Summary' }).getAttribute('aria-selected')).toBe('true');
    expect(rent().value).toBe('not-rent');
    fireEvent.change(rent(), { target: { value: '2000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Recalculate' }));
    tab('Charts');
    expect(screen.getByRole('tab', { name: 'Sensitivity' }).getAttribute('aria-selected')).toBe(
      'true',
    );
    expect(screen.getByRole('table', { name: /Year 1 cash-on-cash/ })).toBeTruthy();
    tab('Cash Flow');
    const table = screen.getByRole('table', { name: /Projection amounts/ });
    expect(within(table).getAllByText('$22,800.00')).toHaveLength(3);
  });

  it('recovers invalid probe ranges, retains probe controls across tabs and saves only the base', async () => {
    await open();
    tab('Charts');
    tab('Sensitivity');
    change('Minimum rent ($ / month)', 'bad');
    fireEvent.click(screen.getByRole('button', { name: 'Update sensitivity' }));
    expect(screen.getByRole('alert').textContent).toMatch(/Minimum rent/);
    expect(screen.queryByRole('table', { name: /Year 1 cash-on-cash/ })).toBeNull();
    tab('Equity');
    tab('Sensitivity');
    expect(
      (screen.getByLabelText('Minimum rent ($ / month)', { exact: true }) as HTMLInputElement)
        .value,
    ).toBe('bad');
    change('Minimum rent ($ / month)', '900');
    fireEvent.click(screen.getByRole('button', { name: 'Update sensitivity' }));
    expect(screen.getByRole('table', { name: /Year 1 cash-on-cash/ })).toBeTruthy();
    change('Sensitivity metric', 'irr');
    expect(screen.getByRole('table', { name: /Hold-period leveraged IRR/ })).toBeTruthy();
    change('Sensitivity display', 'values');
    tab('Exit');
    change('Probe exit year', '2.5');
    fireEvent.click(screen.getByRole('button', { name: 'Update exit comparison' }));
    expect(screen.getByRole('alert').textContent).toMatch(/whole number/);
    change('Probe exit year', '5');
    change('Probe selling costs (%)', '6');
    change('Probe sale price override ($)', '80000');
    fireEvent.click(screen.getByRole('button', { name: 'Update exit comparison' }));
    const exit = screen.getByRole('table', { name: /Exit horizon comparison/ });
    expect(within(exit).getByText('$75,200.00')).toBeTruthy();
    expect(within(exit).getByText('$29,200.00')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    await screen.findByText('Saved draft - revision 1');
    fireEvent.click(screen.getByRole('button', { name: 'Save ready' }));
    await screen.findByText('Saved ready - revision 2');
    for (const [call] of vi.mocked(saveRoiAnalysisAction).mock.calls) {
      expect((call as { payload: ReturnType<typeof make> }).payload.input.appreciationExit).toEqual(
        make().input.appreciationExit,
      );
      expect((call as { payload: ReturnType<typeof make> }).payload.input.income).toEqual(
        make().input.income,
      );
    }
    expect(screen.getByRole('tab', { name: 'Exit' }).getAttribute('aria-selected')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Reload saved analysis' }));
    await screen.findByText(/New analysis/);
    expect(screen.getByRole('tab', { name: 'Charts' }).getAttribute('aria-selected')).toBe('true');
    expect(
      (screen.getByLabelText('Probe exit year', { exact: true }) as HTMLInputElement).value,
    ).toBe('1');
  });

  it('recovers incomplete and overflow drafts without losing strings or exposing stale probes', async () => {
    const incomplete = make();
    delete incomplete.input.income!.monthlyRent;
    vi.mocked(loadRoiDraftAction).mockResolvedValueOnce({
      ok: true,
      data: { payload: incomplete, missing: [], facts },
    });
    await open();
    tab('Charts');
    tab('Exit');
    expect(
      screen.getByRole('heading', { name: 'Complete your assumptions to see charts' }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Review assumptions' }));
    await waitFor(() =>
      expect(screen.getByRole('tab', { name: 'Summary' }).getAttribute('aria-selected')).toBe(
        'true',
      ),
    );
    fireEvent.change(rent(), { target: { value: '10000000000' } });
    const growth = document.getElementById('input.income.annualRentGrowth')!;
    const hold = document.getElementById('input.appreciationExit.holdingPeriodYears')!;
    fireEvent.change(growth, { target: { value: '100' } });
    fireEvent.change(hold, { target: { value: '50' } });
    fireEvent.click(screen.getByRole('button', { name: 'Recalculate' }));
    expect(screen.getAllByText(/safe monetary precision/).length).toBeGreaterThan(0);
    expect(rent().value).toBe('10000000000');
    fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    await screen.findByText('Saved draft - revision 1');
    expect(screen.getAllByText(/safe monetary precision/).length).toBeGreaterThan(0);
    fireEvent.change(hold, { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Recalculate' }));
    tab('Charts');
    tab('Exit');
    expect(screen.getByRole('table', { name: /Exit horizon comparison/ })).toBeTruthy();
  });

  it('keeps chart edits guarded and clears all panels on accepted property history changes', async () => {
    await open();
    fireEvent.change(rent(), { target: { value: '2222' } });
    tab('Charts');
    tab('Equity');
    act(() => {
      window.history.replaceState(null, '', '/roi-analysis?property=b');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    expect(screen.getByRole('alertdialog')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }));
    expect(window.location.search).toBe('?property=a');
    expect(screen.getByRole('tab', { name: 'Equity' }).getAttribute('aria-selected')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'Change property' }));
    fireEvent.click(screen.getByRole('button', { name: 'Discard and continue' }));
    expect(screen.queryByRole('tab', { name: 'Charts' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Property b/ }));
    await screen.findByRole('button', { name: 'Save draft' });
    tab('Charts');
    expect(screen.getByRole('tab', { name: 'Cash Flow' }).getAttribute('aria-selected')).toBe(
      'true',
    );
    const table = screen.getByRole('table', { name: /Projection amounts/ });
    expect(within(table).getAllByText('$10,800.00')).toHaveLength(3);
  });
});

describe('scenario examples and merged failure recovery', () => {
  const field = (path: string) =>
    document.getElementById(`scenarios.0.${path}`) as HTMLInputElement;
  async function create() {
    await open();
    fireEvent.click(screen.getByRole('tab', { name: 'Scenarios' }));
    fireEvent.click(screen.getByRole('button', { name: 'Create scenario' }));
    fireEvent.change(field('name'), { target: { value: 'Stress case' } });
    fireEvent.change(field('overrides.expenses.maintenance'), { target: { value: '0' } });
  }
  it('previews examples without edits, warns about inherited fixed zero and saves/reloads an edited example', async () => {
    const p = make('a');
    p.input.expenses!.maintenance = 0;
    vi.mocked(loadRoiDraftAction).mockResolvedValueOnce({
      ok: true,
      data: { payload: p, missing: [], facts },
    });
    await open();
    fireEvent.click(screen.getByRole('tab', { name: 'Scenarios' }));
    expect(screen.getByText('0 of 20 scenarios')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Example scenario'), { target: { value: 'Best Case' } });
    expect(screen.getByText(/Inherited fixed maintenance of/).textContent).toContain('$0.00');
    expect(screen.getByText(/3% \(base: 0%\)/)).toBeTruthy();
    expect(screen.getByText('0 of 20 scenarios')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Add Best Case scenario' }));
    expect(field('overrides.expenses.maintenancePercent').value).toBe('3');
    expect(field('overrides.expenses.maintenance').value).toBe('');
    fireEvent.change(field('name'), { target: { value: 'My best case' } });
    fireEvent.change(field('overrides.income.vacancyRate'), { target: { value: '4' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save ready' }));
    await screen.findByText('Saved ready - revision 1');
    const saved = vi.mocked(saveRoiAnalysisAction).mock.calls[0][0] as {
      payload: ReturnType<typeof make>;
    };
    expect(saved.payload.input).toEqual(p.input);
    expect(saved.payload.scenarios[0]).toMatchObject({
      name: 'My best case',
      overrides: {
        income: { vacancyRate: 4, annualRentGrowth: 5 },
        expenses: { maintenancePercent: 3 },
      },
    });
    vi.mocked(loadSavedRoiAnalysisAction).mockResolvedValueOnce({
      ok: true,
      data: {
        propertyId: 'a',
        payload: saved.payload,
        status: 'READY',
        revision: 1,
        missing: [],
        createdAt: '',
        updatedAt: '',
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Reload saved analysis' }));
    await screen.findByText('Loaded ready - revision 1');
    expect(field('name').value).toBe('My best case');
    expect(field('overrides.income.vacancyRate').value).toBe('4');
  });
  it.each(['loan', 'overflow'])(
    'recalculation focuses the visible %s recovery target and preserves every override',
    async (kind) => {
      await create();
      if (kind === 'loan')
        fireEvent.change(field('overrides.financing.loanAmount'), { target: { value: '100001' } });
      else {
        fireEvent.change(field('overrides.income.annualRentGrowth'), { target: { value: '100' } });
        fireEvent.change(field('overrides.appreciationExit.holdingPeriodYears'), {
          target: { value: '50' },
        });
      }
      fireEvent.click(screen.getByRole('tab', { name: 'Charts' }));
      fireEvent.click(screen.getByRole('button', { name: 'Recalculate' }));
      const target =
        kind === 'loan'
          ? field('overrides.financing.loanAmount')
          : document.getElementById('scenarios.0');
      await waitFor(() => expect(document.activeElement).toBe(target));
      expect(screen.getByRole('tab', { name: 'Scenarios' }).getAttribute('aria-selected')).toBe(
        'true',
      );
      expect(target?.closest('[hidden]')).toBeNull();
      if (kind === 'loan') {
        expect(field('overrides.financing.loanAmount').value).toBe('100001');
        expect(field('overrides.financing.loanAmount').getAttribute('aria-invalid')).toBe('true');
        expect(field('overrides.financing.loanAmount').closest('details')?.open).toBe(true);
        fireEvent.change(field('overrides.financing.loanAmount'), { target: { value: '50000' } });
      } else {
        expect(field('overrides.income.annualRentGrowth').value).toBe('100');
        expect(field('overrides.appreciationExit.holdingPeriodYears').value).toBe('50');
        fireEvent.change(field('overrides.appreciationExit.holdingPeriodYears'), {
          target: { value: '1' },
        });
      }
      expect(field('overrides.expenses.maintenance').value).toBe('0');
      expect(field('name').value).toBe('Stress case');
      fireEvent.click(screen.getByRole('button', { name: 'Recalculate' }));
      expect(screen.getByRole('region', { name: 'Scenario metrics' })).toBeTruthy();
    },
  );
  it.each([false, true])(
    'server calculation errors recover without losing drafts (guarded: %s)',
    async (guarded) => {
      await create();
      fireEvent.change(field('overrides.income.annualRentGrowth'), { target: { value: '100' } });
      fireEvent.change(field('overrides.appreciationExit.holdingPeriodYears'), {
        target: { value: '50' },
      });
      vi.mocked(saveRoiAnalysisAction).mockImplementationOnce(async (request) => {
        try {
          calculatePayload((request as { payload: ReturnType<typeof make> }).payload);
        } catch (error) {
          return { ok: false, code: 'INVALID', issues: issues(error) };
        }
        throw Error('Expected invalid merged scenario');
      });
      fireEvent.click(screen.getByRole('tab', { name: 'Summary' }));
      if (guarded) fireEvent.click(screen.getByRole('button', { name: 'Change property' }));
      fireEvent.click(
        screen.getByRole('button', { name: guarded ? 'Save draft and continue' : 'Save draft' }),
      );
      if (guarded) {
        const correct = await screen.findByRole('button', {
          name: 'Correct highlighted assumption',
        });
        expect(screen.getByRole('alertdialog').contains(document.activeElement)).toBe(true);
        fireEvent.click(correct);
      }
      await waitFor(() =>
        expect(document.activeElement).toBe(document.getElementById('scenarios.0')),
      );
      expect(field('overrides.expenses.maintenance').value).toBe('0');
      expect(field('overrides.income.annualRentGrowth').value).toBe('100');
      expect(field('overrides.appreciationExit.holdingPeriodYears').value).toBe('50');
      fireEvent.change(field('overrides.appreciationExit.holdingPeriodYears'), {
        target: { value: '1' },
      });
      if (guarded) {
        fireEvent.click(screen.getByRole('button', { name: 'Continue property change' }));
        fireEvent.click(screen.getByRole('button', { name: 'Save draft and continue' }));
        await screen.findByRole('searchbox');
      } else {
        fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
        await screen.findByText('Saved draft - revision 1');
      }
      const saved = vi.mocked(saveRoiAnalysisAction).mock.calls[1][0] as {
        payload: ReturnType<typeof make>;
      };
      expect(saved.payload.input).toEqual(make('a').input);
      expect(saved.payload.scenarios[0]).toMatchObject({
        name: 'Stress case',
        overrides: {
          income: { annualRentGrowth: 100 },
          appreciationExit: { holdingPeriodYears: 1 },
          expenses: { maintenance: 0 },
        },
      });
    },
  );
  it('renders saved calculation options with labels and restores inheritance deliberately', async () => {
    const p = payload('a');
    vi.mocked(loadRoiDraftAction).mockResolvedValueOnce({
      ok: true,
      data: { payload: p, missing: [], facts },
    });
    await open();
    fireEvent.click(screen.getByRole('tab', { name: 'Scenarios' }));
    fireEvent.click(screen.getByText('Explicit scenario calculation options'));
    expect(screen.getByText('Federal income tax (%)', { selector: 'dt' })).toBeTruthy();
    expect(screen.getByText('Discount rate', { selector: 'dt' })).toBeTruthy();
    expect(screen.getByRole('tabpanel', { name: 'Scenarios' }).querySelector('pre')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Use base calculation options' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save ready' }));
    await screen.findByText('Saved ready - revision 1');
    const saved = vi.mocked(saveRoiAnalysisAction).mock.calls[0][0] as {
      payload: ReturnType<typeof make>;
    };
    expect(saved.payload.scenarios[0].options).toBeUndefined();
    expect(saved.payload.options).toEqual(p.options);
  });
});

it('creates, validates, saves and removes named scenarios through shared state', async () => {
  await open();
  fireEvent.click(screen.getByRole('tab', { name: 'Scenarios' }));
  fireEvent.click(screen.getByRole('button', { name: 'Create scenario' }));
  const name = document.getElementById('scenarios.0.name') as HTMLInputElement;
  fireEvent.change(name, { target: { value: 'Rent case' } });
  const override = document.getElementById(
    'scenarios.0.overrides.income.monthlyRent',
  ) as HTMLInputElement;
  fireEvent.change(override, { target: { value: 'invalid' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
  await waitFor(() => expect(document.activeElement).toBe(override));
  expect(override.closest('details')?.open).toBe(true);
  expect(override.value).toBe('invalid');
  expect(saveRoiAnalysisAction).not.toHaveBeenCalled();
  fireEvent.change(override, { target: { value: '1200' } });
  fireEvent.click(screen.getByRole('button', { name: 'Recalculate' }));
  expect(screen.getByRole('region', { name: 'Scenario metrics' }).textContent).toContain(
    'Rent case',
  );
  expect(screen.getByRole('region', { name: 'Scenario metrics' }).textContent).toContain(
    '$13,200.00',
  );
  expect(screen.getByRole('region', { name: 'Scenario metrics' }).textContent).toContain(
    '$2,400.00',
  );
  fireEvent.click(screen.getByRole('button', { name: 'Save ready' }));
  await screen.findByText('Saved ready - revision 1');
  const saved = vi.mocked(saveRoiAnalysisAction).mock.calls[0][0] as {
    payload: ReturnType<typeof make>;
  };
  expect(saved.payload.input.income?.monthlyRent).toBe(1000);
  expect(saved.payload.scenarios[0].overrides.income?.monthlyRent).toBe(1200);
  expect(saved.payload.scenarios[0].name).toBe('Rent case');
  fireEvent.click(screen.getByRole('button', { name: 'Remove Rent case' }));
  expect(screen.queryByLabelText('Scenario name')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Change property' }));
  expect(screen.getByRole('alertdialog')).toBeTruthy();
});

it('retains scenario edits through conflicts and invalid navigation recovery, then reloads per property', async () => {
  const stored = make('a');
  stored.scenarios = [
    { id: 'saved-case', name: 'Saved case', overrides: { expenses: { maintenance: 0 } } },
  ];
  vi.mocked(loadSavedRoiAnalysisAction).mockImplementation(async (id) => ({
    ok: true,
    data:
      id === 'a'
        ? {
            propertyId: 'a',
            payload: stored,
            status: 'READY',
            revision: 4,
            missing: [],
            createdAt: '2026-01-01T00:00:00Z',
            updatedAt: '2026-01-01T00:00:00Z',
          }
        : null,
  }));
  await open();
  fireEvent.click(screen.getByRole('tab', { name: 'Scenarios' }));
  const name = () => document.getElementById('scenarios.0.name') as HTMLInputElement;
  expect(name().value).toBe('Saved case');
  fireEvent.change(name(), { target: { value: '' } });
  fireEvent.click(screen.getByRole('button', { name: 'Change property' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save draft and continue' }));
  expect(screen.getByRole('alertdialog').contains(document.activeElement)).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Correct highlighted assumption' }));
  await waitFor(() => expect(document.activeElement).toBe(name()));
  expect(name().value).toBe('');
  fireEvent.change(name(), { target: { value: 'Kept case' } });
  fireEvent.click(screen.getByRole('button', { name: 'Cancel property change' }));
  vi.mocked(saveRoiAnalysisAction).mockResolvedValue({ ok: false, code: 'CONFLICT' });
  fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
  await screen.findByText(/A newer revision exists/);
  expect(name().value).toBe('Kept case');
  expect(vi.mocked(saveRoiAnalysisAction).mock.calls[0][0]).toMatchObject({
    expectedRevision: 4,
    payload: { scenarios: [{ name: 'Kept case', overrides: { expenses: { maintenance: 0 } } }] },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Reload saved analysis' }));
  fireEvent.click(screen.getByRole('button', { name: /Discard/ }));
  await waitFor(() => expect(name().value).toBe('Saved case'));
  fireEvent.click(screen.getByRole('button', { name: 'Change property' }));
  fireEvent.click(screen.getByRole('button', { name: /Property b/ }));
  await screen.findByText(/New analysis/);
  fireEvent.click(screen.getByRole('tab', { name: 'Scenarios' }));
  expect(screen.queryByLabelText('Scenario name')).toBeNull();
});

it('saves benchmark selections across panels and restores them by property', async () => {
  await open();
  fireEvent.click(screen.getByRole('tab', { name: 'Compare' }));
  let panel = within(screen.getByRole('tabpanel', { name: 'Compare' }));
  fireEvent.click(panel.getByRole('checkbox', { name: 'S&P 500' }));
  fireEvent.click(panel.getByRole('checkbox', { name: 'US Bonds' }));
  fireEvent.click(panel.getByRole('checkbox', { name: 'Nasdaq 100' }));
  expect(panel.getByText(/Selection limit/)).toBeTruthy();
  expect((panel.getByRole('checkbox', { name: 'Nasdaq 100' }) as HTMLInputElement).checked).toBe(
    false,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Recalculate' }));
  expect(panel.getByRole('region', { name: 'Same-capital asset comparison' })).toBeTruthy();
  fireEvent.click(screen.getByRole('tab', { name: 'Summary' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
  await waitFor(() => expect(saveRoiAnalysisAction).toHaveBeenCalled());
  const request = vi.mocked(saveRoiAnalysisAction).mock.calls[0][0] as {
    payload: ReturnType<typeof make>;
  };
  expect(request.payload.benchmarks.map((b) => b.type)).toEqual(['sp500', 'bonds']);
  expect(request.payload.scenarios).toEqual([]);
  vi.mocked(loadSavedRoiAnalysisAction).mockResolvedValue({
    ok: true,
    data: {
      payload: request.payload,
      revision: 1,
      status: 'DRAFT',
      propertyId: 'a',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      missing: [],
    },
  } as never);
  fireEvent.click(screen.getByRole('button', { name: 'Reload saved analysis' }));
  await screen.findByText(/Loaded draft/);
  fireEvent.click(screen.getByRole('tab', { name: 'Benchmarks' }));
  panel = within(screen.getByRole('tabpanel', { name: 'Benchmarks' }));
  expect((panel.getByRole('checkbox', { name: 'US Bonds' }) as HTMLInputElement).checked).toBe(
    true,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Change property' }));
  vi.mocked(loadSavedRoiAnalysisAction).mockResolvedValue({ ok: true, data: null });
  fireEvent.click(screen.getByRole('button', { name: /Property b/ }));
  await screen.findByText(/New analysis/);
  fireEvent.click(screen.getByRole('tab', { name: 'Compare' }));
  expect(
    (
      within(screen.getByRole('tabpanel', { name: 'Compare' })).getByRole('checkbox', {
        name: 'US Bonds',
      }) as HTMLInputElement
    ).checked,
  ).toBe(false);
});

it('keeps invalid custom text across sections, focuses correction and saves explicit assumptions', async () => {
  await open();
  fireEvent.click(screen.getByRole('tab', { name: 'Compare' }));
  let panel = within(screen.getByRole('tabpanel', { name: 'Compare' }));
  fireEvent.click(panel.getByRole('button', { name: 'Add custom reference' }));
  fireEvent.change(panel.getByLabelText('Custom name'), { target: { value: 'My reference' } });
  fireEvent.change(panel.getByLabelText(/Custom total return/), { target: { value: 'oops' } });
  fireEvent.click(screen.getByRole('tab', { name: 'Summary' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
  await waitFor(() => expect(document.activeElement?.id).toBe('benchmarks.0.historicalCAGR'));
  panel = within(screen.getByRole('tabpanel', { name: 'Compare' }));
  expect((panel.getByLabelText(/Custom total return/) as HTMLInputElement).value).toBe('oops');
  fireEvent.change(panel.getByLabelText(/Custom total return/), { target: { value: '-5' } });
  fireEvent.change(panel.getByLabelText(/Custom yield/), { target: { value: '0' } });
  fireEvent.change(panel.getByLabelText(/Custom volatility/), { target: { value: '12' } });
  fireEvent.change(panel.getByLabelText(/Custom source/), {
    target: { value: 'Manager reference period 2000-2024; unverified' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
  await waitFor(() => expect(saveRoiAnalysisAction).toHaveBeenCalledTimes(1));
  const request = vi.mocked(saveRoiAnalysisAction).mock.calls[0][0] as {
    payload: ReturnType<typeof make>;
  };
  expect(request.payload.benchmarks[0]).toMatchObject({
    name: 'My reference',
    historicalCAGR: -5,
    averageYield: 0,
    volatility: 12,
  });
});
