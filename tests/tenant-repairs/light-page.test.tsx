import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock('@/lib/auth/access', () => ({
  requireTenantRole: async () => ({ tenantId: 'own', subjectId: 'self' }),
}));
vi.mock('@/app/(tenant)/repairs/data', () => ({ loadTenantRepairs: mocks.load }));
vi.mock('@/app/(tenant)/repairs/actions', () => ({ commentRepairAction: async () => {} }));
import Page from '@/app/(tenant)/repairs/page';
const request = (id: string, tenantId: string, status: string) => ({
  id,
  tenantId,
  status,
  title: `Repair ${id}`,
  description:
    'Category: Plumbing\nEntry permission: Vendor may enter with manager key\n\nLeaking tap',
  createdAt: new Date('2026-10-08'),
  completedAt: null,
  vendorName: 'Live vendor',
  photos: [
    { id: 'p1', document: { id: 'own-photo', name: 'tap.jpg', leaseId: 'own-lease' } },
    { id: 'p2', document: { id: 'unit-photo', name: 'unit.jpg', leaseId: null } },
    { id: 'p3', document: { id: 'forbidden-photo', name: 'private.jpg', leaseId: 'other-lease' } },
  ],
  events: [
    {
      id: 'event',
      kind: 'COMMENT',
      actorId: 'self',
      body: 'I will be home',
      createdAt: new Date('2026-10-09'),
    },
  ],
});
beforeEach(() =>
  mocks.load.mockResolvedValue({
    leaseId: 'own-lease',
    propertyName: 'Live House',
    unitLabel: 'Unit 7',
    requests: [request('one', 'own', 'IN_PROGRESS'), request('two', 'other', 'CANCELLED')],
  }),
);
it('renders live history, tenant-only comments and authorized photo routes', async () => {
  const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
  for (const text of [
    'Live House',
    'Live vendor',
    'Your requests (2)',
    'I will be home',
    'Comment on Repair one',
    '/api/files/own-photo/preview',
    '/lease/photos/unit-photo',
  ])
    expect(html).toContain(text);
  expect(html).not.toContain('forbidden-photo');
  expect(html).not.toContain('Comment on Repair two');
  expect(html.match(/role="progressbar"/g)).toHaveLength(1);
  expect(html).toContain('Tenant portal / Repairs');
  expect(html).not.toContain('Design reference');
});
it('renders no-lease and empty history recovery', async () => {
  mocks.load.mockResolvedValue(null);
  let html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
  expect(html).toContain('No active lease');
  expect(html).toContain('Check again');
  expect(html).not.toContain('multipart/form-data');
  mocks.load.mockResolvedValue({
    leaseId: 'own',
    propertyName: 'House',
    unitLabel: null,
    requests: [],
  });
  html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({}) }));
  expect(html).toContain('No repair requests yet.');
});
it.each([
  'submitted',
  'commented',
  'comment-failed',
  'invalid',
  'too-many-photos',
  'bad-photo',
  'photo-failed',
  'no-lease',
])('renders source feedback: %s', async (notice) => {
  const html = renderToStaticMarkup(await Page({ searchParams: Promise.resolve({ notice }) }));
  expect(html).toContain(
    ['comment-failed', 'invalid', 'too-many-photos', 'bad-photo'].includes(notice)
      ? 'role="alert"'
      : 'role="status"',
  );
});
