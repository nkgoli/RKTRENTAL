import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  after: vi.fn(),
  send: vi.fn(),
  reset: vi.fn(),
  removeCookie: vi.fn(),
  redirect: vi.fn((href: string): never => {
    throw new Error(`redirect:${href}`);
  }),
  headers: vi.fn(),
}));
vi.mock('next/server', () => ({ after: mocks.after }));
vi.mock('next/headers', () => ({
  headers: mocks.headers,
  cookies: async () => ({ delete: mocks.removeCookie }),
}));
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }));
vi.mock('@/lib/auth/recovery', async (original) => ({
  ...(await original<typeof import('@/lib/auth/recovery')>()),
  sendPasswordRecovery: mocks.send,
  resetPassword: mocks.reset,
}));
import { requestRecoveryAction, resetPasswordAction } from '@/app/(auth)/recover/actions';

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('ROCKETRENTAL_AUTH_SECRET', 'test-reset-secret-at-least-thirty-two-characters');
  vi.stubEnv('ROCKETRENTAL_SANDBOX', 'true');
  vi.stubEnv('ROCKETRENTAL_APP_URL', 'http://localhost:3100');
  mocks.headers.mockResolvedValue(
    new Headers({ origin: 'http://localhost:3100', 'x-real-ip': 'test-ip' }),
  );
});
afterEach(() => vi.unstubAllEnvs());

function requestData(email: string) {
  const data = new FormData();
  data.set('email', email);
  return data;
}
function passwordData(password = 'long-new-password', confirmation = password) {
  const data = new FormData();
  data.set('token', 'private-reset-token');
  data.set('password', password);
  data.set('confirmation', confirmation);
  return data;
}

it('responds before any account lookup or email delivery and supplies no token to the browser', async () => {
  const state = await requestRecoveryAction(
    { email: '', attempt: 0 },
    requestData('alex@example.com'),
  );
  expect(state).toEqual({ email: 'alex@example.com', sent: true, attempt: 1 });
  expect(mocks.send).not.toHaveBeenCalled();
  expect(mocks.after).toHaveBeenCalledTimes(1);
  await mocks.after.mock.calls[0][0]();
  expect(mocks.send).toHaveBeenCalledWith('alex@example.com', 'http://localhost:3100');
});

it('fails closed when the installed email transport is disabled', async () => {
  vi.stubEnv('ROCKETRENTAL_SANDBOX', 'false');
  const state = await requestRecoveryAction(
    { email: '', attempt: 0 },
    requestData('alex@example.com'),
  );
  expect(state.sent).toBeUndefined();
  expect(state.error).toContain('temporarily unavailable');
  expect(mocks.after).not.toHaveBeenCalled();
});

it('never logs a failed provider exception containing reset credentials', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  mocks.send.mockRejectedValueOnce(new Error('private-reset-token'));
  await requestRecoveryAction({ email: '', attempt: 0 }, requestData('alex@example.com'));
  await mocks.after.mock.calls[0][0]();
  expect(warn).toHaveBeenCalledWith('Password recovery delivery unavailable');
  warn.mockRestore();
});

it('does not change a password for mismatched confirmation and never returns password values', async () => {
  const state = await resetPasswordAction(
    { attempt: 0 },
    passwordData('long-new-password', 'mismatched-password'),
  );
  expect(state.errors?.confirmation).toBe('The passwords do not match.');
  expect(JSON.stringify(state)).not.toContain('long-new-password');
  expect(mocks.reset).not.toHaveBeenCalled();
});

it('clears the browser session and redirects only after the atomic password change succeeds', async () => {
  mocks.reset.mockResolvedValueOnce(true);
  await expect(resetPasswordAction({ attempt: 0 }, passwordData())).rejects.toThrow(
    'redirect:/sign-in?reset=1',
  );
  expect(mocks.removeCookie).toHaveBeenCalledWith('rr_session');
  mocks.removeCookie.mockClear();
  mocks.reset.mockResolvedValueOnce(false);
  const state = await resetPasswordAction({ attempt: 0 }, passwordData());
  expect(state.error).toContain('expired or has already been used');
  expect(mocks.removeCookie).not.toHaveBeenCalled();
});
