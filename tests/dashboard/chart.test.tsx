import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CollectionChart } from '@/components/dashboard/CollectionChart';

describe('collection chart accessible amounts', () => {
  it('offers exact amounts for every month without relying on hover or color', () => {
    const months = Array.from({ length: 24 }, (_, i) => ({
      key: `${2025 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`,
      label: 'Month',
      dueCents: 100_000,
      collectedCents: i === 23 ? 75_000 : 100_000,
    }));
    const html = renderToStaticMarkup(<CollectionChart months={months} range="2Y" />);
    expect(html).toContain('View monthly amounts');
    expect(html).toContain('scope="col">Collected');
    expect(html.match(/scope="row"/g)).toHaveLength(24);
    expect(html).toContain('$750');
    expect(html).toContain('Current month (to date)');
    expect(html).toContain('fill-opacity="0.45"');
    expect(html).toContain('· to date');
    expect(html).toContain('aria-current="true"');
    expect(html).toContain('/dashboard?range=5Y');
    expect(html).toContain('scope="col">Outstanding');
    expect(html).toContain('$250');
  });

  it('explains unavailable series and never draws invalid geometry', () => {
    const html = renderToStaticMarkup(<CollectionChart months={[]} range="6M" />);
    expect(html).toContain('Collection data is unavailable');
    expect(html).not.toContain('NaN');
    expect(html).not.toContain('Infinity');
  });

  it('keeps currency ticks outside the stretching SVG while preserving plotted data', () => {
    const html = renderToStaticMarkup(
      <CollectionChart
        months={[
          { key: '2026-09', label: 'Sep', dueCents: 200_000, collectedCents: 100_000 },
          { key: '2026-10', label: 'Oct', dueCents: 200_000, collectedCents: 150_000 },
        ]}
        range="6M"
      />,
    );
    const svg = html.match(/<svg\b[^>]*>[\s\S]*?<\/svg>/)?.[0] ?? '';
    expect(svg).not.toContain('<text');
    expect(svg.match(/<rect /g)).toHaveLength(2);
    expect(svg).toContain('height="50"');
    expect(svg).toContain('height="75"');
    const beforePlot = html.slice(0, html.indexOf('<svg'));
    for (const tick of ['$0', '$1K', '$2K']) expect(beforePlot).toContain(`>${tick}</span>`);
    expect(svg).toContain('Rent collected against rent due, last 2 months');
  });
});
