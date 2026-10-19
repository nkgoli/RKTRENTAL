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
    expect(html).toContain('aria-current="true"');
    expect(html).toContain('/dashboard?range=5Y');
  });
});
