// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AddUnitForm } from '@/app/(manager)/properties/_components/UnitForm';
import { AddPropertyForm } from '@/app/(manager)/properties/_components/PropertyForm';
import { createPropertyAction, type FormState } from '@/app/(manager)/properties/actions';

vi.mock('@/app/(manager)/properties/actions', () => ({
  createUnitAction: vi.fn(async () => ({
    errors: { number: 'Enter a unit number.' },
    message: 'Please fix the highlighted fields.',
  })),
  createPropertyAction: vi.fn(async () => ({
    errors: { name: 'Enter a property name.' },
    message: 'Please fix the highlighted fields.',
  })),
  setPropertyArchivedAction: vi.fn(),
}));
beforeEach(() => {
  vi.mocked(createPropertyAction).mockReset().mockResolvedValue({
    errors: { name: 'Enter a property name.' },
    message: 'Please fix the highlighted fields.',
  });
});
afterEach(cleanup);

describe('property and unit form validation', () => {
  it('shows saving and prevents duplicate submissions until the action returns', async () => {
    let finish!: (value: FormState) => void;
    vi.mocked(createPropertyAction).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const cancel = vi.fn();
    render(<AddPropertyForm owners={[]} onCancel={cancel} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(cancel).toHaveBeenCalledOnce();
    const input = screen.getByRole('textbox', { name: 'Property name' });
    // Reach the server action instead of the local required-unit validation.
    fireEvent.change(screen.getByRole('spinbutton', { name: /Number of units/ }), {
      target: { value: '4' },
    });
    fireEvent.submit(input.closest('form')!);
    await waitFor(() => expect(createPropertyAction).toHaveBeenCalledOnce());
    try {
      await waitFor(() => {
        expect((screen.getByRole('button', { name: 'Saving…' }) as HTMLButtonElement).disabled).toBe(true);
        expect(input.closest('form')?.getAttribute('aria-busy')).toBe('true');
      });
    } finally {
      await act(async () => finish({ errors: { name: 'Enter a property name.' } }));
    }
    await waitFor(() =>
      expect(
        (screen.getByRole('button', { name: 'Save property' }) as HTMLButtonElement).disabled,
      ).toBe(false),
    );
  });
  it('associates the unit error with its field after a rejected submission', async () => {
    render(<AddUnitForm propertyId="isolated-fixture" />);
    const input = screen.getByRole('textbox', { name: 'Unit number' });
    fireEvent.submit(input.closest('form')!);
    await waitFor(() => expect(input.getAttribute('aria-invalid')).toBe('true'));
    expect(document.getElementById(input.getAttribute('aria-describedby')!)?.textContent).toBe(
      'Enter a unit number.',
    );
  });

  it('associates property validation and retains the single-family unit explanation', async () => {
    render(<AddPropertyForm owners={[]} onCancel={() => {}} />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Type' }), {
      target: { value: 'SINGLE_UNIT' },
    });
    expect(screen.getByText('A single-unit home has one unit.')).toBeTruthy();
    const input = screen.getByRole('textbox', { name: 'Property name' });
    fireEvent.change(screen.getByRole('textbox', { name: 'City' }), {
      target: { value: 'Retained city' },
    });
    fireEvent.submit(input.closest('form')!);
    await waitFor(() => expect(input.getAttribute('aria-invalid')).toBe('true'));
    expect(document.getElementById(input.getAttribute('aria-describedby')!)?.textContent).toBe(
      'Enter a property name.',
    );
    expect(document.activeElement).toBe(input);
    expect((screen.getByRole('textbox', { name: 'City' }) as HTMLInputElement).value).toBe(
      'Retained city',
    );
  });
});
