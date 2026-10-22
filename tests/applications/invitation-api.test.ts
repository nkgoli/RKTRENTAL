import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as create } from '@/app/api/applications/invitations/route';
import { POST as manage } from '@/app/api/applications/invitations/[id]/route';
import { POST as submit } from '@/app/api/applications/submit/route';
import { InvitationError } from '@/lib/applications/invitation-policy';
import { middleware } from '@/middleware';

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  create: vi.fn(),
  manage: vi.fn(),
  submit: vi.fn(),
}));
vi.mock('@/lib/auth/server-session', () => ({ getSession: mocks.session }));
vi.mock('@/lib/applications/invitations', () => ({
  createInvitation: mocks.create,
  manageInvitation: mocks.manage,
  completeInvitation: mocks.submit,
}));
function request(path: string, origin = 'https://rental.example.test', body: unknown = {}) {
  return new NextRequest(`https://rental.example.test${path}`, {
    method: 'POST',
    headers: { origin, 'Content-Type': 'application/json', host: 'rental.example.test' },
    body: JSON.stringify(body),
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.session.mockResolvedValue({ role: 'MANAGER', organizationId: 'org', subjectId: 'manager' });
  mocks.create.mockResolvedValue({ id: 'invite' });
  mocks.manage.mockResolvedValue(undefined);
  mocks.submit.mockResolvedValue({ submitted: true });
});
describe('invitation HTTP boundary', () => {
  it('requires a current session for both manager endpoints', async () => {
    mocks.session.mockResolvedValue(null);
    expect((await create(request('/api/applications/invitations'))).status).toBe(401);
    expect(
      (
        await manage(request('/api/applications/invitations/id'), {
          params: Promise.resolve({ id: 'id' }),
        })
      ).status,
    ).toBe(401);
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.manage).not.toHaveBeenCalled();
  });
  it('rejects cross-origin writes including public applicant posts', async () => {
    expect(
      (await create(request('/api/applications/invitations', 'https://evil.example'))).status,
    ).toBe(403);
    expect((await submit(request('/api/applications/submit', 'https://evil.example'))).status).toBe(
      403,
    );
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.submit).not.toHaveBeenCalled();
  });
  it('returns service authorization errors without exposing other invitations', async () => {
    mocks.manage.mockRejectedValue(new InvitationError('Invitation not found.', 404));
    const response = await manage(request('/api/applications/invitations/foreign'), {
      params: Promise.resolve({ id: 'foreign' }),
    });
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Invitation not found.' });
  });
  it('accepts bearer-scoped applicant submission without a manager session and disables caching', async () => {
    mocks.session.mockResolvedValue(null);
    const response = await submit(request('/api/applications/submit'));
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');
  });
  it('disables caching, indexing and referrer propagation on public invitation pages', async () => {
    const response = await middleware(
      new NextRequest('https://rental.example.test/apply/synthetic'),
    );
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');
    expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow');
  });
  it('rejects malformed and oversized JSON before service execution', async () => {
    const invalid = new NextRequest('https://rental.example.test/api/applications/submit', {
      method: 'POST',
      headers: { origin: 'https://rental.example.test', 'Content-Type': 'application/json' },
      body: '{invalid',
    });
    expect((await submit(invalid)).status).toBe(400);
    expect(
      (await submit(request('/api/applications/submit', undefined, { token: 'x'.repeat(9000) })))
        .status,
    ).toBe(413);
    expect(mocks.submit).not.toHaveBeenCalled();
  });
});
