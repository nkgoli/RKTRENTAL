import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, expect, it, vi } from 'vitest';

const loaders = vi.hoisted(() => ({ home: vi.fn(), lease: vi.fn() }));
vi.mock('@/lib/auth/access', () => ({ requireTenantRole: async () => ({ tenantId: 'own' }) }));
vi.mock('@/lib/tenant-portal', async (original) => ({
  ...(await original<typeof import('@/lib/tenant-portal')>()),
  loadTenantHome: loaders.home,
  loadTenantLease: loaders.lease,
}));
import Home from '@/app/(tenant)/home/page';
import Lease from '@/app/(tenant)/lease/page';

const term = { start: new Date('2026-01-01'), end: new Date('2026-12-31') };
const home = () => ({
  tenantName: 'Live Tenant',
  premises: 'Live House · Unit 7',
  managerName: 'Live Manager',
  term,
  pay: {
    amountDue: { totalDueCents: 231047, pendingCents: 12345, dueDate: new Date('2026-11-01') },
    autopay: { enabled: false },
  },
  openRepair: {
    title: 'Live repair',
    status: 'ASSIGNED',
    createdAt: new Date('2026-10-01'),
    vendorName: 'Vendor',
  },
  notice: { kind: 'move-out', title: 'Recorded move-out', body: 'Source notice body' },
  activity: [
    { id: 'one', title: 'Pending payment', detail: 'Source ledger detail', tone: 'warning' },
  ],
});
const lease = () => ({
  tenantName: 'Live Tenant',
  managerName: 'Live Manager',
  premises: 'Live House · Unit 7',
  term,
  status: 'ACTIVE',
  monthlyRentCents: 231047,
  depositCents: 120000,
  autopayOn: false,
  coTenants: [],
  occupants: [],
  notice: null,
  photos: [],
  documents: [
    {
      id: 'pdf',
      name: 'Signed live lease.pdf',
      mimeType: 'application/pdf',
      createdAt: term.start,
      sizeBytes: 1200,
      previewUrl: '/api/files/pdf/preview',
      downloadUrl: '/api/files/pdf/download',
    },
    {
      id: 'other',
      name: 'Other document.txt',
      mimeType: 'text/plain',
      createdAt: term.start,
      sizeBytes: 120,
      previewUrl: '/api/files/other/preview',
      downloadUrl: '/api/files/other/download',
    },
  ],
});
beforeEach(() => {
  loaders.home.mockResolvedValue(home());
  loaders.lease.mockResolvedValue(lease());
});

it('renders live balances, pending funds, notices, repair progress and ledger activity', async () => {
  const html = renderToStaticMarkup(await Home());
  for (const text of [
    '$2,310.47',
    '$123.45 bank payment pending',
    'Live Tenant',
    'Recorded move-out',
    'Source notice body',
    'Live repair',
    'Source ledger detail',
  ])
    expect(html).toContain(text);
  for (const href of ['/pay', '/lease', '/repairs', '/lease#documents'])
    expect(html).toContain(`href="${href}"`);
  expect(html).not.toContain('Alex Rivera');
  expect(html).toContain('stroke-width="1.7"');
  expect(html.match(/href="\/pay"/g)).toHaveLength(1);
  expect(html).not.toContain('>Pay rent<');
});
it('renders settled balance and omits absent repair and renewal content', async () => {
  const view = home();
  loaders.home.mockResolvedValue({
    ...view,
    openRepair: null,
    notice: null,
    activity: [],
    pay: {
      ...view.pay,
      amountDue: { totalDueCents: 0, pendingCents: 0 },
      autopay: { enabled: true },
    },
  });
  const html = renderToStaticMarkup(await Home());
  expect(html).toContain('All paid up');
  expect(html).toContain('View payments &amp; receipts');
  expect(html).toContain('Autopay is on.');
  expect(html).toContain('Payments and notices will show up here.');
  expect(html).not.toContain('Open repair request');
  expect(html).not.toContain('Pay now');
});
it('preserves MIME-gated authenticated document links and conditional photo/occupant sections', async () => {
  const html = renderToStaticMarkup(await Lease());
  expect(html).toContain('href="/api/files/pdf/preview"');
  expect(html).toContain('target="_blank" rel="noreferrer"');
  expect(html).not.toContain('href="/api/files/other/preview"');
  expect(html).toContain('href="/api/files/other/download"');
  expect(html).not.toContain('id="photos"');
  expect(html).not.toContain('<dt>Occupants</dt>');
  expect(html).toContain('Live House — Unit 7');
  expect(html).toContain('$2,310.47');
  expect(html).toContain('Your lease');
});
it('retains move-out dates, enabled autopay, empty documents and authenticated photos', async () => {
  loaders.lease.mockResolvedValue({
    ...lease(),
    documents: [],
    occupants: ['Live Tenant', 'Other Occupant'],
    autopayOn: true,
    notice: {
      kind: 'move-out',
      title: 'Move-out soon',
      body: 'Recorded notice',
      noticeGivenAt: term.start,
      moveOutDate: term.end,
    },
    photos: [{ id: 'photo', url: '/lease/photos/photo', caption: 'Live room', name: 'room' }],
  });
  const html = renderToStaticMarkup(await Lease());
  for (const text of [
    'Other Occupant',
    'Notice given',
    'Move-out soon',
    'Recorded notice',
    'Your lease and notices will appear here',
    '/lease/photos/photo',
    'id="photos"',
  ])
    expect(html).toContain(text);
  expect(html).not.toContain('set up in Pay');
});
it('offers route-specific retry for an unassigned tenant', async () => {
  loaders.home.mockResolvedValue(null);
  loaders.lease.mockResolvedValue(null);
  for (const [page, route] of [
    [await Home(), '/home'],
    [await Lease(), '/lease'],
  ] as const) {
    const html = renderToStaticMarkup(page);
    expect(html).toContain('No active lease yet');
    expect(html).toContain(`href="${route}"`);
  }
});
