import { afterEach, expect, it, vi } from 'vitest';
const findMany = vi.hoisted(() => vi.fn(async () => []));
vi.mock('@/lib/db/client', () => ({ db: { emailDelivery: { findMany } } }));
vi.mock('@/lib/auth/server-session', () => ({
  getSession: async () => ({ organizationId: 'org', role: 'MANAGER' }),
}));
import { GET } from '@/app/api/notifications/outbox/route';
afterEach(() => vi.unstubAllEnvs());

it('excludes password reset bearer links from the organization-wide outbox API', async () => {
  vi.stubEnv('NODE_ENV', 'development');
  const response = await GET();
  expect(response.status).toBe(200);
  expect(findMany).toHaveBeenCalledWith(
    expect.objectContaining({ where: { organizationId: 'org', kind: { not: 'PASSWORD_RESET' } } }),
  );
});
