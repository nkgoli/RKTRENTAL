import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CollectionChart, CollectionRangeChips } from '@/components/dashboard/CollectionChart';
import { labelIndexes, niceTicks } from '@/components/charts/ColumnChart';

describe('collection chart accessible amounts', () => {
  it('offers exact amounts for every month without relying on hover or color', () => {
    const months = Array.from({ length: 24 }, (_, i) => ({
      key: `${2025 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`,
      label: 'Month',
      dueCents: 100_000,
      collectedCents: i === 23 ? 75_000 : 100_000,
    }));
    const html = renderToStaticMarkup(<CollectionChart months={months} />);
    expect(html).toContain('View monthly amounts');
    expect(html).toContain('Collected</th>');
    expect(html.match(/scope="row"/g)).toHaveLength(24);
    expect(html).toContain('$750');
    expect(html).toContain('· to date');
    expect(html.match(/data-partial="true"/g)).toHaveLength(1);
    expect(html).toContain('Outstanding</th>');
    expect(html).toContain('$250');
  });

  it('keeps the range in the URL and marks the current one', () => {
    const html = renderToStaticMarkup(<CollectionRangeChips range="2Y" />);
    expect(html).toContain('aria-current="true"');
    expect(html).toContain('/dashboard?range=5Y');
    expect(html).toContain('href="/dashboard"');
  });

  it('explains unavailable series and never draws invalid geometry', () => {
    const html = renderToStaticMarkup(<CollectionChart months={[]} />);
    expect(html).toContain('No collection data for this range');
    expect(html).not.toContain('NaN');
    expect(html).not.toContain('Infinity');
  });

  it('scales columns against rounded ticks and names the plot', () => {
    const html = renderToStaticMarkup(
      <CollectionChart
        months={[
          { key: '2026-09', label: 'Sep', dueCents: 200_000, collectedCents: 100_000 },
          { key: '2026-10', label: 'Oct', dueCents: 200_000, collectedCents: 150_000 },
        ]}
      />,
    );
    // Ticks 0 / $500 / $1K / $1.5K / $2K: $1,000 collected is half the plot, $1,500 three quarters.
    expect(html).toContain('height:50%');
    expect(html).toContain('height:75%');
    expect(html.match(/data-series="collected"/g)).toHaveLength(2);
    for (const tick of ['$0', '$1K', '$2K']) expect(html).toContain(`>${tick}</span>`);
    expect(html).toContain('aria-label="Rent collected against rent due, last 2 months"');
  });
});

describe('column chart scale helpers', () => {
  it('rounds the axis to readable steps', () => {
    expect(niceTicks(133_210)).toEqual([0, 50_000, 100_000, 150_000]);
    expect(niceTicks(2_000)).toEqual([0, 500, 1_000, 1_500, 2_000]);
    expect(niceTicks(0)).toEqual([0, 1]);
  });

  it('thins axis labels on long ranges but keeps the latest', () => {
    expect([...labelIndexes(6)]).toHaveLength(6);
    const long = labelIndexes(60);
    expect(long.size).toBeLessThanOrEqual(8);
    expect(long.has(59)).toBe(true);
  });
});
