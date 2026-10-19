// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { parseFilters, type SubjectFacts } from '../../src/lib/comps/core';
import { FilterBar, UnitPicker } from '../../src/app/(manager)/rent-comps/FilterBar';

afterEach(cleanup);

const subject: SubjectFacts = {
  postalCode: '78704',
  bedrooms: 2,
  bathrooms: 2,
  squareFeet: 950,
  defaultRadiusMiles: 2,
};
const filters = parseFilters({ radius: '3', status: 'listed' }, subject);
const units = [
  { id: 'u-4a', label: 'Maple Court Â· 4A' },
  { id: 'u-4b', label: 'Maple Court Â· 4B' },
];

const hidden = (form: HTMLFormElement, name: string) =>
  form.querySelector<HTMLInputElement>(`input[type="hidden"][name="${name}"]`)?.value;

describe('standalone filter and picker forms', () => {
  it('preserves property, unit and filters through unit selection', () => {
    const { container } = render(
      <UnitPicker units={units} unitId="u-4b" action="/rent-analysis" propertyId="maple" filters={filters} />,
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
    const { container } = render(<FilterBar unitId="u-4b" filters={filters} action="/rent-comps" />);
    const form = container.querySelector('form')!;
    expect(form.getAttribute('action')).toBe('/rent-comps');
    expect(hidden(form, 'property')).toBeUndefined();
    expect(hidden(form, 'unit')).toBe('u-4b');
  });
});
