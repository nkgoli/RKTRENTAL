import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { Workspace } from '@/components/workspace/Workspace';

const scope = {
  propertyId: 'p1', propertyName: 'Maple Court', propertyType: 'MULTI_UNIT',
  unitId: 'u1', unitNumber: '4B', unitStatus: 'OCCUPIED',
};

describe('workspace tabs on leasing and ops pages', () => {
  it('links every unit tab with the propertyId/unitId contract and marks the active one', () => {
    const html = renderToStaticMarkup(<Workspace scope={scope} activeTab="maintenance" />);
    expect(html).toContain('href="/properties/p1/units/u1"');
    expect(html).toContain('href="/properties/p1/units/u1?tab=listing"');
    expect(html).toContain('href="/properties/p1/units/u1?tab=returns"');
    for (const page of ['applications', 'leases', 'payments', 'maintenance', 'documents']) {
      expect(html).toContain(`href="/${page}?propertyId=p1&amp;unitId=u1"`);
    }
    expect(html.match(/aria-current="page"/g)).toHaveLength(2); // breadcrumb + active tab
    expect(html).toMatch(/aria-current="page"[^>]*>Maintenance</);
  });

  it('scopes property tabs without a unitId', () => {
    const html = renderToStaticMarkup(<Workspace scope={{ ...scope, unitId: undefined, unitNumber: undefined }} activeTab="payments" />);
    expect(html).toContain('href="/payments?propertyId=p1"');
    expect(html).not.toContain('unitId=');
  });
});
