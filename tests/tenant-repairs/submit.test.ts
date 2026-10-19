import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  lease: vi.fn(),
  create: vi.fn(),
  photo: vi.fn(),
}));
vi.mock('@/lib/auth/server-session', () => ({ getSession: mocks.session }));
vi.mock('@/lib/tenant-portal', () => ({ findTenantLeaseForPortal: mocks.lease }));
vi.mock('@/lib/maintenance', () => ({
  createRequestAsTenant: mocks.create,
  addRequestPhoto: mocks.photo,
  MaintenanceError: class MaintenanceError extends Error {},
}));
import { MaintenanceError } from '@/lib/maintenance';
import { POST } from '@/app/(tenant)/repairs/submit/route';
beforeEach(() => {
  vi.resetAllMocks();
  mocks.session.mockResolvedValue({ role: 'TENANT', tenantId: 'own' });
  mocks.lease.mockResolvedValue({ unitId: 'own-unit' });
  mocks.create.mockResolvedValue({ id: 'created' });
});
const image = () => new File(['image'], 'tap.png', { type: 'image/png' });
async function post(patch: Record<string, string | File[]> = {}) {
  const form = new FormData();
  for (const [key, value] of Object.entries({
    category: 'Plumbing',
    entry: 'home',
    urgency: 'HIGH',
    description: 'Sink leaking',
    ...patch,
  })) {
    if (Array.isArray(value)) for (const file of value) form.append(key, file);
    else form.set(key, value);
  }
  return POST(new Request('http://localhost/repairs/submit', { method: 'POST', body: form }));
}
it('requires a tenant session and scopes the request to the active lease unit', async () => {
  mocks.session.mockResolvedValue(null);
  expect((await post()).headers.get('Location')).toBe('/sign-in');
  expect(mocks.create).not.toHaveBeenCalled();
  mocks.session.mockResolvedValue({ role: 'TENANT' });
  expect((await post()).headers.get('Location')).toContain('submitted');
  expect(mocks.create.mock.calls[0][1]).toMatchObject({ unitId: 'own-unit', priority: 'HIGH' });
  expect(mocks.create.mock.calls[0][1].description).toContain('Entry permission:');
});
it.each([
  ['category', 'Invalid'],
  ['entry', 'invalid'],
  ['urgency', 'invalid'],
  ['description', '   '],
])('rejects invalid %s', async (key, value) => {
  expect((await post({ [key]: value })).headers.get('Location')).toContain('notice=invalid');
  expect(mocks.create).not.toHaveBeenCalled();
});
it('rejects missing lease, excessive count and non-image files before mutation', async () => {
  mocks.lease.mockResolvedValue(null);
  expect((await post()).headers.get('Location')).toContain('no-lease');
  expect(
    (await post({ photos: Array.from({ length: 6 }, image) })).headers.get('Location'),
  ).toContain('too-many-photos');
  expect(
    (await post({ photos: [new File(['x'], 'x.txt', { type: 'text/plain' })] })).headers.get(
      'Location',
    ),
  ).toContain('bad-photo');
  expect(mocks.create).not.toHaveBeenCalled();
});
it('preserves a created request and prior photo when a later upload fails', async () => {
  mocks.photo
    .mockResolvedValueOnce({})
    .mockRejectedValueOnce(new MaintenanceError('Upload failed'));
  const response = await post({ photos: [image(), image(), image()] });
  expect(response.status).toBe(303);
  expect(response.headers.get('Location')).toContain('photo-failed');
  expect(mocks.create).toHaveBeenCalledTimes(1);
  expect(mocks.photo).toHaveBeenCalledTimes(2);
});
