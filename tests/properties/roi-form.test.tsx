// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { PropertyForm } from '@/app/(manager)/properties/_components/PropertyForm';
import { createPropertyAction, savePropertyPageAction } from '@/app/(manager)/properties/actions';
import { parsePropertyInput } from '@/lib/properties/validation';
import { parseRoiInputs } from '@/lib/properties/roi-inputs';
import { propertyRoiPatch, valuesFrom } from '@/components/analysis/fields';
import { payload } from '../analysis/fixture';

vi.mock('@/app/(manager)/properties/actions', () => ({
  createPropertyAction: vi.fn(),
  savePropertyPageAction: vi.fn(),
  setPropertyArchivedAction: vi.fn(),
}));
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(createPropertyAction).mockImplementation(async (_state, data) => {
    const parsed = parsePropertyInput(data);
    return parsed.ok ? { ok: true } : { errors: parsed.errors };
  });
  vi.mocked(savePropertyPageAction).mockImplementation(async (_state, data) => {
    const parsed = parseRoiInputs(data.get('roiInputs'));
    return parsed.success ? { ok: true } : { errors: parsed.errors };
  });
});
afterEach(cleanup);
function fill(name: string, value: string) {
  fireEvent.change(screen.getByLabelText(name, { exact: true }), { target: { value } });
}
function basics() {
  fill('Property name', 'Optional ROI fixture');
  fill('Street address', '1 Synthetic Lane');
  fill('City', 'Austin');
  fill('State', 'TX');
  fill('ZIP', '78701');
}
it.each([false, true])(
  'creates with optional ROI inputs (partial: %s) and retains explicit zero',
  async (partial) => {
    render(<PropertyForm owners={[]} cancelHref="/properties" />);
    basics();
    if (partial) {
      fill('Purchase price ($)', '250000');
      fill('Scheduled rent ($ / month)', '0');
      fill('Interest rate (%)', '5.5');
    }
    fireEvent.submit(screen.getByRole('button', { name: 'Save property' }).closest('form')!);
    await waitFor(() => expect(createPropertyAction).toHaveBeenCalledOnce());
    const parsed = parsePropertyInput(vi.mocked(createPropertyAction).mock.calls[0][1]);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) throw Error('Unexpected validation error');
    expect(parsed.data.roiInputs).toEqual(
      partial
        ? {
            version: 1,
            input: {
              purchase: { purchasePrice: 250000 },
              income: { monthlyRent: 0 },
              financing: { interestRate: 5.5 },
            },
            options: {},
          }
        : { version: 1, input: {}, options: {} },
    );
  },
);
it('keeps invalid optional text and opens/focuses its labeled correction after submission', async () => {
  render(<PropertyForm owners={[]} cancelHref="/properties" />);
  basics();
  fill('Interest rate (%)', 'not a rate');
  fireEvent.submit(screen.getByRole('button', { name: 'Save property' }).closest('form')!);
  const field = screen.getByLabelText('Interest rate (%)');
  await waitFor(() => expect(document.activeElement).toBe(field));
  expect((field as HTMLInputElement).value).toBe('not a rate');
  expect(field.closest('details')?.open).toBe(true);
  expect(screen.getByRole('link', { name: /Interest rate.*Enter a valid number/ })).toBeTruthy();
});
it('uses the cash choice without inventing loan terms or a down payment assumption', () => {
  render(<PropertyForm owners={[]} cancelHref="/properties" />);
  fireEvent.click(screen.getByText('Pay in cash · No loan'));
  expect(
    (screen.getByLabelText('Loan amount ($, overrides down payment)') as HTMLInputElement).value,
  ).toBe('0');
  expect((screen.getByLabelText('Down payment (%)') as HTMLInputElement).value).toBe('');
  expect((screen.getByLabelText('Interest rate (%)') as HTMLInputElement).value).toBe('');
});
it('prefills the combined edit form and distinguishes clear, zero and unchanged values', async () => {
  const initial = propertyRoiPatch(valuesFrom(payload()));
  render(
    <PropertyForm
      owners={[]}
      cancelHref="/properties/test-home"
      initial={{
        id: 'test-home',
        name: 'Saved home',
        type: 'SINGLE_UNIT',
        street: '1 Test',
        city: 'Austin',
        state: 'TX',
        postalCode: '78701',
        yearBuilt: 2000,
        ownerId: null,
        unitCount: 1,
        roiInputs: initial,
      }}
    />,
  );
  expect((screen.getByLabelText('Property name') as HTMLInputElement).value).toBe('Saved home');
  expect((screen.getByLabelText('Purchase price ($)') as HTMLInputElement).value).toBe('100000');
  expect((screen.getByLabelText('Other income ($ / month)') as HTMLInputElement).value).toBe('0');
  fill('Scheduled rent ($ / month)', '0');
  fill('Property tax ($ / year)', '');
  fill('Purchase price ($)', '');
  fireEvent.submit(screen.getByRole('button', { name: 'Save property' }).closest('form')!);
  await waitFor(() => expect(savePropertyPageAction).toHaveBeenCalledOnce());
  const data = vi.mocked(savePropertyPageAction).mock.calls[0][1];
  expect(data.get('propertyId')).toBe('test-home');
  expect(data.get('changedBasics')).toBe('[]');
  expect(JSON.parse(String(data.get('roiInputs')))).toEqual({
    version: 1,
    input: { income: { monthlyRent: 0 } },
    options: {},
    cleared: ['input.purchase.purchasePrice', 'input.expenses.propertyTax'],
  });
});
it('provides Cancel navigation without submitting the form', () => {
  render(<PropertyForm owners={[]} cancelHref="/properties?filter=multi" />);
  basics();
  const cancel = screen.getByRole('link', { name: 'Cancel' });
  expect(cancel.getAttribute('href')).toBe('/properties?filter=multi');
  expect(createPropertyAction).not.toHaveBeenCalled();
});
