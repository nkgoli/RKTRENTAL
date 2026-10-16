import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { Workspace } from '@/components/workspace/Workspace';

vi.mock('next/navigation', () => ({
  usePathname: () => '/maintenance',
  useSearchParams: () => new URLSearchParams(),
}));

const scope = {
  propertyId: 'p1', propertyName: 'Maple Court', propertyType: 'MULTI_UNIT',
  unitId: 'u1', unitNumber: '4B', unitStatus: 'OCCUPIED',
};

describe('workspace tabs on leasing and ops pages', () => {
  it('keeps every unit tab under the property route and marks the active one', () => {
    const html = renderToStaticMarkup(<Workspace scope={scope} activeTab="maintenance" />);
    expect(html).toContain('href="/properties/p1?unit=u1"');
    expect(html).toContain('href="/properties/p1/listing?unit=u1"');
    expect(html).toContain('href="/properties/p1/returns?unit=u1"');
    for (const page of ['applications', 'leases', 'payments', 'maintenance']) {
      expect(html).toContain(`href="/properties/p1/${page}?unit=u1"`);
    }
    expect(html).not.toContain('/properties/p1/documents');
    expect(html.match(/aria-current="page"/g)).toHaveLength(2); // breadcrumb + active tab
    expect(html).toMatch(/aria-current="page"[^>]*>Maintenance</);
  });

  it('scopes property tabs without a unitId', () => {
    const html = renderToStaticMarkup(<Workspace scope={{ ...scope, unitId: undefined, unitNumber: undefined }} activeTab="payments" />);
    expect(html).toContain('href="/properties/p1/payments"');
    expect(html).not.toContain('?unit=');
  });
});
