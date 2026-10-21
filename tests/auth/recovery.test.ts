import { describe, expect, it, vi } from 'vitest';
import {
  createRecoveryToken,
  RECOVERY_TOKEN_TTL_MS,
  verifyRecoveryToken,
} from '@/lib/auth/recovery-token';
import {
  recoveryOrigin,
  resetPassword,
  sendPasswordRecovery,
  type RecoveryStore,
  type RecoveryUser,
} from '@/lib/auth/recovery';
import { hydrateCurrentSession } from '@/lib/auth/server-session';
import type { EmailMessage } from '@/lib/notifications/messages';

vi.mock('@/lib/db/client', () => ({ db: {} }));

const secret = 'test-recovery-secret-long-enough-for-signing';
const now = 1_000_000;
const initial: RecoveryUser = {
  id: 'user-1',
  organizationId: 'org-1',
  email: 'alex@example.com',
  passwordHash: 'stored-hash',
  updatedAt: new Date(now - 10),
};

function memoryStore() {
  let user = { ...initial };
  const store: RecoveryStore = {
    findByEmail: async (email) => (email === user.email ? [{ ...user }] : []),
    findById: async (id, org) =>
      id === user.id && org === user.organizationId ? { ...user } : null,
    replacePassword: vi.fn(async (old, passwordHash, updatedAt) => {
      if (
        user.passwordHash !== old.passwordHash ||
        user.updatedAt.getTime() !== old.updatedAt.getTime()
      )
        return false;
      user = { ...user, passwordHash, updatedAt };
      return true;
    }),
  };
  return { store, current: () => user };
}

describe('password recovery tokens', () => {
  it('expires in 15 minutes and rejects tampering, future tokens, wrong organization and changed credentials', () => {
    const token = createRecoveryToken(initial, { now, secret });
    expect(verifyRecoveryToken(token, initial, { now, secret })).toBe(true);
    expect(verifyRecoveryToken(token, initial, { now: now + RECOVERY_TOKEN_TTL_MS, secret })).toBe(
      false,
    );
    expect(verifyRecoveryToken(token, initial, { now: now - 1, secret })).toBe(false);
    expect(
      verifyRecoveryToken(token, { ...initial, organizationId: 'other' }, { now, secret }),
    ).toBe(false);
    expect(
      verifyRecoveryToken(token, { ...initial, passwordHash: 'changed' }, { now, secret }),
    ).toBe(false);
    expect(
      verifyRecoveryToken(token, { ...initial, updatedAt: new Date(now) }, { now, secret }),
    ).toBe(false);
    const [payload, signature] = token.split('.');
    const changed = Buffer.from(
      JSON.stringify({
        ...JSON.parse(Buffer.from(payload, 'base64url').toString()),
        subjectId: 'other',
      }),
    ).toString('base64url');
    expect(verifyRecoveryToken(`${changed}.${signature}`, initial, { now, secret })).toBe(false);
    expect(
      verifyRecoveryToken(
        `${payload}.${signature[0] === 'a' ? 'b' : 'a'}${signature.slice(1)}`,
        initial,
        { now, secret },
      ),
    ).toBe(false);
    expect(
      verifyRecoveryToken(token, initial, {
        now,
        secret: 'a-different-long-enough-signing-secret',
      }),
    ).toBe(false);
  });

  it('rejects malformed tokens and omits password hashes from the URL payload', () => {
    const token = createRecoveryToken(initial, { now, secret });
    expect(Buffer.from(token.split('.')[0], 'base64url').toString()).not.toContain(
      initial.passwordHash,
    );
    for (const malformed of ['', 'a.b', 'x'.repeat(3000), 'e30.' + 'a'.repeat(43)])
      expect(verifyRecoveryToken(malformed, initial, { now, secret })).toBe(false);
  });
});

