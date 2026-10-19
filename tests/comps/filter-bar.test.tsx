// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseFilters, type SubjectFacts } from '../../src/lib/comps/core';
import { FilterBar, UnitPicker } from '../../src/app/(manager)/rent-comps/FilterBar';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const subject: SubjectFacts = {
  postalCode: '78704',
  bedrooms: 2,
  bathrooms: 2,
  squareFeet: 950,
  defaultRadiusMiles: 2,
};
const filters = parseFilters({ radius: '3', status: 'listed' }, subject);
const units = [
  { id: 'u-3a', label: 'Maple Court · 3A' },
  { id: 'u-4a', label: 'Maple Court Â· 4A' },
  { id: 'u-4b', label: 'Maple Court Â· 4B' },
];

const hidden = (form: HTMLFormElement, name: string) =>
  form.querySelector<HTMLInputElement>(`input[type="hidden"][name="${name}"]`)?.value;

describe('standalone filter and picker forms', () => {
  it('preserves property, unit and filters through unit selection', () => {
    const { container } = render(
      <UnitPicker
        units={units}
        unitId="u-4b"
        action="/rent-analysis"
        propertyId="maple"
        filters={filters}
      />,
    );
    const form = container.querySelector('form')!;
    expect(form.getAttribute('action')).toBe('/rent-analysis');
    expect(hidden(form, 'property')).toBe('maple');
    expect(hidden(form, 'radius')).toBe('3');
    expect(hidden(form, 'status')).toBe('listed');
    expect(form.querySelector('select')!.value).toBe('u-4b');
  });

  it('preserves property and unit through filter submission', () => {
    const { container } = render(
      <FilterBar unitId="u-4b" filters={filters} action="/rent-analysis" propertyId="maple" />,
    );
    const form = container.querySelector('form')!;
    expect(form.getAttribute('action')).toBe('/rent-analysis');
    expect(hidden(form, 'property')).toBe('maple');
    expect(hidden(form, 'unit')).toBe('u-4b');
  });

  it('keeps the legacy form shape without a property context', () => {
    const { container } = render(
      <FilterBar unitId="u-4b" filters={filters} action="/rent-comps" />,
    );
    const form = container.querySelector('form')!;
    expect(form.getAttribute('action')).toBe('/rent-comps');
    expect(hidden(form, 'property')).toBeUndefined();
    expect(hidden(form, 'unit')).toBe('u-4b');
  });
});

