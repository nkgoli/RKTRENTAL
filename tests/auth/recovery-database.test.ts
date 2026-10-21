import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { afterAll, describe, expect, it } from 'vitest';
import { createRecoveryStore, resetPassword, sendPasswordRecovery } from '@/lib/auth/recovery';
import { createRecoveryToken } from '@/lib/auth/recovery-token';
import { hashPassword, verifyPasswordHash } from '@/lib/auth/password';
import { hydrateCurrentSession } from '@/lib/auth/server-session';
import { MockEmailProvider } from '@/lib/notifications/provider';

const url = process.env.AUTH_RECOVERY_DATABASE_URL;
const organizationId = `auth-recovery-test-${randomUUID()}`;
const secret = 'isolated-test-reset-secret-at-least-32-characters';
const client = url ? new PrismaClient({ datasourceUrl: url }) : null;

describe.runIf(Boolean(url))('password recovery in isolated PostgreSQL fixtures', () => {
  afterAll(async () => {
    if (!client) return;
    await client.organization.deleteMany({ where: { id: organizationId } });
    await client.$disconnect();
  });

  it('delivers to sandbox outbox, consumes the token atomically, rejects replay and revokes sessions', async () => {
    if (!client || !url || !['localhost', '127.0.0.1'].includes(new URL(url).hostname))
      throw new Error('This integration test requires an explicitly configured local database');
    await client.organization.create({
      data: { id: organizationId, name: 'Disposable auth recovery test' },
    });
    const user = await client.user.create({
      data: {
        organizationId,
        email: `recovery-${randomUUID()}@example.test`,
        name: 'Recovery test',
        role: 'MANAGER',
        passwordHash: await hashPassword('original-test-password'),
      },
    });
    const store = createRecoveryStore(client);
    await sendPasswordRecovery(user.email, 'http://localhost:3100', {
      store,
      secret,
      deliver: (message) => new MockEmailProvider(client).send(message),
    });
    const deliveries = await client.emailDelivery.findMany({
      where: { organizationId, kind: 'PASSWORD_RESET' },
    });
    expect(deliveries.length).toBe(1);
    const token = deliveries[0].body.match(/\/recover\/([A-Za-z0-9_.-]+)/)?.[1] ?? '';
    expect(Boolean(token)).toBe(true);
    const otherToken = createRecoveryToken(user, { secret });
    const results = await Promise.all([
      resetPassword(token, 'first-new-test-password', { store, secret }),
      resetPassword(token, 'second-new-test-password', { store, secret }),
    ]);
    expect(results.filter(Boolean).length).toBe(1);
    const changed = await client.user.findUniqueOrThrow({ where: { id: user.id } });
    const winningPassword = results[0] ? 'first-new-test-password' : 'second-new-test-password';
    expect(await verifyPasswordHash(winningPassword, changed.passwordHash)).toBe(true);
    expect(await verifyPasswordHash('original-test-password', changed.passwordHash)).toBe(false);
    expect(changed.updatedAt.getTime() > user.updatedAt.getTime()).toBe(true);
    expect(await resetPassword(token, 'replayed-test-password', { store, secret })).toBe(false);
    expect(await resetPassword(otherToken, 'replayed-test-password', { store, secret })).toBe(
      false,
    );
    const oldSession = {
      subjectId: user.id,
      organizationId,
      authVersion: user.updatedAt.getTime(),
      email: user.email,
      name: user.name,
      role: 'MANAGER' as const,
      issuedAt: 1,
      expiresAt: 2,
    };
    expect(hydrateCurrentSession(oldSession, { ...changed, tenant: null })).toBeNull();
  });
});