describe('password reset consumption', () => {
  it('allows one concurrent reset and rejects replay and every outstanding token', async () => {
    const { store, current } = memoryStore();
    const token = createRecoveryToken(initial, { now, secret });
    const secondToken = createRecoveryToken(initial, { now, secret });
    const options = { store, now, secret, hash: async () => 'new-salted-hash' };
    const results = await Promise.all([
      resetPassword(token, 'new-password-123', options),
      resetPassword(token, 'other-password-456', options),
    ]);
    expect(results.sort()).toEqual([false, true]);
    expect(current().passwordHash).toBe('new-salted-hash');
    expect(await resetPassword(token, 'new-password-789', options)).toBe(false);
    expect(await resetPassword(secondToken, 'new-password-789', options)).toBe(false);
  });

  it('advances the session version even at the same timestamp and revokes existing sessions', async () => {
    const { store, current } = memoryStore();
    const timestamp = initial.updatedAt.getTime();
    const token = createRecoveryToken(initial, { now: timestamp, secret });
    expect(
      await resetPassword(token, 'new-password-123', {
        store,
        now: timestamp,
        secret,
        hash: async () => 'new-hash',
      }),
    ).toBe(true);
    expect(current().updatedAt.getTime()).toBe(timestamp + 1);
    const session = {
      subjectId: initial.id,
      organizationId: initial.organizationId,
      authVersion: timestamp,
      email: initial.email,
      name: 'Alex',
      role: 'MANAGER' as const,
      issuedAt: 1,
      expiresAt: 5000,
    };
    expect(
      hydrateCurrentSession(session, { ...current(), name: 'Alex', role: 'MANAGER', tenant: null }),
    ).toBeNull();
  });

  it('does not hash or write for invalid or expired tokens and rejects weak passwords', async () => {
    const { store } = memoryStore();
    const hash = vi.fn(async () => 'hash');
    const token = createRecoveryToken(initial, { now, secret });
    expect(
      await resetPassword('bad-token', 'long-password-123', { store, now, secret, hash }),
    ).toBe(false);
    expect(
      await resetPassword(token, 'long-password-123', {
        store,
        now: now + RECOVERY_TOKEN_TTL_MS,
        secret,
        hash,
      }),
    ).toBe(false);
    expect(await resetPassword(token, 'short', { store, now, secret, hash })).toBe(false);
    expect(hash).not.toHaveBeenCalled();
    expect(store.replacePassword).not.toHaveBeenCalled();
  });
});

describe('recovery delivery', () => {
  it('only sends to the unique matched account and returns the same public result for unknown and duplicate accounts', async () => {
    const { store } = memoryStore();
    const deliver = vi.fn(async (message: EmailMessage) => Boolean(message));
    const options = { store, now, secret, deliver };
    expect(
      await sendPasswordRecovery(' ALEX@example.com ', 'https://rentals.example', options),
    ).toBeUndefined();
    expect(
      await sendPasswordRecovery('missing@example.com', 'https://rentals.example', options),
    ).toBeUndefined();
    expect(
      await sendPasswordRecovery('alex@example.com', 'https://rentals.example', {
        ...options,
        store: {
          ...store,
          findByEmail: async () => [initial, { ...initial, organizationId: 'other' }],
        },
      }),
    ).toBeUndefined();
    expect(deliver).toHaveBeenCalledTimes(1);
    const message = deliver.mock.calls[0]![0];
    expect(message).toMatchObject({ recipient: initial.email, kind: 'PASSWORD_RESET' });
    expect(message.body).toContain('https://rentals.example/recover/');
    expect(message.body).not.toContain(initial.passwordHash);
  });

  it('does not change credentials when the email provider fails', async () => {
    const { store, current } = memoryStore();
    await expect(
      sendPasswordRecovery(initial.email, 'https://rentals.example', {
        store,
        now,
        secret,
        deliver: async () => {
          throw new Error('Provider unavailable');
        },
      }),
    ).rejects.toThrow('Provider unavailable');
    expect(current()).toEqual(initial);
    expect(store.replacePassword).not.toHaveBeenCalled();
  });

  it('uses a configured canonical origin and rejects hostile host input and insecure deployed origins', () => {
    expect(
      recoveryOrigin('https://attacker.example', {
        ROCKETRENTAL_APP_URL: 'https://rentals.example',
      }),
    ).toBe('https://rentals.example');
    expect(recoveryOrigin('http://localhost:3100', { ROCKETRENTAL_SANDBOX: 'true' })).toBe(
      'http://localhost:3100',
    );
    expect(() =>
      recoveryOrigin('https://attacker.example', { ROCKETRENTAL_SANDBOX: 'true' }),
    ).toThrow();
    expect(() =>
      recoveryOrigin(null, { ROCKETRENTAL_APP_URL: 'http://rentals.example' }),
    ).toThrow();
    expect(() => recoveryOrigin(null, {})).toThrow();
  });
});
