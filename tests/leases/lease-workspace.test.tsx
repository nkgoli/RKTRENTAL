import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const fixture = vi.hoisted(() => ({ lease: {} as Record<string, unknown> }));
vi.mock('@/lib/auth/access', () => ({
  requireManagerRole: async () => ({ organizationId: 'org-1' }),
}));
vi.mock('@/lib/db/client', () => ({ db: { providerConnection: { count: async () => 1 } } }));
vi.mock('@/lib/leases/queries', () => ({
  leasesDb: () => ({ detail: async () => fixture.lease }),
}));
vi.mock('@/components/shell/PageHeader', () => ({ PageHeader: () => null }));
vi.mock('@/app/(manager)/leases/LeaseForms', () => ({
  EditTermsForm: () => <form aria-label="Edit lease terms" />,
  NoticeForm: () => <form aria-label="Record lease notice" />,
  LeaseStatusActions: ({ status }: { status: string }) => (
    <button>{status === 'DRAFT' ? 'Activate lease' : 'Terminate'}</button>
  ),
}));
vi.mock('@/app/(manager)/leases/[id]/LeaseDocumentGrid', () => ({
  LeaseDocumentGrid: () => <div>Upload lease document · Document controls</div>,
}));

import LeaseDetailPage from '@/app/(manager)/leases/[id]/page';

const day = (date: string) => new Date(`${date}T00:00:00Z`);
async function render(query: { tab?: string; propertyId?: string; unitId?: string } = {}) {
  return renderToStaticMarkup(
    await LeaseDetailPage({
      params: Promise.resolve({ id: 'lease-1' }),
      searchParams: Promise.resolve(query),
    }),
  );
}

beforeEach(() => {
  fixture.lease = {
    id: 'lease-1',
    status: 'ACTIVE',
    eSignStatus: 'SIGNED',
    unitId: 'unit-1',
    unit: {
      number: '4B',
      isImplicit: false,
      property: {
        id: 'property-1',
        name: 'Maple Court',
        street: '214 Maple Ave',
        city: 'Austin',
        state: 'TX',
        postalCode: '78704',
      },
    },
    startDate: day('2025-12-01'),
    endDate: day('2026-11-30'),
    createdAt: day('2025-11-10'),
    signedAt: day('2025-11-18'),
    monthlyRent: '1850',
    rentDueDay: 1,
    deposit: '1850',
    lateFee: '75',
    graceDays: 5,
    tenants: [
      {
        isPrimary: true,
        tenant: { id: 'tenant-1', name: 'Alex Rivera', email: 'alex@example.com' },
      },
    ],
    documents: [],
    charges: [],
    payments: [],
    events: [],
  };
});

describe('lease workspace', () => {
  it('defaults to a compact overview with identity, people, terms and contextual links', async () => {
    const html = await render({ tab: 'unknown' });
    expect(html).toMatch(/aria-current="page"[^>]*>Overview/);
    for (const value of [
      'Leased premises',
      'Tenants on this lease',
      'Dec 1, 2025',
      'Nov 30, 2026',
      '$1,850',
      'No notice given',
    ])
      expect(html).toContain(value);
    expect(html).toContain('/properties/property-1/units/unit-1');
    expect(html).toContain('/tenants/tenant-1');
    expect(html).not.toContain('Edit lease terms');
    expect(html).not.toContain('Upload lease document');
    expect(html).not.toContain('Terminate');
  });

  it('keeps editing, notice, templates and termination in the agreement', async () => {
    const html = await render({ tab: 'agreement' });
    for (const value of [
      'Edit lease terms',
      'Record lease notice',
      'Terminate',
      '/leases/templates',
    ])
      expect(html).toContain(value);
    expect(html).not.toContain('Document controls');
    expect(html).not.toContain('No agreement snapshot');
    expect(html).not.toContain('Terms as signed');
  });

  it('preserves signed wording and template version separately from editable terms', async () => {
    fixture.lease.termsSnapshot = {
      template: { name: 'Standard residential lease' },
      items: [
        {
          id: 'clause-1',
          section: 'CLAUSE',
          title: 'Security deposit',
          body: 'Deposit: {{security_deposit}}',
        },
      ],
    };
    fixture.lease.templateVersion = 2;
    const html = await render({ tab: 'agreement' });
    for (const value of [
      'Terms as signed',
      'Locked at send',
      'Standard residential lease',
      'v2',
      'Security deposit',
      '________ (security deposit)',
    ])
      expect(html).toContain(value);
  });

  it('keeps draft activation and ended lease restrictions', async () => {
    fixture.lease.status = 'DRAFT';
    let html = await render({ tab: 'agreement' });
    expect(html).toContain('Activate lease');
    expect(html).toContain('Edit lease terms');
    expect(html).not.toContain('Record lease notice');
    fixture.lease.status = 'ENDED';
    html = await render({ tab: 'agreement' });
    for (const value of ['Activate lease', 'Edit lease terms', 'Record lease notice', 'Terminate'])
      expect(html).not.toContain(value);
  });

  it('keeps documents and history in their own sections', async () => {
    const documents = await render({ tab: 'documents' });
    expect(documents).toContain('Upload lease document');
    expect(documents).toContain('Document controls');
    expect(documents).not.toContain('E-signature history');
    const activity = await render({ tab: 'activity' });
    expect(activity).toContain('E-signature history');
    expect(activity).toContain('Lease created');
    expect(activity).toContain('Fully signed Nov 18, 2025');
  });

  it('derives tab, return and payment scope from the lease instead of supplied IDs', async () => {
    const html = await render({
      tab: 'payments',
      propertyId: 'wrong-property',
      unitId: 'wrong-unit',
    });
    expect(html).not.toContain('wrong-property');
    expect(html).not.toContain('wrong-unit');
    expect(html).toContain('/properties/property-1/leases?unit=unit-1');
    expect(html).toContain('/properties/property-1/payments?unit=unit-1');
    expect(html).toContain('propertyId=property-1&amp;unitId=unit-1&amp;tab=activity');
  });
});
