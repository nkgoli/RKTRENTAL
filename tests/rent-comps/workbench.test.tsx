// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CompsWorkbench, type WorkbenchProps } from '@/app/(manager)/rent-comps/CompsWorkbench';
import { applyRentAction } from '@/app/(manager)/rent-comps/actions';
import { Component, type ReactNode } from 'react';
import { ToastProvider } from '@/components/ui/Toast';

vi.mock('@/app/(manager)/rent-comps/actions', () => ({ applyRentAction: vi.fn() }));
afterEach(cleanup);
beforeEach(() => vi.resetAllMocks());

const props: WorkbenchProps = {
  unitId: 'fixture-unit',
  unitLabel: 'Example home',
  radiusMiles: 2,
  subjectSqft: 900,
  listedRent: 1800,
  marketRent: null,
  providerName: 'mock',
  syncedAt: '12:00 UTC',
  cached: false,
  appliedNote: null,
  rows: [
    {
      id: 'a',
      address: '1 Example Street',
      monthlyRentCents: 180000,
      bedrooms: 2,
      squareFeet: 900,
      distanceMiles: 0.5,
      bearingDegrees: 90,
    },
    {
      id: 'b',
      address: '2 Example Street',
      monthlyRentCents: 220000,
      bedrooms: 2,
      squareFeet: 950,
      distanceMiles: 1,
      bearingDegrees: 180,
      caveat: 'Furnished',
    },
  ],
};

