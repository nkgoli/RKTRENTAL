// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RoiWorkspace } from '@/components/analysis/RoiWorkspace';
import { applyValues, valuesFrom } from '@/components/analysis/fields';
import { PayloadSchema } from '@/lib/analysis';
import { payload } from './fixture';
import {
  loadRoiDraftAction,
  loadSavedRoiAnalysisAction,
  saveRoiAnalysisAction,
} from '@/app/(manager)/roi-analysis/actions';
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
describe('ROI summary workspace', () => {
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
  it('recalculates, preserves zero, and marks invalid prior results stale', async () => {
    await open();
    fireEvent.change(rent(), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Recalculate' }));
    expect(screen.queryByText(/Out of date/)).toBeNull();
    fireEvent.change(rent(), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Recalculate' }));
    expect(screen.getByText(/Out of date/)).toBeTruthy();
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
