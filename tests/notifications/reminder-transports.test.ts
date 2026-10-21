import { describe, expect, it, vi } from 'vitest';
import type { PrismaClient } from '@prisma/client';
import { validEmail } from '@/lib/notifications/reminder-content';
import {
  boundedSend,
  reminderTransport,
  SmtpReminderTransport,
  TwilioReminderTransport,
} from '@/lib/notifications/reminder-transport';

const message = {
  id: 'synthetic-attempt',
  recipient: 'synthetic@example.invalid',
  subject: 'Reminder',
  body: 'Synthetic content',
};
describe('mocked reminder transport contracts', () => {
  it('accepts only one bare mailbox and rejects address-list/header injection', () => {
    expect(validEmail('tenant+test@example.invalid')).toBe(true);
    for (const value of [
      'a@example.invalid,b@example.invalid',
      'a@example.invalid; b@example.invalid',
      'Display <a@example.invalid>',
      'a@example.invalid\r\nBcc:b@example.invalid',
      'a..b@example.invalid',
    ])
      expect(validEmail(value)).toBe(false);
  });
  it('submits a single plain-text SMTP message with a stable Message-ID and records acceptance only', async () => {
    const sendMail = vi.fn(async () => ({
      accepted: [message.recipient],
      messageId: '<synthetic-id>',
    }));
    const smtp = new SmtpReminderTransport(
      { sendMail } as unknown as ConstructorParameters<typeof SmtpReminderTransport>[0],
      'manager@example.invalid',
    );
    expect(await smtp.send(message)).toEqual({ status: 'ACCEPTED', providerId: '<synthetic-id>' });
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: message.recipient,
        text: message.body,
        messageId: '<reminder-synthetic-attempt@example.invalid>',
        disableFileAccess: true,
        disableUrlAccess: true,
      }),
    );
  });

  it('distinguishes SMTP rejection from uncertain transport timeouts', async () => {
    for (const [error, status] of [
      [{ responseCode: 550 }, 'FAILED'],
      [{ code: 'ETIMEDOUT' }, 'UNCERTAIN'],
      [{ code: 'EAUTH' }, 'FAILED'],
    ] as const) {
      const smtp = new SmtpReminderTransport(
        { sendMail: vi.fn().mockRejectedValue(error) },
        'manager@example.invalid',
      );
      expect((await smtp.send(message)).status).toBe(status);
    }
  });

  it('creates Twilio SMS with a signed-callback correlation URL and reconciles delivery separately', async () => {
    const create = vi.fn(async () => ({ sid: `SM${'1'.repeat(32)}`, status: 'queued' }));
    const fetch = vi.fn(async () => ({ sid: `SM${'1'.repeat(32)}`, status: 'delivered' }));
    const messages = Object.assign(
      vi.fn(() => ({ fetch })),
      { create },
    );
    const sms = new TwilioReminderTransport(
      { messages } as unknown as ConstructorParameters<typeof TwilioReminderTransport>[0],
      '+15005550006',
      'https://example.invalid/api/webhooks/notifications/twilio',
    );
    expect((await sms.send({ ...message, recipient: '+15005550007' })).status).toBe('ACCEPTED');
    expect(create).toHaveBeenCalledWith({
      to: '+15005550007',
      from: '+15005550006',
      body: message.body,
      statusCallback:
        'https://example.invalid/api/webhooks/notifications/twilio?attemptId=synthetic-attempt',
    });
    expect((await sms.reconcile(`SM${'1'.repeat(32)}`)).status).toBe('DELIVERED');
    expect(fetch).toHaveBeenCalledOnce();
  });

  it('does not classify a Twilio server timeout as a failed or delivered message', async () => {
    const messages = { create: vi.fn().mockRejectedValue({ status: 504 }) };
    const sms = new TwilioReminderTransport(
      { messages } as unknown as ConstructorParameters<typeof TwilioReminderTransport>[0],
      '+15005550006',
      'https://example.invalid/callback',
    );
    expect(await sms.send(message)).toMatchObject({ status: 'UNCERTAIN' });
    messages.create.mockRejectedValue({ status: 400 });
    expect(await sms.send(message)).toMatchObject({ status: 'FAILED' });
    messages.create.mockRejectedValue({ status: 400, code: 21610 });
    expect(await sms.send(message)).toMatchObject({ status: 'FAILED', errorCode: 'SMS_OPTED_OUT' });
  });

  it('bounds hung sends without retries and catches unknown outcomes', async () => {
    const send = vi.fn(() => new Promise<never>(() => {}));
    expect(await boundedSend({ name: 'mock-hung', send }, message, 5)).toEqual({
      status: 'UNCERTAIN',
      errorCode: 'PROVIDER_TIMEOUT',
    });
    expect(send).toHaveBeenCalledOnce();
    expect(
      (
        await boundedSend(
          {
            name: 'broken',
            send: async () => {
              throw new Error('sensitive provider text');
            },
          },
          message,
        )
      ).status,
    ).toBe('UNCERTAIN');
  });

  it('fails closed with absent configuration and records mock only in sandbox', async () => {
    const findMany = vi.fn(async () => []);
    const client = { providerConnection: { findMany } } as unknown as PrismaClient;
    await expect(reminderTransport('org-a', 'EMAIL', client, {})).rejects.toMatchObject({
      code: 'TRANSPORT_UNCONFIGURED',
    });
    const mock = await reminderTransport('org-a', 'SMS', client, { ROCKETRENTAL_SANDBOX: 'true' });
    expect(await mock.send(message)).toEqual({ status: 'MOCK_RECORDED' });
    expect(findMany).toHaveBeenLastCalledWith({ where: { organizationId: 'org-a', kind: 'SMS' } });
    const live = {
      providerConnection: {
        findMany: async () => [
          {
            provider: 'twilio',
            status: 'CONNECTED',
            settings: { credentialPrefix: 'RR_REMINDER_TEST' },
          },
        ],
      },
    } as unknown as PrismaClient;
    await expect(
      reminderTransport('org-a', 'SMS', live, { ROCKETRENTAL_SANDBOX: 'true' }),
    ).rejects.toMatchObject({ code: 'SANDBOX_LIVE_PROVIDER_BLOCKED' });
    await expect(
      reminderTransport('org-a', 'SMS', live, { REMINDERS_LIVE_ENABLED: 'true' }),
    ).rejects.toMatchObject({ code: 'TRANSPORT_UNCONFIGURED' });
  });
});
