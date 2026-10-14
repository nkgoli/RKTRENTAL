import { Prisma } from '@prisma/client';
import { db } from '@/lib/db/client';
import { receiveWebhook, type WebhookProvider } from '@/lib/providers/webhooks';

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
  try {
    const result = await receiveWebhook(name, body, signature, secret, {
      connected: async (organizationId, webhookProvider) => {
        const connection = await db.providerConnection.findFirst({
          where: {
            organizationId,
            kind: 'PAYMENTS',
            provider: webhookProvider,
            status: 'CONNECTED',
          },
        });
        return Boolean(connection);
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
    return Response.json({ received: true, duplicate: result === 'duplicate' });
  } catch (error) {
    if (error instanceof Error && /signature|timestamp|JSON|event fields/.test(error.message))
      return Response.json({ error: 'Invalid webhook' }, { status: 400 });
    if (error instanceof Error && error.message === 'Provider connection unavailable')
      return Response.json({ error: 'Provider connection unavailable' }, { status: 422 });
    if (error instanceof Error && error.message === 'Webhook event conflict')
      return Response.json({ error: 'Webhook event conflict' }, { status: 409 });
    return Response.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
