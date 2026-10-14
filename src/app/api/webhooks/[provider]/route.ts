import { Prisma } from '@prisma/client';
import { db } from '@/lib/db/client';
import { recordProviderHealth } from '@/lib/integrations/service';
import { applyPaymentWebhook } from '@/lib/ledger/webhooks';
import { receiveWebhook, verifyWebhook, type WebhookProvider } from '@/lib/providers/webhooks';
import { handleScreeningWebhook, type ScreeningWebhookEvent } from '@/lib/screening/webhook';

export const runtime = 'nodejs';

export async function POST(request: Request, context: { params: Promise<{ provider: string }> }) {
  const { provider } = await context.params;
  if (provider !== 'mock' && provider !== 'stripe')
    return Response.json({ error: 'Unknown provider' }, { status: 404 });
  const name = provider as WebhookProvider;
  if (name === 'mock' && process.env.NODE_ENV === 'production')
    return Response.json({ error: 'Unknown provider' }, { status: 404 });
  const secret =
    name === 'stripe' ? process.env.STRIPE_WEBHOOK_SECRET : process.env.MOCK_WEBHOOK_SECRET;
  if (!secret) return Response.json({ error: 'Webhook not configured' }, { status: 503 });
  const body = await request.text();
  const signature = request.headers.get(
    name === 'stripe' ? 'stripe-signature' : 'x-mock-signature',
  );
  let verified: ReturnType<typeof verifyWebhook> | undefined;
  let healthKind: 'PAYMENTS' | 'SCREENING' = 'PAYMENTS';
  let healthProvider: string = name;
  let created = false;
  try {
    verified = verifyWebhook(name, body, signature, secret);
    const screening = verified.eventType.startsWith('screening.');
    const payload = JSON.parse(body) as { data?: Record<string, unknown> };
    healthKind = screening ? 'SCREENING' : 'PAYMENTS';
    healthProvider =
      screening && typeof payload.data?.provider === 'string' ? payload.data.provider : name;
    const result = await receiveWebhook(name, body, signature, secret, {
      connected: async (organizationId, webhookProvider) => {
        const connection = await db.providerConnection.findFirst({
          where: {
            organizationId,
            kind: healthKind,
            provider: healthProvider,
            status: 'CONNECTED',
          },
        });
        return Boolean(connection) && (!screening || webhookProvider === 'mock');
      },
      insert: async (event) => {
        try {
          await db.webhookEvent.create({ data: event });
          return 'created';
        } catch (error) {
          if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            const existing = await db.webhookEvent.findUnique({
              where: {
                provider_externalEventId: {
                  provider: event.provider,
                  externalEventId: event.externalEventId,
                },
              },
            });
            if (
              existing?.organizationId === event.organizationId &&
              existing.eventType === event.eventType &&
              existing.payloadHash === event.payloadHash
            )
              return 'duplicate';
            throw new Error('Webhook event conflict');
          }
          throw error;
        }
      },
    });
    created = result === 'created';
    // Replaying a matching delivery is safe in both stores and repairs an interrupted first attempt.
    if (screening) {
      const data = payload.data ?? {};
      await handleScreeningWebhook({
        externalEventId: verified.externalEventId,
        organizationId: verified.organizationId,
        applicationId: data.applicationId,
        provider: healthProvider,
        providerReference: data.providerReference,
        status: data.status,
        creditScore: data.creditScore,
        background: data.background,
        eviction: data.eviction,
      } as ScreeningWebhookEvent);
    } else {
      await applyPaymentWebhook(
        {
          provider: name,
          organizationId: verified.organizationId,
          eventType: verified.eventType,
        },
        body,
      );
    }
    await recordProviderHealth(
      verified.organizationId,
      healthKind,
      healthProvider,
      { webhook: 'ok' },
      db.providerConnection,
    );
    return Response.json({ received: true, duplicate: result === 'duplicate' });
  } catch (error) {
    if (verified) {
      if (created) {
        await db.webhookEvent
          .deleteMany({
            where: {
              provider: verified.provider,
              externalEventId: verified.externalEventId,
              organizationId: verified.organizationId,
              payloadHash: verified.payloadHash,
            },
          })
          .catch(() => undefined);
      }
      await recordProviderHealth(
        verified.organizationId,
        healthKind,
        healthProvider,
        {
          webhook: 'failed',
          error: error instanceof Error ? error.message : 'Webhook processing failed',
        },
        db.providerConnection,
      ).catch(() => undefined);
    }
    if (error instanceof Error && /signature|timestamp|JSON|event fields/.test(error.message))
      return Response.json({ error: 'Invalid webhook' }, { status: 400 });
    if (error instanceof Error && error.message === 'Provider connection unavailable')
      return Response.json({ error: 'Provider connection unavailable' }, { status: 422 });
    if (error instanceof Error && error.message === 'Webhook event conflict')
      return Response.json({ error: 'Webhook event conflict' }, { status: 409 });
    return Response.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
