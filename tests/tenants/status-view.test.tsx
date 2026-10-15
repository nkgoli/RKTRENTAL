import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { StatusView } from '@/app/(manager)/tenants/StatusView';

describe('tenant status view', () => {
  it('groups a lease, shows all six checklist columns, and links to its lease', () => {
    const html = renderToStaticMarkup(
      <StatusView
        q={undefined}
        period="current"
        properties={[{ id: 'property-1', name: 'Maple Court' }]}
        rows={[
          {
            leaseId: 'lease-1',
            leaseStatus: 'ACTIVE',
            startDate: new Date('2026-01-01'),
            endDate: new Date('2026-12-31'),
            property: { id: 'property-1', name: 'Maple Court' },
            unit: { id: 'unit-1', number: '4B', isImplicit: false },
            tenant: { id: 'tenant-1', name: 'Alex Rivera', email: 'alex@example.com', phone: null },
            checklist: {
              invited: 'not-applicable',
              accepted: 'not-applicable',
              bankAdded: 'complete',
              bankVerified: 'not-applicable',
              autopayOn: 'complete',
              cardOnFile: 'not-applicable',
            },
          },
        ]}
      />,
    );
    for (const label of [
      'Invited',
      'Accepted',
      'Bank added',
      'Bank verified',
      'Autopay on',
      'Card on file',
    ]) {
      expect(html).toContain(label);
    }
    expect(html).toContain('Maple Court');
    expect(html).toContain('Unit 4B');
    expect(html).toContain('/leases/lease-1');
    expect(html).toContain('Alex Rivera');
    expect(html).toContain('Not applicable');
  });
});
