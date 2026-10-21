import { beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authenticate: vi.fn(),
  setCookie: vi.fn(),
  createToken: vi.fn(),
  redirect: vi.fn((href: string): never => {
    throw new Error(`redirect:${href}`);
  }),
}));

vi.mock('@/lib/auth/credentials', () => ({ authenticateCredentials: mocks.authenticate }));
vi.mock('next/headers', () => ({ cookies: async () => ({ set: mocks.setCookie }) }));
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }));
vi.mock('@/lib/auth/session', () => ({
  createSessionToken: mocks.createToken,
  SESSION_COOKIE: 'rr_session',
  SESSION_TTL_SECONDS: 28_800,
  sessionCookieSecure: () => true,
}));

import { signInAction } from '@/app/(auth)/sign-in/actions';

beforeEach(() => vi.resetAllMocks());

function credentials(email: string, password: string, next = '/home') {
  const data = new FormData();
  data.set('email', email);
  data.set('password', password);
  data.set('next', next);
  return data;
}

it('returns safe failed-action state that preserves only the email', async () => {
  mocks.authenticate.mockResolvedValue(null);
  const state = await signInAction(
    { email: '', attempt: 0 },
    credentials(' alex@example.com ', 'wrong'),
  );
  expect(state).toEqual({ email: 'alex@example.com', attempt: 1, message: expect.any(String) });
  expect(JSON.stringify(state)).not.toContain('wrong');
  expect(mocks.setCookie).not.toHaveBeenCalled();
  expect(mocks.redirect).not.toHaveBeenCalled();
});

it('validates missing and malformed fields on the server without authenticating', async () => {
  const state = await signInAction({ email: '', attempt: 0 }, credentials('invalid', ''));
  expect(state.errors).toEqual({
    email: 'Enter a valid email address.',
    password: 'Enter your password.',
  });
  expect(mocks.authenticate).not.toHaveBeenCalled();
});

it('sets the secure session and preserves a permitted destination after successful authentication', async () => {
  mocks.authenticate.mockResolvedValue({ role: 'TENANT', subjectId: 'tenant-1' });
  mocks.createToken.mockResolvedValue('signed-session');
  mocks.redirect.mockImplementation((href: string): never => {
    throw new Error(`redirect:${href}`);
  });
  await expect(
    signInAction({ email: '', attempt: 0 }, credentials('alex@example.com', 'correct', '/lease')),
  ).rejects.toThrow('redirect:/lease');
  expect(mocks.setCookie).toHaveBeenCalledWith(
    'rr_session',
    'signed-session',
    expect.objectContaining({
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
    }),
  );
});
