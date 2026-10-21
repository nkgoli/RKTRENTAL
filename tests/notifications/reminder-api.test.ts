import { afterEach, describe, expect, it, vi } from 'vitest';
import twilio from 'twilio';
import { POST as preview } from '@/app/api/payment-reminders/preview/route';
import { POST as dispatch } from '@/app/api/payment-reminders/dispatch/route';
import { POST as webhook } from '@/app/api/webhooks/notifications/twilio/route';
import { PATCH as preferences } from '@/app/api/payment-reminders/preferences/route';
import { PaymentReminders } from '@/lib/notifications/reminders';

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  attempt: vi.fn(),
  connection: vi.fn(),
  tenantUpdate: vi.fn(),
}));
vi.mock('@/lib/auth/server-session', () => ({ getSession: mocks.session }));
vi.mock('@/lib/db/client', () => ({
  db: {
    paymentReminderAttempt: { findUnique: mocks.attempt },
    providerConnection: { findUnique: mocks.connection },
    tenant: { updateMany: mocks.tenantUpdate },
  },
}));

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
const request = (body: unknown, origin = 'https://example.invalid') =>
  new Request('https://example.invalid/api/payment-reminders/preview', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin },
    body: JSON.stringify(body),
  });

describe('reminder API boundaries', () => {
  it('requires a current manager session before processing input', async () => {
    mocks.session.mockResolvedValue(null);
    expect((await preview(request({}))).status).toBe(401);
    for (const role of ['TENANT', 'OWNER', 'ADMIN']) {
      mocks.session.mockResolvedValue({ role });
      expect((await dispatch(request({}))).status).toBe(403);
    }
  });
  it('accepts only lease/channel identifiers, validates JSON and rejects cross-origin requests', async () => {
    mocks.session.mockResolvedValue({
      role: 'MANAGER',
      organizationId: 'org',
      subjectId: 'manager',
    });
    const spy = vi
      .spyOn(PaymentReminders.prototype, 'preview')
      .mockResolvedValue({ id: 'preview' } as never);
    expect(
      (
        await preview(
          request({ leaseId: 'lease', channel: 'EMAIL', recipient: 'injected@example.invalid' }),
        )
      ).status,
    ).toBe(400);
    expect(
      (await preview(request({ leaseId: 'lease', channel: 'EMAIL' }, 'https://attacker.invalid')))
        .status,
    ).toBe(403);
    const result = await preview(request({ leaseId: 'lease', channel: 'EMAIL' }));
    expect(result.status).toBe(200);
    expect(result.headers.get('cache-control')).toBe('no-store');
    expect(spy).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ organizationId: 'org' }),
      'lease',
      'EMAIL',
    );
  });
  it('changes only the authenticated tenant preferences and rejects an injected tenant ID', async () => {
    mocks.session.mockResolvedValue({ role: 'MANAGER' });
    expect((await preferences(request({}))).status).toBe(403);
    mocks.session.mockResolvedValue({
      role: 'TENANT',
      organizationId: 'org',
      subjectId: 'user',
      tenantId: 'own-tenant',
    });
    mocks.tenantUpdate.mockResolvedValue({ count: 1 });
    const flags = { emailRemindersEnabled: false, smsRemindersEnabled: false };
    expect((await preferences(request({ ...flags, tenantId: 'someone-else' }))).status).toBe(400);
    expect((await preferences(request(flags))).status).toBe(200);
    expect(mocks.tenantUpdate).toHaveBeenCalledWith({
      where: { id: 'own-tenant', organizationId: 'org', userId: 'user' },
      data: flags,
    });
  });
});

describe('Twilio signed status callbacks (synthetic, no network)', () => {
  const base = 'https://example.invalid/api/webhooks/notifications/twilio';
  const token = 'synthetic-token-for-validation-only';
  const params = {
    AccountSid: `AC${'0'.repeat(32)}`,
    MessageSid: `SM${'1'.repeat(32)}`,
    From: '+15005550006',
    To: '+15005550007',
    MessageStatus: 'delivered',
  };
  function setup() {
    vi.stubEnv('REMINDERS_TWILIO_CALLBACK_URL', base);
    vi.stubEnv('RR_REMINDER_TEST_TWILIO_AUTH_TOKEN', token);
    vi.stubEnv('RR_REMINDER_TEST_TWILIO_ACCOUNT_SID', params.AccountSid);
    vi.stubEnv('RR_REMINDER_TEST_TWILIO_FROM', params.From);
    mocks.attempt.mockResolvedValue({
      id: 'attempt',
      organizationId: 'org',
      tenantId: 'tenant',
      provider: 'twilio',
      recipient: params.To,
      startedAt: new Date(),
      providerId: null,
    });
    mocks.connection.mockResolvedValue({ settings: { credentialPrefix: 'RR_REMINDER_TEST' } });
    return vi.spyOn(PaymentReminders.prototype, 'applyResult').mockResolvedValue();
  }
  function callback(fields = params, signature?: string) {
    return new Request('http://internal-host/api/webhooks/notifications/twilio?attemptId=attempt', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'x-twilio-signature':
          signature ??
          twilio.getExpectedTwilioSignature(token, `${base}?attemptId=attempt`, fields),
      },
      body: new URLSearchParams(fields),
    });
  }
  it('validates the configured external URL, account, recipient and signature before confirming delivery', async () => {
    const apply = setup();
    expect((await webhook(callback(params, 'forged'))).status).toBe(403);
    expect(apply).not.toHaveBeenCalled();
    expect((await webhook(callback())).status).toBe(204);
    expect(apply).toHaveBeenCalledWith('attempt', {
      providerId: params.MessageSid,
      status: 'DELIVERED',
    });
  });
  it('rejects a validly signed callback with the wrong recipient or provider message ID', async () => {
    const apply = setup();
    expect((await webhook(callback({ ...params, To: '+15005550008' }))).status).toBe(403);
    mocks.attempt.mockResolvedValue({
      id: 'attempt',
      organizationId: 'org',
      provider: 'twilio',
      recipient: params.To,
      startedAt: new Date(),
      providerId: `SM${'2'.repeat(32)}`,
    });
    expect((await webhook(callback())).status).toBe(403);
    expect(apply).not.toHaveBeenCalled();
  });
});
