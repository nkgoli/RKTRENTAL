// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { hydrateRoot } from 'react-dom/client';
import { IncomeExpenseChart } from '@/components/returns/IncomeExpenseChart';
import { RangePicker } from '@/components/returns/RangePicker';
import { propertyReportActivity } from '@/components/returns/report-activity';
import { computeScopedReturns } from '@/lib/metrics/scoped';
import { resolvePeriod } from '@/lib/returns/period';

afterEach(cleanup);
const now = new Date('2026-10-18T12:00:00Z');
const period = resolvePeriod('MTD', now);

describe('returns presentation', () => {
  it('hydrates chart tooltips from server HTML without regenerating the report', async () => {
    const chart = (
      <IncomeExpenseChart
        rows={[{ month: '2026-10', incomeCents: 10001, expensesCents: 2345 }]}
        label="October report"
      />
    );
    const container = document.createElement('div');
    container.innerHTML = renderToString(chart);
    document.body.append(container);
    const errors: unknown[] = [];
    let root: ReturnType<typeof hydrateRoot>;
    await act(async () => {
      root = hydrateRoot(container, chart, { onRecoverableError: (error) => errors.push(error) });
    });
    expect(errors).toEqual([]);
    expect(container.querySelector('svg title')?.textContent).toContain(
      'income $100.01, expenses $23.45',
    );
    await act(async () => root.unmount());
    container.remove();
  });
  it('offers exact cent amounts and negative NOI alongside the chart', () => {
    render(
      <IncomeExpenseChart
        rows={[{ month: '2026-10', incomeCents: 10001, expensesCents: 12345 }]}
        label="Elm: October 2026"
      />,
    );
    const row = screen.getByRole('row', { name: /Oct/ });
    expect(within(row).getByText('$100.01')).toBeTruthy();
    expect(within(row).getByText('$123.45')).toBeTruthy();
    expect(within(row).getByText('-$23.44')).toBeTruthy();
    expect(screen.getByText('View exact amounts')).toBeTruthy();
  });
  it('explains no activity without a misleading blank chart', () => {
    render(
      <IncomeExpenseChart
        rows={[{ month: '2026-10', incomeCents: 0, expensesCents: 0 }]}
        label="Empty"
      />,
    );
    expect(screen.getByText(/No recorded income or expenses/)).toBeTruthy();
    expect(screen.queryByRole('img')).toBeNull();
  });
  it('keeps the selected unit in preset and custom range requests', () => {
    render(
      <RangePicker
        period={period}
        basePath="/properties/elm/returns"
        extra={{ unit: 'unit-1' }}
        now={now}
      />,
    );
    expect(screen.getByRole('link', { name: '2Y' }).getAttribute('href')).toBe(
      '/properties/elm/returns?unit=unit-1&period=2Y',
    );
    const form = screen.getByRole('form', { name: 'Custom range' });
    expect(new FormData(form as HTMLFormElement).get('unit')).toBe('unit-1');
    expect(screen.getByRole('link', { name: 'MTD' }).getAttribute('aria-current')).toBe('true');
  });
  it('includes archived-unit income in property report charts without allocating expenses twice', () => {
    const input = {
      property: {
        purchasePriceCents: 10000000,
        downPaymentCents: 2000000,
        annualDebtServiceCents: 0,
      },
      units: [
        {
          id: 'current',
          number: '1',
          status: 'OCCUPIED',
          monthlyRentCents: 100000,
          listedRentCents: null,
        },
        {
          id: 'archived',
          number: '2',
          status: 'ARCHIVED',
          monthlyRentCents: 0,
          listedRentCents: null,
        },
      ],
      payments: [
        { unitId: 'current', amountCents: 100000, paidAt: now },
        { unitId: 'archived', amountCents: 10001, paidAt: now },
      ],
      expenses: [{ category: 'REPAIRS', label: 'Repairs', amountCents: 2345, occurredOn: now }],
      period,
    };
    const result = propertyReportActivity({
      property: computeScopedReturns(input),
      units: input.units.map((u) => computeScopedReturns({ ...input, unitId: u.id })),
      unitFacts: [],
    });
    expect(result.monthly[0]).toMatchObject({ incomeCents: 110001, expensesCents: 2345 });
    expect(result.yearly[0]).toMatchObject({
      incomeCents: 110001,
      expensesCents: 2345,
      noiCents: 107656,
    });
  });
});
