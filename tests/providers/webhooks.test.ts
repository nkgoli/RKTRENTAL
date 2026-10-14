import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  receiveWebhook,
  verifyWebhook,
  type ParsedWebhook,
  type WebhookStore,
} from '../../src/lib/providers/webhooks';

const secret = 'dev-webhook-secret';
const now = Date.parse('2026-10-14T12:00:00.000Z');
const timestamp = Math.floor(now / 1000);
const sign = (body: string, time = timestamp) =>
  `t=${time},v1=${createHmac('sha256', secret).update(`${time}.${body}`).digest('hex')}`;

describe('webhook verification', () => {
  const mockBody = JSON.stringify({
    id: 'evt_1',
    type: 'payment.succeeded',
    organizationId: 'org-1',
  });
  it('verifies raw bytes, timestamp and event fields', () => {
    expect(verifyWebhook('mock', mockBody, sign(mockBody), secret, now).externalEventId).toBe(
      'evt_1',
    );
    expect(() => verifyWebhook('mock', mockBody + ' ', sign(mockBody), secret, now)).toThrow(
      'signature',
    );
    expect(() =>
      verifyWebhook('mock', mockBody, sign(mockBody, timestamp - 301), secret, now),
    ).toThrow('timestamp');
  });

  it('extracts organization metadata from verified Stripe events', () => {
    const body = JSON.stringify({
      id: 'evt_2',
      type: 'payment_intent.succeeded',
      data: { object: { metadata: { organizationId: 'org-2' } } },
    });
    expect(verifyWebhook('stripe', body, sign(body), secret, now).organizationId).toBe('org-2');
  });

  it('rejects disconnected organizations and stores an event once', async () => {
    const events = new Map<string, ParsedWebhook>();
    const store: WebhookStore = {
      connected: async (org) => org === 'org-1',
      insert: async (event) => {
        const key = `${event.provider}:${event.externalEventId}`;
        if (events.has(key)) return 'duplicate';
        events.set(key, event);
        return 'created';
      },
    };
    expect(await receiveWebhook('mock', mockBody, sign(mockBody), secret, store, now)).toBe(
      'created',
    );
    expect(await receiveWebhook('mock', mockBody, sign(mockBody), secret, store, now)).toBe(
      'duplicate',
    );
    expect(events.size).toBe(1);
    const other = JSON.stringify({
      id: 'evt_3',
      type: 'payment.succeeded',
      organizationId: 'org-2',
    });
    await expect(receiveWebhook('mock', other, sign(other), secret, store, now)).rejects.toThrow(
      'connection',
    );
  });
});
