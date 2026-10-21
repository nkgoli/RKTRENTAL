// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { PropertyRoiFields } from '@/app/(manager)/properties/_components/PropertyRoiFields';
import { valuesFrom, type Values } from '@/components/analysis/fields';
import { applyPropertyPatch, patchedPaths } from '@/lib/analysis/property-sync';
import { assumptionsEditPath, roiReturnPath } from '@/lib/analysis/return-path';
import { PayloadSchema, calculatePayload } from '@/lib/analysis';
import type { PropertyRoiInputs } from '@/lib/properties/roi-inputs';
import { useState } from 'react';
import { payload } from './fixture';

afterEach(cleanup);

describe('Returns & ROI return address', () => {
  it('rebuilds only same-property ROI addresses from known parameters', () => {
    expect(roiReturnPath('/roi-analysis?property=p1', 'p1')).toBe('/roi-analysis?property=p1');
    expect(
      roiReturnPath(
        '/roi-analysis?property=p1&view=actual&period=CUSTOM&from=2026-01-01&to=2026-03-31&evil=1',
        'p1',
      ),
    ).toBe('/roi-analysis?property=p1&view=actual&period=CUSTOM&from=2026-01-01&to=2026-03-31');
    for (const raw of [
      undefined,
      '',
      'roi-analysis?property=p1',
      '//evil.example/roi-analysis?property=p1',
      'https://evil.example/roi-analysis?property=p1',
      '/\\evil.example/roi-analysis?property=p1',
      '/roi-analysis?property=p2',
      '/roi-analysis/../properties?property=p1',
      '/roi-analysis?property=p1#x',
      '/returns?property=p1',
    ])
      expect(roiReturnPath(raw, 'p1')).toBeNull();
  });
  it('keeps every supported section and the Charts sub-tab, dropping unknown values', () => {
    for (const view of ['scenarios', 'benchmarks', 'compare'])
      expect(roiReturnPath(`/roi-analysis?property=p1&view=${view}&chart=exit`, 'p1')).toBe(
        `/roi-analysis?property=p1&view=${view}`,
      );
    expect(
      roiReturnPath('/roi-analysis?period=YTD&chart=sensitivity&view=charts&property=p1', 'p1'),
    ).toBe('/roi-analysis?property=p1&view=charts&chart=sensitivity&period=YTD');
    expect(roiReturnPath('/roi-analysis?property=p1&view=charts&chart=equity', 'p1')).toBe(
      '/roi-analysis?property=p1&view=charts',
    );
    expect(roiReturnPath('/roi-analysis?property=p1&view=charts&chart=%3Cx%3E', 'p1')).toBe(
      '/roi-analysis?property=p1&view=charts',
    );
    for (const view of ['summary', 'evil', 'javascript:alert(1)'])
      expect(roiReturnPath(`/roi-analysis?property=p1&view=${view}`, 'p1')).toBe(
        '/roi-analysis?property=p1',
      );
  });
  it('links to the property editor ROI section with an allowlisted field', () => {
    const href = new URL(
      assumptionsEditPath('p1', '/roi-analysis?property=p1', 'input.income.vacancyRate'),
      'http://local.test',
    );
    expect(href.pathname).toBe('/properties/p1/edit');
    expect(href.searchParams.get('returnTo')).toBe('/roi-analysis?property=p1');
    expect(href.searchParams.get('field')).toBe('input.income.vacancyRate');
    expect(href.hash).toBe('#roi-details');
    expect(
      new URL(assumptionsEditPath('p1', '/roi-analysis?property=p1', '"><x'), 'http://l').search,
    ).not.toContain('field');
  });
});

