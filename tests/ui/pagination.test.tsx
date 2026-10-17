import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { PAGE_SIZE, Pagination, pageFrom, paginate } from '@/components/ui/Pagination';

describe('pagination helpers', () => {
  it('pages about twenty rows at a time and clamps bad input', () => {
    expect(PAGE_SIZE).toBe(20);
    const rows = Array.from({ length: 45 }, (_, i) => i);
    expect(pageFrom(undefined, rows.length)).toBe(1);
    expect(pageFrom('2', rows.length)).toBe(2);
    expect(pageFrom('99', rows.length)).toBe(3);
    expect(pageFrom('-4', rows.length)).toBe(1);
    expect(pageFrom('abc', rows.length)).toBe(1);
    expect(paginate(rows, 3)).toEqual([40, 41, 42, 43, 44]);
    expect(paginate(rows, 1)).toHaveLength(20);
  });

  it('renders a range summary with prev/next links and hides itself for one page', () => {
    const html = renderToStaticMarkup(
      <Pagination page={2} total={45} noun="leases" href={(p) => `/x?page=${p}`} />,
    );
    expect(html).toContain('21–40 of 45 leases');
    expect(html).toContain('href="/x?page=1"');
    expect(html).toContain('href="/x?page=3"');
    expect(renderToStaticMarkup(<Pagination page={1} total={12} href={() => '/'} />)).toBe('');
  });
});
