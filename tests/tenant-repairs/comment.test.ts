import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ session: vi.fn(), comment: vi.fn() }));
vi.mock('@/lib/auth/server-session', () => ({ getSession: mocks.session }));
vi.mock('@/lib/maintenance', () => ({
  addRequestComment: mocks.comment,
  MaintenanceError: class MaintenanceError extends Error {},
}));
import { MaintenanceError } from '@/lib/maintenance';
import { POST } from '@/app/(tenant)/repairs/comment/route';
beforeEach(() => {
  vi.resetAllMocks();
  mocks.session.mockResolvedValue({ role: 'TENANT', tenantId: 'own' });
});
async function post() {
  const form = new FormData();
  form.set('requestId', 'own-request');
  form.set('comment', 'I will be home.');
  return POST(new Request('http://localhost/repairs/comment', { method: 'POST', body: form }));
}
it('requires a tenant session before commenting', async () => {
  mocks.session.mockResolvedValue({ role: 'MANAGER' });
  expect((await post()).headers.get('Location')).toBe('/sign-in');
  expect(mocks.comment).not.toHaveBeenCalled();
});
it('uses the authorized maintenance service and redirects to the request feedback', async () => {
  const response = await post();
  expect(response.status).toBe(303);
  expect(response.headers.get('Location')).toBe('/repairs?notice=commented#request-own-request');
  expect(mocks.comment).toHaveBeenCalledWith(
    { role: 'TENANT', tenantId: 'own' },
    'own-request',
    'I will be home.',
  );
});
it('returns service validation and ownership rejection as failed feedback', async () => {
  mocks.comment.mockRejectedValue(new MaintenanceError('Forbidden'));
  expect((await post()).headers.get('Location')).toBe(
    '/repairs?notice=comment-failed#request-own-request',
  );
});
it('does not swallow unexpected failures', async () => {
  mocks.comment.mockRejectedValue(new Error('offline'));
  await expect(post()).rejects.toThrow('offline');
});