describe('accepted navigation and local edits', () => {
  const explicit = parseFilters(
    {
      radius: '5',
      beds: '3',
      baths: '1.5',
      minSqft: '9999',
      maxSqft: '',
      days: '30',
      status: 'leased',
    },
    subject,
  );
  const defaults = parseFilters({}, subject);
  const filterForm = () => screen.getByRole('form', { name: 'Comp filters' }) as HTMLFormElement;
  const values = (form: HTMLFormElement) => Object.fromEntries(new FormData(form));
  const expectControls = (accepted: typeof filters) => {
    expect((screen.getByLabelText('Radius') as HTMLSelectElement).value).toBe(
      String(accepted.radiusMiles),
    );
    expect((screen.getByLabelText('Beds') as HTMLSelectElement).value).toBe(
      String(accepted.bedrooms),
    );
    expect((screen.getByLabelText('Baths') as HTMLSelectElement).value).toBe(
      accepted.bathrooms === null ? 'any' : String(accepted.bathrooms),
    );
    expect((screen.getByLabelText('Min sqft') as HTMLInputElement).value).toBe(
      String(accepted.minSqft ?? ''),
    );
    expect((screen.getByLabelText('Max sqft') as HTMLInputElement).value).toBe(
      String(accepted.maxSqft ?? ''),
    );
    expect((screen.getByLabelText('Time frame') as HTMLSelectElement).value).toBe(
      String(accepted.days),
    );
    for (const input of filterForm().querySelectorAll<HTMLInputElement>('input[type="radio"]')) {
      expect(input.checked).toBe(input.value === accepted.status);
      expect(input.closest('label')?.classList.contains('active')).toBe(input.checked);
    }
  };

  it('follows overview links and Back/Forward without remounting the picker component', () => {
    const picker = (unitId: string) => (
      <UnitPicker
        units={units}
        unitId={unitId}
        action="/rent-analysis"
        propertyId="maple"
        filters={explicit}
      />
    );
    const { rerender } = render(picker('u-4b'));
    for (const unitId of ['u-3a', 'u-4b', 'u-3a']) {
      rerender(picker(unitId));
      const select = screen.getByLabelText('Unit') as HTMLSelectElement;
      expect(select.value).toBe(unitId);
      expect(values(select.form!)).toMatchObject({
        unit: unitId,
        property: 'maple',
        radius: '5',
        beds: '3',
        baths: '1.5',
        status: 'leased',
      });
    }
  });

  it('restores every visible filter and radio after Reset and Back/Forward', () => {
    const form = (accepted: typeof filters) => (
      <FilterBar unitId="u-4b" filters={accepted} action="/rent-analysis" propertyId="maple" />
    );
    const { rerender } = render(form(explicit));
    // Dirty native inputs must be replaced along with selects and checked status.
    fireEvent.change(screen.getByLabelText('Min sqft'), { target: { value: 'draft' } });
    for (const accepted of [defaults, explicit, defaults]) {
      rerender(form(accepted));
      expectControls(accepted);
      expect(values(filterForm())).toMatchObject({ unit: 'u-4b', property: 'maple' });
    }
  });

  it('keeps ordinary unsent edits and focus when accepted values have not changed', async () => {
    const user = userEvent.setup();
    const form = (accepted: typeof filters) => (
      <FilterBar unitId="u-4b" filters={accepted} action="/rent-analysis" propertyId="maple" />
    );
    const { rerender } = render(form(defaults));
    const min = screen.getByLabelText('Min sqft');
    await user.clear(min);
    await user.type(min, '00750');
    rerender(form({ ...defaults }));
    expect(screen.getByLabelText('Min sqft')).toBe(min);
    expect(document.activeElement).toBe(min);
    expect((min as HTMLInputElement).value).toBe('00750');
  });

  it('discards prior-subject drafts even when the next subject has identical accepted filters', () => {
    const { rerender } = render(
      <FilterBar unitId="u-4b" filters={defaults} action="/rent-analysis" propertyId="maple" />,
    );
    fireEvent.change(screen.getByLabelText('Min sqft'), { target: { value: '9999' } });
    rerender(
      <FilterBar unitId="u-3a" filters={defaults} action="/rent-analysis" propertyId="maple" />,
    );
    expectControls(defaults);
    expect(hidden(filterForm(), 'unit')).toBe('u-3a');
  });

  it.each([
    ['/rent-analysis', 'maple'],
    ['/properties/maple/listing', 'maple'],
    ['/rent-comps', undefined],
  ])(
    'preserves GET, autosubmit, Enter and explicit submission on %s',
    async (action, propertyId) => {
      const user = userEvent.setup();
      const requestSubmit = vi
        .spyOn(HTMLFormElement.prototype, 'requestSubmit')
        .mockImplementation(function (this: HTMLFormElement) {
          this.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        });
      render(
        <FilterBar unitId="u-4b" filters={defaults} action={action} propertyId={propertyId} />,
      );
      const form = filterForm();
      const submissions: Record<string, FormDataEntryValue>[] = [];
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        submissions.push(values(form));
      });
      expect(form.method).toBe('get');
      expect(form.getAttribute('action')).toBe(action);
      await user.clear(screen.getByLabelText('Min sqft'));
      await user.type(screen.getByLabelText('Min sqft'), '700');
      expect(requestSubmit).not.toHaveBeenCalled();
      await user.selectOptions(screen.getByLabelText('Radius'), '3');
      await user.click(screen.getByLabelText('Leased', { exact: true }));
      expect(requestSubmit).toHaveBeenCalledTimes(2);
      await user.click(screen.getByLabelText('Max sqft'));
      await user.keyboard('{Enter}');
      await user.click(screen.getByRole('button', { name: 'Update comps' }));
      expect(submissions).toHaveLength(4);
      expect(submissions.at(-1)).toMatchObject({
        unit: 'u-4b',
        radius: '3',
        minSqft: '700',
        status: 'leased',
      });
      expect(submissions.at(-1)?.property).toBe(propertyId);
    },
  );

  it('submits a keyboard unit choice with current explicit filters and property', async () => {
    const user = userEvent.setup();
    const submissions: Record<string, FormDataEntryValue>[] = [];
    vi.spyOn(HTMLFormElement.prototype, 'requestSubmit').mockImplementation(function (
      this: HTMLFormElement,
    ) {
      submissions.push(values(this));
    });
    render(
      <UnitPicker
        units={units}
        unitId="u-4b"
        action="/rent-analysis"
        propertyId="maple"
        filters={explicit}
      />,
    );
    const select = screen.getByLabelText('Unit');
    await user.tab();
    expect(document.activeElement).toBe(select);
    // jsdom has no native select keyboard default action; change commits the same event.
    fireEvent.change(select, { target: { value: 'u-3a' } });
    expect(submissions).toEqual([
      expect.objectContaining({
        property: 'maple',
        unit: 'u-3a',
        radius: '5',
        minSqft: '9999',
        maxSqft: '',
        status: 'leased',
      }),
    ]);
  });
});
