// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CompsWorkbench, type WorkbenchProps } from '@/app/(manager)/rent-comps/CompsWorkbench';
import { applyRentAction } from '@/app/(manager)/rent-comps/actions';

vi.mock('@/app/(manager)/rent-comps/actions', () => ({ applyRentAction: vi.fn() }));
afterEach(cleanup);

const props: WorkbenchProps = {
  unitId: 'fixture-unit', unitLabel: 'Example home', radiusMiles: 2, subjectSqft: 900,
  listedRent: 1800, marketRent: null, providerName: 'mock', syncedAt: '12:00 UTC',
  cached: false, appliedNote: null,
  rows: [
    { id: 'a', address: '1 Example Street', monthlyRentCents: 180000, bedrooms: 2, squareFeet: 900, distanceMiles: .5, bearingDegrees: 90 },
    { id: 'b', address: '2 Example Street', monthlyRentCents: 220000, bedrooms: 2, squareFeet: 950, distanceMiles: 1, bearingDegrees: 180, caveat: 'Furnished' },
  ],
};

describe('rent comparison decisions', () => {
  it('associates a rejected rent with its field without a real financial submission', async () => {
    vi.mocked(applyRentAction).mockResolvedValueOnce({ ok: false, message: 'Enter a monthly rent between $1 and $100,000.' });
    render(<CompsWorkbench {...props} />);
    const input = screen.getByRole('textbox', { name: 'Market rent to apply ($ / month)' });
    fireEvent.change(input, { target: { value: '0' } });
    fireEvent.submit(input.closest('form')!);
    await waitFor(() => expect(input.getAttribute('aria-invalid')).toBe('true'));
    expect(document.getElementById(input.getAttribute('aria-describedby')!)?.textContent).toBe('Enter a monthly rent between $1 and $100,000.');
  });

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
    expect(screen.getByRole('link', { name: 'Create lease' }).getAttribute('href')).toBe('/leases/new?unit=fixture-unit');
    expect(screen.getByRole('region', { name: 'Comparable rentals table' }).getAttribute('tabindex')).toBe('0');
    expect(screen.getByText(/Updates the saved market rent for this home/)).toBeTruthy();
  });

  it('keeps the renewal continuation for occupied units and explains no-match recovery', () => {
    const view = render(<CompsWorkbench {...props} occupied />);
    expect(screen.getByRole('link', { name: 'Use for renewal' }).getAttribute('href')).toBe('/leases/new?unit=fixture-unit');
    view.rerender(<CompsWorkbench {...props} rows={[]} />);
    expect(screen.getByRole('link', { name: 'Reset filters' }).getAttribute('href')).toBe('/rent-comps?unit=fixture-unit');
    expect(screen.getByText('No comparable rentals match')).toBeTruthy();
  });
});
