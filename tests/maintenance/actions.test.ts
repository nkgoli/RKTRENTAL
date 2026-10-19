import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  unit: vi.fn(),
  request: vi.fn(),
  create: vi.fn(),
  photo: vi.fn(),
  assign: vi.fn(),
  status: vi.fn(),
  comment: vi.fn(),
  revalidate: vi.fn(),
}));
vi.mock('@/lib/auth/access', () => ({
  requireManagerRole: vi.fn(async () => ({ organizationId: 'org', role: 'MANAGER' })),
}));
vi.mock('@/lib/db/client', () => ({
  db: { unit: { findFirst: mocks.unit }, maintenanceRequest: { findFirst: mocks.request } },
}));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidate }));
vi.mock('@/lib/maintenance', () => ({
  createRequestAsManager: mocks.create,
  addRequestPhoto: mocks.photo,
  assignVendor: mocks.assign,
  changeRequestStatus: mocks.status,
  addRequestComment: mocks.comment,
  MaintenanceError: class extends Error {},
}));
import { createRequest, updateRequest } from '@/components/maintenance/request-actions';

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.unit.mockResolvedValue({ id: 'u' });
  mocks.request.mockResolvedValue({ propertyId: 'p' });
  mocks.create.mockResolvedValue({ id: 'r', propertyId: 'p' });
  mocks.photo.mockResolvedValue({});
});
describe('maintenance actions in the current scope', () => {
  it('rejects creating in a different unit without creating a request', async () => {
    const result = await createRequest(form({ unitId: 'other' }), 'p', 'u');
    expect(result.error).toContain('current property and unit scope');
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it('checks property ownership before creation', async () => {
    mocks.unit.mockResolvedValue(null);
    expect((await createRequest(form({ unitId: 'u' }), 'p')).error).toBeTruthy();
    expect(mocks.unit).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: 'org', propertyId: 'p', id: 'u' }),
      }),
    );
    expect(mocks.create).not.toHaveBeenCalled();
  });
  it('reports partial photo failure as a created request to prevent duplicate retries', async () => {
    const data = form({ unitId: 'u', title: 'Leak', priority: 'HIGH' });
    data.set('photo', new File(['photo'], 'repair.png', { type: 'image/png' }));
    mocks.photo.mockRejectedValue(new Error('storage unavailable'));
    const result = await createRequest(data, 'p', 'u');
    expect(result.requestId).toBe('r');
    expect(result.requestHref).toBe('/properties/p/maintenance?unit=u#request-r');
    expect(result.error).toBeUndefined();
    expect(result.message).toContain('photo could not be uploaded');
  });
  it('does not mutate requests outside the current property/unit', async () => {
    mocks.request.mockResolvedValue(null);
    const result = await updateRequest(
      'status',
      form({ requestId: 'r', status: 'DONE' }),
      'p',
      'u',
    );
    expect(result.error).toContain('scope');
    expect(mocks.status).not.toHaveBeenCalled();
    expect(mocks.request).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'r', organizationId: 'org', propertyId: 'p', unitId: 'u' },
      }),
    );
  });
  it('refreshes both views without redirecting away from filters', async () => {
    expect(
      await updateRequest('status', form({ requestId: 'r', status: 'IN_PROGRESS' }), 'p', 'u'),
    ).toEqual({ message: 'Status updated.' });
    expect(mocks.status).toHaveBeenCalledWith(expect.anything(), 'r', 'IN_PROGRESS');
    expect(mocks.revalidate.mock.calls.flat()).toEqual([
      '/maintenance',
      '/properties/p',
      '/properties/p/maintenance',
    ]);
  });
  it('requires an attachment before uploading', async () => {
    expect((await updateRequest('photo', form({ requestId: 'r' }))).error).toBe(
      'Choose a photo before uploading.',
    );
    expect(mocks.photo).not.toHaveBeenCalled();
  });
  it('does not expose internal failures', async () => {
    mocks.assign.mockRejectedValue(new Error('private database credentials'));
    const result = await updateRequest('assign', form({ requestId: 'r', vendorId: 'v' }));
    expect(result.error).toContain('Try again');
    expect(result.error).not.toContain('credentials');
  });
});
