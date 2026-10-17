import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { KpiCard } from '@/components/dashboard/KpiCard';
import { MiniCover } from '@/components/dashboard/MiniCover';
import { ProviderLogo } from '@/components/integrations/ProviderLogo';

describe('restyled page pieces', () => {
  it('renders a compact KPI card with trend chip, sparkline and ring and no icon tile', () => {
    const html = renderToStaticMarkup(
      <KpiCard
        label="Net operating income"
        value="$12,000.00"
        note="Income less expenses"
        trend="▲ 8%"
        spark={[1, 2, 3]}
        ring={64}
      />,
    );
    expect(html).toContain('class="card kpi stat"');
    expect(html).toContain('<div class="label">Net operating income</div>');
    expect(html).not.toContain('kpi-icon');
    expect(html).toContain('class="trend"');
    expect(html).toContain('<polyline');
    expect(html).toContain('64%');
  });

  it('omits the optional pieces when they are not given', () => {
    const html = renderToStaticMarkup(<KpiCard label="Cap rate" value="5.1%" />);
    expect(html).not.toContain('trend');
    expect(html).not.toContain('<polyline');
    expect(html).not.toContain('class="ring');
  });

  it('draws a mini cover from the property shape or its photo', () => {
    const illustrated = renderToStaticMarkup(
      <MiniCover cover={{ type: 'SINGLE_UNIT', unitCount: 1, coverPhotoId: null }} />,
    );
    expect(illustrated).toContain('cover--house');
    const photo = renderToStaticMarkup(
      <MiniCover cover={{ type: 'MULTI_UNIT', unitCount: 8, coverPhotoId: 'p1' }} />,
    );
    expect(photo).toContain('/api/files/p1/preview');
    expect(photo).toContain('cover--apartment');
    expect(renderToStaticMarkup(<MiniCover />)).toContain('cover--apartment');
  });

  it('marks connected provider logos', () => {
    const on = renderToStaticMarkup(<ProviderLogo logo="S" connected />);
    const off = renderToStaticMarkup(<ProviderLogo logo="P" />);
    expect(on).toMatch(/class="[^"]*connected[^"]*"/);
    expect(off).not.toMatch(/connected/);
  });
});
