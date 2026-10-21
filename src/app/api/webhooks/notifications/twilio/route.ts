import twilio from 'twilio';
import { db } from '@/lib/db/client';
import { PaymentReminders } from '@/lib/notifications/reminders';
import { callbackUrl, twilioStatus } from '@/lib/notifications/reminder-transport';

export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const attemptId = url.searchParams.get('attemptId');
    if (!attemptId || [...url.searchParams.keys()].length !== 1)
      return new Response(null, { status: 400 });
    const body = await request.text();
    if (
      body.length > 16_384 ||
      !request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded')
    )
      return new Response(null, { status: 400 });
    const form = new URLSearchParams(body);
    if (new Set(form.keys()).size !== [...form.keys()].length)
      return new Response(null, { status: 400 });
    const params = Object.fromEntries(form);
    const attempt = await db.paymentReminderAttempt.findUnique({ where: { id: attemptId } });
    if (!attempt || attempt.provider !== 'twilio' || !attempt.startedAt)
      return new Response(null, { status: 404 });
    const connection = await db.providerConnection.findUnique({
      where: {
        organizationId_kind_provider: {
          organizationId: attempt.organizationId,
          kind: 'SMS',
          provider: 'twilio',
        },
      },
    });
    const prefix = (connection?.settings as Record<string, unknown> | null)?.credentialPrefix;
    if (typeof prefix !== 'string' || !/^RR_REMINDER_[A-Z0-9_]+$/.test(prefix))
      return new Response(null, { status: 503 });
    const token = process.env[`${prefix}_TWILIO_AUTH_TOKEN`];
    const expectedUrl = new URL(callbackUrl());
    expectedUrl.searchParams.set('attemptId', attempt.id);
    if (
      !token ||
      params.AccountSid !== process.env[`${prefix}_TWILIO_ACCOUNT_SID`] ||
      params.To !== attempt.recipient ||
      params.From !== process.env[`${prefix}_TWILIO_FROM`] ||
      !/^SM[0-9a-f]{32}$/i.test(params.MessageSid ?? '') ||
      (attempt.providerId && attempt.providerId !== params.MessageSid) ||
      !twilio.validateRequest(
        token,
        request.headers.get('x-twilio-signature') ?? '',
        expectedUrl.toString(),
        params,
      )
    )
      return new Response(null, { status: 403 });
    if (
      ![
        'accepted',
        'queued',
        'sending',
        'sent',
        'delivered',
        'read',
        'failed',
        'undelivered',
        'canceled',
      ].includes(params.MessageStatus)
    )
      return new Response(null, { status: 400 });
    await new PaymentReminders().applyResult(attempt.id, {
      status: twilioStatus(params.MessageStatus),
      providerId: params.MessageSid,
    });
    // Twilio's explicit opt-out failure also disables subsequent SMS reminders locally.
    if (params.ErrorCode === '21610')
      await db.tenant.updateMany({
        where: { id: attempt.tenantId, organizationId: attempt.organizationId },
        data: { smsRemindersEnabled: false },
      });
    return new Response(null, { status: 204 });
  } catch {
    return new Response(null, { status: 503 });
  }
}
