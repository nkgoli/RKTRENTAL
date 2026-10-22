import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const fixture = vi.hoisted(() => ({
  lease: {} as Record<string, unknown>,
  agreement: null as Record<string, unknown> | null,
}));
const rowProps = vi.hoisted(() => [] as Record<string, unknown>[]);
// Records what the server page hands the client ledger rows (it must stay serializable).
vi.mock('@/components/payments/RentLedger', async (original) => {
  const real = await original<typeof import('@/components/payments/RentLedger')>();
  return {
    ...real,
    RentLedgerRows: (props: Parameters<typeof real.RentLedgerRows>[0]) => {
      rowProps.push(props);
      return real.RentLedgerRows(props);
    },
  };
});
vi.mock('@/lib/auth/access', () => ({
  requireManagerRole: async () => ({ organizationId: 'org-1' }),
}));
vi.mock('@/lib/db/client', () => ({
  db: {
    providerConnection: { count: async () => 1 },
    leaseAgreement: { findFirst: async () => fixture.agreement },
  },
}));
vi.mock('@/lib/leases/queries', () => ({
  leasesDb: () => ({ detail: async () => fixture.lease }),
}));
vi.mock('@/lib/ledger', async (original) => ({
  ...(await original<typeof import('@/lib/ledger')>()),
  ensureRentCharges: vi.fn(),
}));
vi.mock('@/components/shell/PageHeader', () => ({
  PageHeader: ({
    eyebrow,
    meta,
    back,
  }: {
    eyebrow?: string;
    meta?: string;
    back?: { href: string; label: string };
  }) => (
    <header data-testid="page-header">
      {back && <a href={back.href}>{back.label}</a>}
      <p>{eyebrow}</p>
      <p>{meta}</p>
    </header>
  ),
}));
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
  fixture.agreement = null;
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

  it('heads the lease with its term, place, rent, payments state and an expiry warning', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-22T12:00:00Z'));
    const html = await render().finally(() => vi.useRealTimers());
    expect(html).toContain('Lease · Dec 1, 2025 → Nov 30, 2026');
    expect(html).toContain('Unit 4B · $1,850/mo · Online payments enabled');
    expect(html).toContain('href="/leases"');
    expect(html).toContain('Active · ends in 39 days');
    expect(html).toContain('href="/tenants/tenant-1"');
  });

  it('shows a state-aware signature panel from stored signing records', async () => {
    // Marked signed without a stored PDF: the panel says so and offers the retry path.
    let html = await render();
    expect(html).toContain('aria-label="Agreement signing"');
    expect(html).toContain('data-state="attention"');
    expect(html).toContain('Signed PDF unavailable');
    expect(html).toContain('<span>Alex Rivera</span><span class="badge info">Named tenant</span>');
    expect(html).toContain('<span class="badge info">Review in PDF</span>');
    expect(html).toContain('href="/sign/leases/lease-1"');
    expect(html).toContain('Review lease files');
    expect(html).toContain('aria-label="Retry: check the signed PDF again from the agreement"');
    // A stored signed lease file makes the agreement "on file" with a download.
    fixture.lease.documents = [
      {
        id: 'doc-signed',
        name: 'Signed lease agreement.pdf',
        kind: 'LEASE',
        mimeType: 'application/pdf',
        sizeBytes: 24_576n,
        createdAt: day('2025-11-24'),
      },
    ];
    html = await render();
    expect(html).toContain('data-state="done"');
    expect(html).toContain('Signed agreement on file');
    expect(html).toContain('/api/files/doc-signed/download');
    // The latest signing version wins: awaiting the owner.
    fixture.agreement = {
      signedAt: null,
      supersededAt: null,
      archiveStatus: 'AWAITING_SIGNATURES',
      archiveLastError: null,
      version: 2,
      parties: [
        { role: 'TENANT', expectedName: 'Alex Rivera', signedAt: day('2026-10-01') },
        { role: 'OWNER', expectedName: 'Morgan Owner', signedAt: null },
      ],
      files: [],
    };
    html = await render();
    expect(html).toContain('data-state="pending"');
    expect(html).toContain('Awaiting signatures');
    expect(html).toContain('1 of 2 signed · version 2');
    expect(html).toContain('Owner / lessor · Morgan Owner');
    fixture.agreement = null;
    fixture.lease.documents = [];
    fixture.lease.eSignStatus = 'NOT_SENT';
    html = await render();
    expect(html).toContain('Agreement not sent for signature');
    // The visible words lead the accessible name, which keeps the agreement context.
    expect(html).toMatch(
      /class="btn btn-sm btn-primary"[^>]*aria-label="Review signatures on the lease agreement"[^>]*>Review signatures<\/a>/,
    );
    // The agreement tab already holds the signer panel, so the bar keeps only the signing link.
    html = await render({ tab: 'agreement' });
    expect(html).not.toContain('Review signatures on the lease agreement');
    expect(html).toContain('href="/sign/leases/lease-1"');
  });

  it('puts terms, documents and activity beside the ledger on overview and payments', async () => {
    for (const tab of ['overview', 'payments']) {
      const html = await render({ tab });
      for (const value of [
        'Rent ledger',
        'id="lease-terms-card"',
        'Manage agreement &amp; notice',
        'id="lease-documents-card"',
        'Add addendum',
        'Portfolio documents',
        'id="lease-activity-card"',
        'Lease created',
        tab === 'payments'
          ? 'Full ledger &amp; reminder review'
          : 'Review balance before any reminder',
        '/leases/lease-1/ledger',
        'Notice: none given · Move-out: not scheduled',
        '$75 after a 5-day grace period',
      ])
        expect(html, `${tab}: ${value}`).toContain(value);
    }
  });

  it('includes the visible text in every labelled link’s accessible name', async () => {
    for (const eSignStatus of ['SIGNED', 'SENT', 'NOT_SENT']) {
      fixture.lease.eSignStatus = eSignStatus;
      for (const tab of ['overview', 'agreement', 'documents', 'payments', 'activity']) {
        const html = await render({ tab });
        const labelled = [...html.matchAll(/<a [^>]*aria-label="([^"]+)"[^>]*>(.*?)<\/a>/g)];
        expect(labelled.length).toBeGreaterThan(0);
        for (const [, label, inner] of labelled) {
          const text = inner
            .replace(/<span aria-hidden="true">.*?<\/span>/g, '')
            .replace(/<[^>]+>/g, '')
            .replace(/&amp;/g, '&')
            .trim();
          if (text) expect(label.toLowerCase(), `${tab}: "${text}"`).toContain(text.toLowerCase());
        }
      }
    }
  });

  it('passes only serializable props to the client ledger rows', async () => {
    const hasFunction = (value: unknown): boolean =>
      typeof value === 'function' ||
      (Array.isArray(value)
        ? value.some(hasFunction)
        : value instanceof Date || value === null || typeof value !== 'object'
          ? false
          : Object.values(value).some(hasFunction));
    for (const tab of ['overview', 'payments']) {
      rowProps.length = 0;
      await render({ tab });
      expect(rowProps.length, tab).toBeGreaterThan(0);
      for (const props of rowProps) expect(hasFunction(props), tab).toBe(false);
      expect(rowProps[0].reminderHrefs).toEqual({
        'lease-1': '/leases/lease-1/ledger#reminder-review',
      });
    }
  });

  it('groups lease documents beside the terms', async () => {
    fixture.lease.documents = [
      {
        id: 'doc-signed',
        name: 'Signed lease agreement.pdf',
        kind: 'LEASE',
        mimeType: 'application/pdf',
        sizeBytes: 24_576n,
        createdAt: day('2025-11-24'),
      },
    ];
    const html = await render({ tab: 'documents' });
    expect(html).toContain('Lease documents');
    expect(html).toContain('Files owned by this lease · 1 file');
    expect(html).toContain('id="lease-terms-card"');
    expect(html).not.toContain('id="lease-activity-card"');
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
    expect(html).not.toContain('Prepared lease terms');
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
      'Prepared lease terms',
      'Saved terms',
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

  it('shows the full Rent ledger from the shared statement, not a three-row excerpt', async () => {
    const charge = (month: string, amount = '1850.00', description = `rent:lease-1:${month}`) => ({
      id: `c-${month}-${description}`,
      leaseId: 'lease-1',
      kind: description.startsWith('rent:') ? 'RENT' : 'OTHER',
      amount,
      dueDate: day(`${month}-01`),
      description,
    });
    fixture.lease.charges = [
      ...['2026-07', '2026-08', '2026-09', '2026-10'].map((m) => charge(m)),
      charge('2026-10', '75.00', 'Pet fee'),
    ];
    fixture.lease.payments = [
      {
        id: 'p-fail',
        leaseId: 'lease-1',
        amount: '1850.00',
        status: 'FAILED',
        paidAt: day('2026-10-04'),
        createdAt: day('2026-10-04'),
        providerReference: null,
      },
      ...['2026-07', '2026-08', '2026-09'].map((m) => ({
        id: `p-${m}`,
        leaseId: 'lease-1',
        amount: '1850.00',
        status: 'SUCCEEDED',
        paidAt: day(`${m}-02`),
        createdAt: day(`${m}-02`),
        providerReference: null,
      })),
      {
        id: 'p-part',
        leaseId: 'lease-1',
        amount: '500.00',
        status: 'SUCCEEDED',
        paidAt: day('2026-10-03'),
        createdAt: day('2026-10-03'),
        providerReference: null,
      },
    ];
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-15T12:00:00Z'));
    const html = await render({ tab: 'payments' }).finally(() => vi.useRealTimers());
    expect(html).toContain('Rent ledger');
    expect(html).toContain('This lease only · 4B');
    // 4 × 1,850 + 75 due, minus 3 × 1,850 + 500 settled; the failed attempt never counts.
    expect(html).toContain('$1,425.00');
    expect(html).toMatch(/Last payment<\/dt><dd[^>]*>Oct 3, 2026<small>\$500\.00/);
    for (const text of [
      'July rent',
      'August rent',
      'September rent',
      'October rent',
      'Pet fee',
      'November rent',
    ])
      expect(html).toContain(text);
    expect(html).toContain('Balance $1,350.00');
    expect(html).toContain('Late · past grace');
    // Late charges open the lease's reminder review; nothing is sent from the ledger.
    expect(html).toContain('href="/leases/lease-1/ledger#reminder-review"');
    // Record payment names this lease so a sibling term on the unit is never chosen instead.
    expect(html).toContain(
      '/properties/property-1/payments?unit=unit-1&amp;record=1&amp;lease=lease-1',
    );
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-15T12:00:00Z'));
    const overview = await render().finally(() => vi.useRealTimers());
    expect(overview).toContain('$1,425.00');
    expect(overview).toContain('Oct 3, 2026');
  });

  it('shows payment-only history and credit on an ended lease without inventing charges', async () => {
    fixture.lease.status = 'ENDED';
    fixture.lease.payments = [
      {
        id: 'p-only',
        leaseId: 'lease-1',
        amount: '100.00',
        status: 'SUCCEEDED',
        paidAt: day('2025-06-01'),
        createdAt: day('2025-06-01'),
        providerReference: 'manual:lease-1:2025-06-01',
      },
    ];
    const html = await render({ tab: 'payments' });
    expect(html).toContain('Credit on account');
    expect(html).toContain('No charges on this lease · $100.00 credit.');
    expect(html).toContain('Payment history (1 payment)');
    expect(html).toMatch(/<details[^>]* open=""/);
    expect(html).toContain('Jun 1, 2025 · Cash or check (recorded manually)');
    expect(html).toContain('$100.00 credit');
    expect(html).not.toContain('No charges due yet.');
    // An ended lease cannot take a new payment from here.
    expect(html).not.toContain('record=1');
  });
});
