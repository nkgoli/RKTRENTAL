import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  authenticateCredentials,
  CredentialAttemptLimiter,
} from '../../src/lib/auth/credentials';
import { buildLeaseAccessWhere, buildPropertyAccessWhere, canAccessRole, canWriteAsRole } from '../../src/lib/auth/policy';
import { hydrateCurrentSession } from '../../src/lib/auth/server-session';
import {
  createSessionToken,
  sessionCookieSecure,
  verifySessionToken,
  type SessionIdentity,
} from '../../src/lib/auth/session';

vi.mock('../../src/lib/db/client', () => ({ db: {} }));

const secret = 'test-session-secret-long-enough-for-hmac-signing';

describe('OWNER access policies', () => {
  it('scopes owners to owned properties and keeps their role read-only', () => {
    expect(
      buildPropertyAccessWhere({ role: 'OWNER', organizationId: 'org-1', subjectId: 'owner-1' }),
    ).toEqual({ organizationId: 'org-1', ownerId: 'owner-1' });
    expect(
      buildLeaseAccessWhere(
        { role: 'OWNER', organizationId: 'org-1', subjectId: 'owner-1' },
        'lease-1',
      ),
    ).toEqual({
      id: 'lease-1',
      organizationId: 'org-1',
      unit: { property: { ownerId: 'owner-1', organizationId: 'org-1' } },
    });
    expect(buildPropertyAccessWhere({ role: 'MANAGER', organizationId: 'org-1', subjectId: 'mgr' })).toEqual({
      organizationId: 'org-1',
    });
    expect(canWriteAsRole('OWNER')).toBe(false);
    expect(canWriteAsRole('MANAGER')).toBe(true);
    expect(canAccessRole('OWNER', 'MANAGER')).toBe(false);
  });
});

describe('credential timing and lockout', () => {
  it('runs password verification once for both known and unknown email addresses', async () => {
    const limiter = new CredentialAttemptLimiter();
    const verify = vi.fn(async (password: string, hash: string | null) => password === hash);
    const findUsers = vi.fn(async (email: string) =>
      email === 'known@example.com'
        ? [
            {
              id: 'user-1',
              organizationId: 'org-1',
              email,
              name: 'Manager',
              role: 'MANAGER' as const,
              passwordHash: null,
              updatedAt: new Date(10),
              tenant: null,
            },
          ]
        : [],
    );

    await authenticateCredentials('known@example.com', 'wrong', {
      limiter,
      now: 100,
      remoteAddress: 'ip-1',
      findUsers,
      verify,
    });
    const knownHash = verify.mock.calls[0]![1];
    await authenticateCredentials('missing@example.com', 'wrong', {
      limiter,
      now: 100,
      remoteAddress: 'ip-2',
      findUsers,
      verify,
    });
    const unknownHash = verify.mock.calls[1]![1];
    expect(knownHash).toMatch(/^scrypt\$16384\$8\$1\$/);
    expect(unknownHash).toMatch(/^scrypt\$16384\$8\$1\$/);
    expect(knownHash).toBe(unknownHash);
  });

  it('locks out repeated failures by email and by IP', async () => {
    const byEmail = new CredentialAttemptLimiter();
    const verifyEmail = vi.fn(async () => false);
    for (let i = 0; i < 5; i += 1)
      await authenticateCredentials('locked@example.com', 'bad-password', {
        limiter: byEmail,
        now: 1000,
        remoteAddress: `ip-${i}`,
        findUsers: async () => [],
        verify: verifyEmail,
      });
    await authenticateCredentials('locked@example.com', 'bad-password', {
      limiter: byEmail,
      now: 1000,
      remoteAddress: 'another-ip',
      findUsers: async () => [],
      verify: verifyEmail,
    });
    expect(verifyEmail).toHaveBeenCalledTimes(5);

    const byIp = new CredentialAttemptLimiter();
    const verifyIp = vi.fn(async () => false);
    for (let i = 0; i < 5; i += 1)
      await authenticateCredentials(`user-${i}@example.com`, 'bad-password', {
        limiter: byIp,
        now: 2000,
        remoteAddress: 'shared-ip',
        findUsers: async () => [],
        verify: verifyIp,
      });
    await authenticateCredentials('new-user@example.com', 'bad-password', {
      limiter: byIp,
      now: 2000,
      remoteAddress: 'shared-ip',
      findUsers: async () => [],
      verify: verifyIp,
    });
    expect(verifyIp).toHaveBeenCalledTimes(5);
  });

  it('returns the user update version needed for server-side revocation', async () => {
    const user = {
      id: 'user-1',
      organizationId: 'org-1',
      email: 'owner@example.com',
      name: 'Owner',
      role: 'OWNER' as const,
      passwordHash: 'stored-hash',
      updatedAt: new Date(1234),
      tenant: null,
    };
    const session = await authenticateCredentials('owner@example.com', 'password', {
      limiter: new CredentialAttemptLimiter(),
      now: 9999,
      remoteAddress: 'ip-1',
      findUsers: async () => [user],
      verify: async () => true,
    });
    expect(session).toMatchObject({ subjectId: 'user-1', role: 'OWNER', authVersion: 1234 });
  });
});

describe('database-reconciled sessions', () => {
  const identity: SessionIdentity = {
    subjectId: 'user-1',
    organizationId: 'org-1',
    authVersion: 100,
    email: 'old@example.com',
    name: 'Old Name',
    role: 'MANAGER',
  };

  it('re-reads the role and profile from the current user row', async () => {
    const token = await createSessionToken(identity, { secret, nowSeconds: 101 });
    const verified = await verifySessionToken(token, { secret, nowSeconds: 102 });
    expect(verified).not.toBeNull();
    const session = hydrateCurrentSession(verified!, {
      id: 'user-1',
      organizationId: 'org-1',
      email: 'current@example.com',
      name: 'Current Name',
      role: 'OWNER',
      updatedAt: new Date(100),
      tenant: null,
    });
    expect(session).toMatchObject({ role: 'OWNER', email: 'current@example.com', name: 'Current Name' });
  });

  it('revokes a token when the database update version changes or the user is removed', async () => {
    const token = await createSessionToken(identity, { secret, nowSeconds: 101 });
    const verified = (await verifySessionToken(token, { secret, nowSeconds: 102 }))!;
    const changedUser = {
      id: 'user-1',
      organizationId: 'org-1',
      email: 'current@example.com',
      name: 'Current Name',
      role: 'MANAGER',
      updatedAt: new Date(200),
      tenant: null,
    };
    expect(hydrateCurrentSession(verified, changedUser)).toBeNull();
    expect(hydrateCurrentSession(verified, null)).toBeNull();
  });
});

describe('session cookie transport', () => {
  it('uses Secure unless local HTTP is explicitly configured', () => {
    expect(sessionCookieSecure({ NODE_ENV: 'development' })).toBe(true);
    expect(sessionCookieSecure({ NODE_ENV: 'production' })).toBe(true);
    expect(sessionCookieSecure({ NODE_ENV: 'development', ROCKETRENTAL_AUTH_COOKIE_SECURE: 'false' })).toBe(false);
  });

  it('uses the shared cookie security policy at the sign-in call site', () => {
    const action = readFileSync(
      path.join(process.cwd(), 'src/app/(auth)/sign-in/actions.ts'),
      'utf8',
    );
    expect(action).toContain('secure: sessionCookieSecure()');
  });
});
