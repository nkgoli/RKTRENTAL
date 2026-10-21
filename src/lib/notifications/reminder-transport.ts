import nodemailer, { type Transporter } from 'nodemailer';
import twilio from 'twilio';
import type { PrismaClient, ReminderAttemptStatus } from '@prisma/client';
import { isSandboxEnabled } from '@/lib/providers/sandbox';
import { validEmail, validPhone, type Channel } from './reminder-content';

export class ReminderError extends Error {
  constructor(
    public readonly code: string,
    public readonly status = 409,
  ) {
    super(code);
  }
}
export type TransportMessage = { id: string; recipient: string; subject: string; body: string };
export type TransportResult = {
  status: ReminderAttemptStatus;
  providerId?: string;
  errorCode?: string;
};
export interface ReminderTransport {
  name: string;
  send(message: TransportMessage): Promise<TransportResult>;
  reconcile?(providerId: string): Promise<TransportResult>;
}

export const twilioStatus = (status: string): ReminderAttemptStatus => {
  if (status === 'delivered' || status === 'read') return 'DELIVERED';
  if (['failed', 'undelivered', 'canceled'].includes(status)) return 'FAILED';
  return ['accepted', 'scheduled', 'queued', 'sending', 'sent'].includes(status)
    ? 'ACCEPTED'
    : 'UNCERTAIN';
};

export class SmtpReminderTransport implements ReminderTransport {
  readonly name = 'smtp';
  constructor(
    private readonly smtp: Pick<Transporter, 'sendMail'>,
    private readonly from: string,
  ) {}
  async send(message: TransportMessage): Promise<TransportResult> {
    try {
      const result = await this.smtp.sendMail({
        from: this.from,
        to: message.recipient,
        subject: message.subject,
        text: message.body,
        messageId: `<reminder-${message.id}@${this.from.split('@')[1]}>`,
        disableFileAccess: true,
        disableUrlAccess: true,
      });
      return result.accepted?.length
        ? { status: 'ACCEPTED', providerId: result.messageId }
        : { status: 'FAILED', errorCode: 'SMTP_REJECTED' };
    } catch (e) {
      const error = e as { code?: string; responseCode?: number };
      return {
        status:
          ['EAUTH', 'ECONNECTION', 'EDNS'].includes(error.code ?? '') ||
          (error.responseCode ?? 0) >= 400
            ? 'FAILED'
            : 'UNCERTAIN',
        errorCode: 'SMTP_ERROR',
      };
    }
  }
}

type TwilioClient = ReturnType<typeof twilio>;
export class TwilioReminderTransport implements ReminderTransport {
  readonly name = 'twilio';
  constructor(
    private readonly client: Pick<TwilioClient, 'messages'>,
    private readonly from: string,
    private readonly callback: string,
  ) {}
  async send(message: TransportMessage): Promise<TransportResult> {
    const callback = new URL(this.callback);
    callback.searchParams.set('attemptId', message.id);
    try {
      const result = await this.client.messages.create({
        to: message.recipient,
        from: this.from,
        body: message.body,
        statusCallback: callback.toString(),
      });
      if (!/^SM[0-9a-f]{32}$/i.test(result.sid ?? ''))
        return { status: 'UNCERTAIN', errorCode: 'INVALID_PROVIDER_RESPONSE' };
      return { status: twilioStatus(result.status), providerId: result.sid };
    } catch (e) {
      const error = e as { status?: number; code?: number };
      return {
        status:
          error.status && error.status >= 400 && error.status < 500 && error.status !== 408
            ? 'FAILED'
            : 'UNCERTAIN',
        errorCode: error.code === 21610 ? 'SMS_OPTED_OUT' : 'TWILIO_ERROR',
      };
    }
  }
  async reconcile(providerId: string): Promise<TransportResult> {
    const message = await this.client.messages(providerId).fetch();
    return { status: twilioStatus(message.status), providerId: message.sid };
  }
}

export function callbackUrl(env: Record<string, string | undefined> = process.env) {
  const value = env.REMINDERS_TWILIO_CALLBACK_URL;
  if (!value) throw new ReminderError('TRANSPORT_UNCONFIGURED', 503);
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.search || url.hash || url.username || url.password)
    throw new ReminderError('TRANSPORT_UNCONFIGURED', 503);
  return url.toString();
}

/** Connection metadata selects the provider; secrets are read only from the server environment. */
export async function reminderTransport(
  organizationId: string,
  channel: Channel,
  client: PrismaClient,
  env: Record<string, string | undefined> = process.env,
): Promise<ReminderTransport> {
  const rows = await client.providerConnection.findMany({
    where: { organizationId, kind: channel },
  });
  const connected = rows.filter((r) => r.provider !== 'settings' && r.status === 'CONNECTED');
  if (isSandboxEnabled(env)) {
    if (connected.some((r) => r.provider !== 'mock'))
      throw new ReminderError('SANDBOX_LIVE_PROVIDER_BLOCKED', 503);
    return { name: 'mock', send: async () => ({ status: 'MOCK_RECORDED' }) };
  }
  const provider = channel === 'EMAIL' ? 'smtp' : 'twilio';
  if (
    env.REMINDERS_LIVE_ENABLED !== 'true' ||
    connected.length !== 1 ||
    connected[0].provider !== provider
  )
    throw new ReminderError('TRANSPORT_UNCONFIGURED', 503);
  const settings = connected[0].settings as Record<string, unknown> | null;
  const prefix = settings?.credentialPrefix;
  if (typeof prefix !== 'string' || !/^RR_REMINDER_[A-Z0-9_]+$/.test(prefix))
    throw new ReminderError('TRANSPORT_UNCONFIGURED', 503);
  const get = (key: string) => {
    const value = env[`${prefix}_${key}`];
    if (!value) throw new ReminderError('TRANSPORT_UNCONFIGURED', 503);
    return value;
  };
  if (channel === 'EMAIL') {
    const from = get('SMTP_FROM');
    const port = Number(get('SMTP_PORT'));
    if (!validEmail(from) || ![465, 587].includes(port))
      throw new ReminderError('TRANSPORT_UNCONFIGURED', 503);
    return new SmtpReminderTransport(
      nodemailer.createTransport({
        host: get('SMTP_HOST'),
        port,
        secure: port === 465,
        requireTLS: true,
        auth: { user: get('SMTP_USER'), pass: get('SMTP_PASSWORD') },
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 20_000,
      }),
      from,
    );
  }
  const accountSid = get('TWILIO_ACCOUNT_SID');
  const from = get('TWILIO_FROM');
  if (!/^AC[0-9a-f]{32}$/i.test(accountSid) || !validPhone(from))
    throw new ReminderError('TRANSPORT_UNCONFIGURED', 503);
  return new TwilioReminderTransport(
    twilio(accountSid, get('TWILIO_AUTH_TOKEN'), { timeout: 20_000, autoRetry: false }),
    from,
    callbackUrl(env),
  );
}

export async function boundedSend(
  transport: ReminderTransport,
  message: TransportMessage,
  timeoutMs = 25_000,
): Promise<TransportResult> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      transport.send(message),
      new Promise<TransportResult>((resolve) => {
        timer = setTimeout(
          () => resolve({ status: 'UNCERTAIN', errorCode: 'PROVIDER_TIMEOUT' }),
          timeoutMs,
        );
      }),
    ]);
  } catch {
    return { status: 'UNCERTAIN', errorCode: 'PROVIDER_ERROR' };
  } finally {
    clearTimeout(timer);
  }
}
