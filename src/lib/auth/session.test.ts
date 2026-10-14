import { describe, expect, it } from 'vitest';
import { createSessionToken, verifySessionToken, type SessionIdentity } from './session';

const secret = 'test-session-secret-that-is-long-enough-to-use';
const identity: SessionIdentity = {
  subjectId: 'tenant-1',
  organizationId: 'org-1',
  authVersion: 50,
  email: 'alex@example.com',
  name: 'Alex Rivera',
  role: 'TENANT',
  tenantId: 'tenant-1',
};

describe('signed authentication sessions', () => {
  it('round trips an identity with a signed expiration', async () => {
    const token = await createSessionToken(identity, { secret, nowSeconds: 100 });
    await expect(verifySessionToken(token, { secret, nowSeconds: 101 })).resolves.toMatchObject({
      ...identity,
      issuedAt: 100,
      expiresAt: 100 + 60 * 60 * 8,
    });
  });

  it('rejects a changed token and an expired token', async () => {
    const token = await createSessionToken(identity, { secret, nowSeconds: 100 });
    const [payload, signature] = token.split('.');
    const changedPayload = `${payload[0] === 'a' ? 'b' : 'a'}${payload.slice(1)}`;
    const changedToken = `${changedPayload}.${signature}`;
    await expect(verifySessionToken(changedToken, { secret, nowSeconds: 101 })).resolves.toBeNull();
    await expect(
      verifySessionToken(token, { secret, nowSeconds: 100 + 60 * 60 * 8 }),
    ).resolves.toBeNull();
  });
});
