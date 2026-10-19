// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AddUnitForm } from '@/app/(manager)/properties/_components/UnitForm';
import { AddPropertyForm } from '@/app/(manager)/properties/_components/PropertyForm';

vi.mock('@/app/(manager)/properties/actions', () => ({
  createUnitAction: vi.fn(async () => ({ errors: { number: 'Enter a unit number.' }, message: 'Please fix the highlighted fields.' })),
  createPropertyAction: vi.fn(async () => ({ errors: { name: 'Enter a property name.' }, message: 'Please fix the highlighted fields.' })),
  setPropertyArchivedAction: vi.fn(),
}));
afterEach(cleanup);

describe('property and unit form validation', () => {
  it('associates the unit error with its field after a rejected submission', async () => {
    render(<AddUnitForm propertyId="isolated-fixture" />);
    const input = screen.getByRole('textbox', { name: 'Unit number' });
    fireEvent.submit(input.closest('form')!);
    await waitFor(() => expect(input.getAttribute('aria-invalid')).toBe('true'));
    expect(document.getElementById(input.getAttribute('aria-describedby')!)?.textContent).toBe('Enter a unit number.');
  });

  it('associates property validation and retains the single-family unit explanation', async () => {
    render(<AddPropertyForm owners={[]} onCancel={() => {}} />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Type' }), { target: { value: 'SINGLE_UNIT' } });
    expect(screen.getByText('A single-unit home has one unit.')).toBeTruthy();
    const input = screen.getByRole('textbox', { name: 'Property name' });
    fireEvent.submit(input.closest('form')!);
    await waitFor(() => expect(input.getAttribute('aria-invalid')).toBe('true'));
    expect(document.getElementById(input.getAttribute('aria-describedby')!)?.textContent).toBe('Enter a property name.');
  });
});
