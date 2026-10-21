import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ session: vi.fn(), notifications: vi.fn(), archives: vi.fn() }));
vi.mock('@/lib/auth/server-session', () => ({ getSession: mocks.session }));
vi.mock('@/lib/notifications/service', () => ({ runNotificationSweep: mocks.notifications }));
vi.mock('@/lib/esign/archive', () => ({ runLeaseArchiveSweep: mocks.archives }));
import { POST } from '@/app/api/notifications/run/route';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.notifications.mockResolvedValue({ sent: 0 });
  mocks.archives.mockResolvedValue([{ agreementId: 'pending-version', status: 'ARCHIVED' }]);
});
it('runs due archival through the existing manager job using only the session organization', async () => {
  mocks.session.mockResolvedValue({ role: 'MANAGER', organizationId: 'manager-org' });
  expect(await (await POST()).json()).toEqual({
    sent: 0,
    archives: [{ agreementId: 'pending-version', status: 'ARCHIVED' }],
  });
  expect(mocks.archives).toHaveBeenCalledExactlyOnceWith('manager-org');
});
it.each(['TENANT', 'ADMIN', null])('does not expose the archive sweep to %s', async (role) => {
  mocks.session.mockResolvedValue(role ? { role, organizationId: 'org' } : null);
  expect((await POST()).status).toBe(role ? 403 : 401);
  expect(mocks.archives).not.toHaveBeenCalled();
});
it('does not extend existing owner job access to unrelated property archives', async () => {
  mocks.session.mockResolvedValue({ role: 'OWNER', organizationId: 'owner-org' });
  expect(await (await POST()).json()).toEqual({ sent: 0, archives: [] });
  expect(mocks.archives).not.toHaveBeenCalled();
});