describe('saved analysis source precedence after a property save', () => {
  const patch = (value: Partial<PropertyRoiInputs>): PropertyRoiInputs => ({
    version: 1,
    input: {},
    options: {},
    ...value,
  });
  it('applies only supplied and cleared baseline paths, keeping scenarios, benchmarks and edits', () => {
    const saved = payload('p1');
    saved.input.expenses!.insurance = 777; // an earlier ROI-only edit the property never had
    const observed = new Date('2026-10-20T00:00:00.000Z');
    const next = applyPropertyPatch(
      saved,
      patch({
        input: { income: { vacancyRate: 5 } },
        cleared: ['input.appreciationExit.sellingCostsPercent'],
      }),
      observed,
    )!;
    expect(next.input.income?.vacancyRate).toBe(5);
    expect(next.input.appreciationExit?.sellingCostsPercent).toBeUndefined();
    expect(next.input.expenses?.insurance).toBe(777);
    expect(next.input.income?.monthlyRent).toBe(1000);
    expect(next.scenarios).toEqual(saved.scenarios);
    expect(next.benchmarks).toEqual(saved.benchmarks);
    expect(next.options).toEqual(saved.options);
    expect(next.evidence.filter((e) => e.path === 'input.income.vacancyRate')).toEqual([
      expect.objectContaining({ source: 'property', observedAt: observed.toISOString() }),
    ]);
    expect(PayloadSchema.parse(next)).toBeTruthy();
    expect(saved.input.income?.vacancyRate).toBe(0);
  });
  it('ignores saves that change no baseline assumption and never patches tax options', () => {
    expect(applyPropertyPatch(payload('p1'), patch({}), new Date())).toBeNull();
    expect(patchedPaths(patch({ cleared: ['options.tax'] }))).toEqual({ set: [], cleared: [] });
  });
  it('keeps full calculation precision for synced values', () => {
    const next = applyPropertyPatch(
      payload('p1'),
      patch({ input: { income: { monthlyRent: 1234.56 } } }),
      new Date(),
    )!;
    const { scenarios: _s, benchmarks: _b, ...base } = next;
    void _s;
    void _b;
    const result = calculatePayload({ ...base, scenarios: [], benchmarks: [] }).base;
    expect(result.summaryMetrics.grossPotentialIncome).toBeCloseTo(1234.56 * 12, 8);
  });
});

function Editor({ base, field }: { base: ReturnType<typeof payload>; field?: string }) {
  const [original] = useState<Values>(() => valuesFrom(base));
  const [values, setValues] = useState<Values>(original);
  return (
    <form aria-label="Edit property">
      <PropertyRoiFields
        values={values}
        original={original}
        onChange={setValues}
        baseline={base}
        focusField={field}
        saved="draft revision 4"
        propertyValues={{ ...original, 'input.expenses.insurance': '50' }}
      />
    </form>
  );
}
const submitted = () =>
  JSON.parse(
    (document.querySelector('input[name="roiInputs"]') as HTMLInputElement).value,
  ) as PropertyRoiInputs;

describe('ROI assumptions in Edit Property', () => {
  it('prefills the saved analysis baseline, focuses the chosen field and submits only changes', async () => {
    const base = payload('p1');
    base.input.expenses!.insurance = 0;
    render(<Editor base={base} field="input.income.vacancyRate" />);
    const vacancy = screen.getByLabelText('Vacancy (%)') as HTMLInputElement;
    await waitFor(() => expect(document.activeElement).toBe(vacancy));
    expect(vacancy.value).toBe('0');
    expect((screen.getByLabelText('Scheduled rent ($ / month)') as HTMLInputElement).value).toBe(
      '1000',
    );
    expect(screen.getByText(/You are editing draft revision 4/)).toBeTruthy();
    expect(screen.getByText('Analysis value. Property details: 50.')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toMatch(/All required assumptions are complete/);
    expect(submitted()).toEqual({ version: 1, input: {}, options: {} });
    fireEvent.change(vacancy, { target: { value: '6.5' } });
    expect(submitted()).toEqual({
      version: 1,
      input: { income: { vacancyRate: 6.5 } },
      options: {},
    });
  });
  it('lists every missing input with field-level guidance without blocking the save', () => {
    const base = payload('p1');
    delete base.input.income!.monthlyRent;
    delete base.input.expenses!.insurance;
    render(<Editor base={base} />);
    const status = screen.getByRole('status');
    expect(status.textContent).toMatch(/2 inputs needed to calculate ROI/);
    expect(screen.getByRole('link', { name: /Scheduled rent.*Enter a value/ })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Insurance.*Enter a value/ })).toBeTruthy();
    const rent = screen.getByLabelText('Scheduled rent ($ / month)') as HTMLInputElement;
    expect(rent.getAttribute('aria-invalid')).toBe('true');
    fireEvent.change(rent, { target: { value: '0' } });
    expect(screen.getByRole('status').textContent).toMatch(/1 input needed to calculate ROI/);
    expect(submitted().input.income?.monthlyRent).toBe(0);
    fireEvent.click(screen.getByRole('link', { name: /Insurance.*Enter a value/ }));
    expect(document.activeElement).toBe(screen.getByLabelText('Insurance ($ / year)'));
  });
});