describe('rent comparison decisions', () => {
  it('toasts a confirmed rent update, collapses the map and omits a repeated source column', async () => {
    vi.mocked(applyRentAction).mockResolvedValueOnce({
      ok: true,
      rent: 1800,
      message: 'Market rent updated.',
    });
    const { container } = render(
      <ToastProvider>
        <CompsWorkbench {...props} />
      </ToastProvider>,
    );
    expect(screen.getByTestId('comps-map').closest('details')?.open).toBe(false);
    expect(screen.queryByRole('columnheader', { name: 'Source' })).toBeNull();
    fireEvent.submit(screen.getByRole('form', { name: 'Apply market rent' }));
    await waitFor(() =>
      expect(container.querySelector('.toast')?.textContent).toContain(
        'Market rent for Example home updated to $1,800 / month.',
      ),
    );
  });
  it('shows a source column when comparable rentals have different providers', () => {
    render(
      <CompsWorkbench
        {...props}
        rows={props.rows.map((row, index) => ({ ...row, source: index ? 'rentrange' : 'mock' }))}
      />,
    );
    expect(screen.getByRole('columnheader', { name: 'Source' })).toBeTruthy();
  });
  it('associates a rejected rent with its field without a real financial submission', async () => {
    vi.mocked(applyRentAction).mockResolvedValueOnce({
      ok: false,
      inputError: true,
      message: 'Enter a monthly rent between $1 and $100,000.',
    });
    render(<CompsWorkbench {...props} />);
    const input = screen.getByRole('textbox', { name: 'Market rent to apply ($ / month)' });
    fireEvent.change(input, { target: { value: '0' } });
    fireEvent.submit(input.closest('form')!);
    await waitFor(() => expect(input.getAttribute('aria-invalid')).toBe('true'));
    expect(document.getElementById(input.getAttribute('aria-describedby')!)?.textContent).toBe(
      'Enter a monthly rent between $1 and $100,000.',
    );
  });

  it('keeps the exact rejected draft, exclusions and URL, then accepts a correction', async () => {
    vi.mocked(applyRentAction)
      .mockResolvedValueOnce({
        ok: false,
        inputError: true,
        message: 'Enter a monthly rent between $1 and $100,000.',
      })
      .mockResolvedValueOnce({ ok: true, rent: 2100.5, message: 'Market rent updated.' });
    window.history.replaceState(
      {},
      '',
      '/rent-analysis?property=maple&unit=fixture-unit&radius=3&status=leased',
    );
    render(<CompsWorkbench {...props} />);
    const input = screen.getByRole('textbox', { name: /Market rent to apply/ }) as HTMLInputElement;
    fireEvent.change(input, { target: { value: ' $0.00 ' } });
    fireEvent.submit(input.closest('form')!);
    await screen.findByText('Enter a monthly rent between $1 and $100,000.');
    expect(input.value).toBe(' $0.00 ');
    expect(
      (screen.getByRole('checkbox', { name: 'Include 2 Example Street' }) as HTMLInputElement)
        .checked,
    ).toBe(false);
    expect(window.location.search).toBe('?property=maple&unit=fixture-unit&radius=3&status=leased');
    fireEvent.change(input, { target: { value: ' $2,100.50 ' } });
    expect(input.getAttribute('aria-invalid')).toBe('false');
    fireEvent.submit(input.closest('form')!);
    await screen.findByText(/Market rent updated. Now \$2,100.5/);
    expect(input.value).toBe(' $2,100.50 ');
    const submitted = vi.mocked(applyRentAction).mock.calls.at(-1)![1];
    expect(submitted.get('unitId')).toBe('fixture-unit');
    expect(submitted.get('rent')).toBe(' $2,100.50 ');
  });

  it('keeps the draft when exclusions change the suggestion', () => {
    render(<CompsWorkbench {...props} />);
    const input = screen.getByRole('textbox', { name: /Market rent to apply/ }) as HTMLInputElement;
    fireEvent.change(input, { target: { value: ' $1,987.00 ' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Include 2 Example Street' }));
    expect(
      (screen.getByRole('textbox', { name: /Market rent to apply/ }) as HTMLInputElement).value,
    ).toBe(' $1,987.00 ');
  });

  it('announces pending, prevents duplicate submission and returns focus for correction', async () => {
    let resolve!: (value: Awaited<ReturnType<typeof applyRentAction>>) => void;
    vi.mocked(applyRentAction).mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    render(<CompsWorkbench {...props} />);
    const input = screen.getByRole('textbox', { name: /Market rent to apply/ }) as HTMLInputElement;
    fireEvent.change(input, { target: { value: ' $0.00 ' } });
    fireEvent.submit(input.closest('form')!);
    await screen.findByText('Applying market rent…');
    expect(screen.getByRole('form', { name: 'Apply market rent' }).getAttribute('aria-busy')).toBe(
      'true',
    );
    expect((screen.getByRole('button', { name: 'Applying…' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect(input.readOnly).toBe(true);
    await act(async () => resolve({ ok: false, inputError: true, message: 'Correct the amount.' }));
    expect(input.value).toBe(' $0.00 ');
    expect(input.readOnly).toBe(false);
    expect(document.activeElement).toBe(input);
    expect(screen.getByRole('alert').textContent).toBe('Correct the amount.');
  });

  it('recovers a lost response inline without claiming no write', async () => {
    vi.mocked(applyRentAction).mockRejectedValueOnce(new Error('Network response lost'));
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
      state = { failed: false };
      static getDerivedStateFromError() {
        return { failed: true };
      }
      render() {
        return this.state.failed ? <p>Page replaced by error boundary</p> : this.props.children;
      }
    }
    try {
      render(
        <Boundary>
          <CompsWorkbench {...props} />
        </Boundary>,
      );
      const input = screen.getByRole('textbox', {
        name: /Market rent to apply/,
      }) as HTMLInputElement;
      fireEvent.change(input, { target: { value: ' $2,100.50 ' } });
      fireEvent.submit(input.closest('form')!);
      await waitFor(() => expect(screen.queryByText(/may have been saved/)).not.toBeNull());
      expect(input.value).toBe(' $2,100.50 ');
      expect(
        screen.queryByText(/Page replaced|No rent was changed|Market rent updated/),
      ).toBeNull();
      expect(
        (screen.getByRole('button', { name: /^Apply to/ }) as HTMLButtonElement).disabled,
      ).toBe(false);
    } finally {
      errors.mockRestore();
    }
  });

  it.each(['/sign-in', '/tenant'])(
    'lets Next handle the %s redirect instead of reporting a write failure',
    async (path) => {
      const redirect = Object.assign(new Error('NEXT_REDIRECT'), {
        digest: `NEXT_REDIRECT;replace;${path};307;`,
      });
      vi.mocked(applyRentAction).mockRejectedValueOnce(redirect);
      const caught = vi.fn();
      const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
      class RouterBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
        state = { failed: false };
        static getDerivedStateFromError() {
          return { failed: true };
        }
        componentDidCatch(error: Error) {
          caught(error);
        }
        render() {
          return this.state.failed ? <p>Framework redirect</p> : this.props.children;
        }
      }
      try {
        render(
          <RouterBoundary>
            <CompsWorkbench {...props} />
          </RouterBoundary>,
        );
        fireEvent.submit(screen.getByRole('form', { name: 'Apply market rent' }));
        await screen.findByText('Framework redirect');
        expect(caught).toHaveBeenCalledWith(redirect);
        expect(screen.queryByText(/may have been saved/)).toBeNull();
      } finally {
        errors.mockRestore();
      }
    },
  );

  it('keeps exclusion notes and the summary in sync with selected comps', () => {
    render(<CompsWorkbench {...props} />);
    const table = screen.getByRole('table', { name: 'Comparable rentals' });
    const premium = within(table).getByRole('checkbox', { name: 'Include 2 Example Street' });
    expect((premium as HTMLInputElement).checked).toBe(false);
    expect(within(table).getByText('Excluded: Furnished')).toBeTruthy();
    fireEvent.click(premium);
    expect(within(table).getByText('Note: Furnished')).toBeTruthy();
    expect(screen.getByText('2 comps')).toBeTruthy();
    fireEvent.click(premium);
    fireEvent.click(within(table).getByRole('checkbox', { name: 'Include 1 Example Street' }));
    expect(screen.getByText('No comps')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Apply to/ })).toBeNull();
    expect(screen.getByText(/include at least one comp/)).toBeTruthy();
  });

  it('names the single-family subject and uses the vacancy continuation without changing the action target', () => {
    render(<CompsWorkbench {...props} propertyLevel occupied={false} />);
    expect(screen.getByText('Schematic map: distance and direction from the home.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Create lease' }).getAttribute('href')).toBe(
      '/leases/new?unit=fixture-unit',
    );
    expect(
      screen.getByRole('region', { name: 'Comparable rentals table' }).getAttribute('tabindex'),
    ).toBe('0');
    expect(screen.getByText(/Updates the saved market rent for this home/)).toBeTruthy();
  });

  it('keeps the renewal continuation for occupied units and explains no-match recovery', () => {
    const view = render(<CompsWorkbench {...props} occupied />);
    expect(screen.getByRole('link', { name: 'Use for renewal' }).getAttribute('href')).toBe(
      '/leases/new?unit=fixture-unit',
    );
    view.rerender(<CompsWorkbench {...props} rows={[]} />);
    expect(screen.getByRole('link', { name: 'Reset filters' }).getAttribute('href')).toBe(
      '/rent-comps?unit=fixture-unit',
    );
    expect(screen.getByText('No comparable rentals match')).toBeTruthy();
  });
});
