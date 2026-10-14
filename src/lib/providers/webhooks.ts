import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export type WebhookProvider = 'mock' | 'stripe';
export type ParsedWebhook = {
  provider: WebhookProvider;
  externalEventId: string;
  organizationId: string;
  eventType: string;
  payloadHash: string;
};

function equalHex(a: string, b: string): boolean {
  if (!/^[a-f\d]{64}$/i.test(a) || !/^[a-f\d]{64}$/i.test(b)) return false;
  return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
}

export function verifyWebhook(
  provider: WebhookProvider,
  body: string,
  signature: string | null,
  secret: string,
  now = Date.now(),
): ParsedWebhook {
  if (!secret || !signature) throw new Error('Webhook signature missing');
  const timestamp = signature.match(/(?:^|,)t=(\d+)(?:,|$)/)?.[1];
  const signatures = [...signature.matchAll(/(?:^|,)v1=([a-f\d]{64})(?=,|$)/gi)].map((m) => m[1]);
  const seconds = Number(timestamp);
  if (!timestamp || !Number.isSafeInteger(seconds) || Math.abs(now - seconds * 1000) > 300_000)
    throw new Error('Webhook timestamp invalid');
  const expected = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
  if (!signatures.some((value) => equalHex(value, expected)))
    throw new Error('Webhook signature invalid');

  let event: unknown;
  try {
    event = JSON.parse(body);
  } catch {
    throw new Error('Webhook JSON invalid');
  }
  if (!event || typeof event !== 'object') throw new Error('Webhook event invalid');
  const item = event as Record<string, unknown>;
  const object =
    provider === 'stripe'
      ? (item.data as { object?: { metadata?: { organizationId?: unknown } } } | undefined)?.object
      : undefined;
  const organizationId =
    provider === 'stripe' ? object?.metadata?.organizationId : item.organizationId;
  if (
    typeof item.id !== 'string' ||
    !item.id ||
    typeof item.type !== 'string' ||
    !item.type ||
    typeof organizationId !== 'string' ||
    !organizationId
  )
    throw new Error('Webhook event fields invalid');
  return {
    provider,
    externalEventId: item.id,
    organizationId,
    eventType: item.type,
    payloadHash: createHash('sha256').update(body).digest('hex'),
  };
}

export type WebhookStore = {
  connected(organizationId: string, provider: WebhookProvider, eventType: string): Promise<boolean>;
  insert(event: ParsedWebhook): Promise<'created' | 'duplicate'>;
};

export async function receiveWebhook(
  provider: WebhookProvider,
  body: string,
  signature: string | null,
  secret: string,
  store: WebhookStore,
  now = Date.now(),
): Promise<'created' | 'duplicate'> {
  const event = verifyWebhook(provider, body, signature, secret, now);
  if (!(await store.connected(event.organizationId, provider, event.eventType)))
    throw new Error('Provider connection unavailable');
  return store.insert(event);
}
