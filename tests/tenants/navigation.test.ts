import { describe, expect, it } from 'vitest';
import { tenantReturnHref } from '@/app/(manager)/tenants/navigation';

describe('tenant directory return destination', () => {
  it('retains search, property, view and page without accepting unrelated parameters', () => {
    expect(tenantReturnHref('/tenants?view=directory&q=Alex&property=maple&page=2&edit=1')).toBe(
      '/tenants?view=directory&q=Alex&property=maple&page=2',
    );
    expect(tenantReturnHref('/tenants?period=upcoming&property=maple')).toBe(
      '/tenants?property=maple&period=upcoming',
    );
  });
  it.each([
    'https://example.com/tenants',
    '//example.com/tenants',
    '/payments',
    '/tenants/another',
    undefined,
  ])('rejects non-directory destinations: %s', (candidate) => {
    expect(tenantReturnHref(candidate)).toBe('/tenants?view=directory');
  });
});
