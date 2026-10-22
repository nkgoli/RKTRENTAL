import { describe, expect, it } from 'vitest';
import {
  createInvitationInput,
  createInvitationToken,
  invitationLink,
  invitationOrigin,
  invitationStatus,
  tokenHash,
} from '@/lib/applications/invitation-policy';

const env = {
  APPLICATIONS_INVITATION_SECRET: 'test-only-key-for-application-invitations-32',
  APPLICATIONS_PUBLIC_ORIGIN: 'https://rent.example.test',
};
describe('invitation link boundaries', () => {
  it('generates opaque unique tokens, stores only hash and authenticated ciphertext', () => {
    const a = createInvitationToken(env),
      b = createInvitationToken(env);
    const link = invitationLink(a.tokenCipher, env);
    const token = link.split('/').pop()!;
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(tokenHash(token)).toBe(a.tokenHash);
    expect(a.tokenHash).not.toBe(b.tokenHash);
    expect(a.tokenCipher).not.toContain(token);
    expect(() =>
      invitationLink(a.tokenCipher, {
        ...env,
        APPLICATIONS_INVITATION_SECRET: 'different-test-only-secret-with-at-least-32',
      }),
    ).toThrow('cannot be recovered');
  });
  it.each([
    '',
    'https://user:pass@example.test',
    'https://example.test/path',
    'https://example.test/?next=evil',
    'https://example.test/#x',
    'http://example.test',
    'javascript:alert(1)',
  ])('rejects untrusted origin configuration %s', (origin) => {
    expect(() => invitationOrigin({ ...env, APPLICATIONS_PUBLIC_ORIGIN: origin })).toThrow();
  });
  it('permits HTTP only for explicit loopback sandbox configuration', () => {
    const local = {
      ...env,
      APPLICATIONS_PUBLIC_ORIGIN: 'http://127.0.0.1:3297',
      ROCKETRENTAL_SANDBOX: 'true',
    };
    expect(invitationOrigin(local)).toBe(local.APPLICATIONS_PUBLIC_ORIGIN);
    expect(() => invitationOrigin({ ...local, ROCKETRENTAL_SANDBOX: 'false' })).toThrow();
    expect(() =>
      createInvitationToken({ ...env, APPLICATIONS_INVITATION_SECRET: 'short' }),
    ).toThrow();
  });
  it('requires one valid email and no unrecognized scope/consent fields', () => {
    const input = {
      fullName: ' Jordan Lee ',
      email: 'JORDAN@EXAMPLE.TEST',
      propertyId: 'p',
      unitId: 'u',
      requestKey: '8ce81d33-9896-467d-b48a-a45b351c9dde',
    };
    expect(createInvitationInput.parse(input)).toMatchObject({
      fullName: 'Jordan Lee',
      email: 'jordan@example.test',
    });
    for (const email of ['a@example.test,b@example.test', 'x\r\nBcc:y@example.test', 'a@localhost'])
      expect(createInvitationInput.safeParse({ ...input, email }).success).toBe(false);
    expect(createInvitationInput.safeParse({ ...input, organizationId: 'other' }).success).toBe(
      false,
    );
  });
  it('keeps invitation, draft, expiry and submission distinct', () => {
    const row = { submittedAt: null, draftSavedAt: null, expiresAt: new Date('2030-01-01') };
    expect(invitationStatus(row, new Date('2029-01-01'))).toBe('Awaiting applicant');
    expect(invitationStatus({ ...row, draftSavedAt: new Date() }, new Date('2029-01-01'))).toBe(
      'Draft saved',
    );
    expect(invitationStatus(row, new Date('2031-01-01'))).toBe('Expired');
    expect(invitationStatus({ ...row, submittedAt: new Date() }, new Date('2031-01-01'))).toBe(
      'Submitted',
    );
  });
});
