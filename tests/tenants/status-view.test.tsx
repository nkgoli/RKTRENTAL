import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { StatusView } from '@/app/(manager)/tenants/StatusView';
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn() }) }));

describe('tenant status view', () => {
  it('shows tracked payment facts without untracked checklist noise or false attention', () => {
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
    expect(html).toContain('Bank added');
    expect(html).toContain('Autopay on');
    expect(html).toContain('Needs payment method · 0');
    for (const label of [
      'Invited',
      'Accepted',
      'Bank verified',
      'Not tracked',
      'Resend invite',
      'Apply filters',
    ])
      expect(html).not.toContain(label);
    expect(html).toContain('Maple Court');
    expect(html).toContain('Unit 4B');
    expect(html).toContain('/tenants/tenant-1');
    expect(html).toContain('Alex Rivera');
  });
});
