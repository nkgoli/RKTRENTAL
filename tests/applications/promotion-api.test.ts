import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/applications/[id]/promote/route';
import { PromotionError } from '@/lib/applications/promotion';
const mocks = vi.hoisted(() => ({ session: vi.fn(), promote: vi.fn(), revalidate: vi.fn() }));
vi.mock('@/lib/auth/server-session', () => ({ getSession: mocks.session }));
vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidate }));
vi.mock('@/lib/applications/promotion', async (original) => ({
  ...(await original<typeof import('@/lib/applications/promotion')>()),
  promoteApplication: mocks.promote,
}));
const request = (origin = 'https://example.test', body: unknown = {}) =>
  new NextRequest('https://example.test/api/applications/app/promote', {
    method: 'POST',
    headers: { origin, host: 'example.test', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
const context = { params: Promise.resolve({ id: 'app' }) };
beforeEach(() => {
  vi.clearAllMocks();
  mocks.session.mockResolvedValue({ organizationId: 'org', subjectId: 'manager', role: 'MANAGER' });
  mocks.promote.mockResolvedValue({ status: 'promoted', tenantId: 'tenant', reused: false });
});
describe('promotion HTTP boundary', () => {
  it('requires a session before mutation', async () => {
    mocks.session.mockResolvedValue(null);
    expect((await POST(request(), context)).status).toBe(401);
    expect(mocks.promote).not.toHaveBeenCalled();
  });
  it('rejects cross-origin requests', async () => {
    expect((await POST(request('https://foreign.test'), context)).status).toBe(403);
    expect(mocks.promote).not.toHaveBeenCalled();
  });
  it('uses the authenticated actor, disables caching and refreshes affected views', async () => {
    const response = await POST(request(), context);
    expect(mocks.promote).toHaveBeenCalledWith(
      { organizationId: 'org', subjectId: 'manager', role: 'MANAGER' },
      'app',
      {},
    );
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toMatchObject({ tenantId: 'tenant' });
    expect(mocks.revalidate).toHaveBeenCalledWith('/tenants', 'layout');
  });
  it('returns scoped errors without leaking server details', async () => {
    mocks.promote.mockRejectedValue(new PromotionError('Application not found.', 404));
    expect((await POST(request(), context)).status).toBe(404);
    mocks.promote.mockRejectedValue(new Error('sensitive database failure'));
    const response = await POST(request(), context);
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain('sensitive');
  });
});
