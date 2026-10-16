import { describe, expect, it } from 'vitest';
import { workspaceTabHref } from '@/components/workspace/routes';
import { legacyTabDestination } from '@/app/(manager)/properties/[id]/routing';
import { findManagerItem } from '@/components/shell/nav';

describe('property workspace routes', () => {
  it('keeps all eight tabs under the property and preserves unit scope', () => {
    const tabs = ['overview', 'listing', 'applications', 'leases', 'payments', 'returns', 'maintenance', 'documents'] as const;
    expect(tabs.map((tab) => workspaceTabHref('p1', tab, 'u 1'))).toEqual([
      '/properties/p1?unit=u%201',
      ...tabs.slice(1).map((tab) => `/properties/p1/${tab}?unit=u%201`),
    ]);
  });

  it('maps legacy tab queries and unit paths to the child route convention', () => {
    expect(legacyTabDestination('p1', { tab: 'listing', period: '12M' })).toBe('/properties/p1/listing?period=12M');
    expect(legacyTabDestination('p1', { tab: 'returns', notice: 'saved' }, 'u1')).toBe('/properties/p1/returns?notice=saved&unit=u1');
    expect(legacyTabDestination('p1', { tab: 'overview' }, 'u1')).toBe('/properties/p1?unit=u1');
  });

  it('keeps Properties as the sidebar selection on every tab', () => {
    for (const tab of ['overview', 'listing', 'applications', 'leases', 'payments', 'returns', 'maintenance', 'documents'] as const) {
      const pathname = workspaceTabHref('p1', tab);
      expect(findManagerItem(pathname)?.item.label).toBe('Properties');
    }
  });
});
