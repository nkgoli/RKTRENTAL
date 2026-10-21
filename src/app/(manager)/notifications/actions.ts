'use server';

import { z } from 'zod';
import { requireManagerRole } from '@/lib/auth/access';
import { PaymentReminders } from '@/lib/notifications/reminders';
import { ReminderError } from '@/lib/notifications/reminder-transport';
import type { Channel, Draft, Preview, Result } from '@/components/notifications/model';

const id = z.string().min(1).max(100);
const draftInput = z
  .object({
    recipients: z
      .array(
        z
          .object({
            tenantId: id,
            subject: z
              .string()
              .trim()
              .min(1)
              .max(200)
              .refine((s) => !/[\r\n]/.test(s)),
            body: z.string().trim().min(1).max(2000),
          })
          .strict(),
      )
      .min(1)
      .max(30),
  })
  .strict();

async function result<T>(work: () => Promise<unknown>): Promise<Result<T>> {
  try {
    // Prisma JSON and timestamps cross the action boundary as a plain immutable snapshot.
    return { ok: true, value: JSON.parse(JSON.stringify(await work())) as T };
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof ReminderError
          ? e.code
          : e instanceof z.ZodError
            ? 'INVALID_REQUEST'
            : 'REMINDER_SERVICE_UNAVAILABLE',
    };
  }
}

export async function previewReminder(
  leaseId: string,
  channel: Channel,
  draft: Draft,
): Promise<Result<Preview>> {
  const actor = await requireManagerRole();
  return result(async () => {
    id.parse(leaseId);
    z.enum(['EMAIL', 'SMS']).parse(channel);
    const edit = draftInput.parse(draft);
    const preview = await new PaymentReminders().preview(actor, leaseId, channel);
    // Fail closed until the service can bind explicit selections and edits to its audit snapshot.
    const snapshot = preview.snapshot as unknown as Preview['snapshot'];
    if (
      JSON.stringify(edit.recipients) !==
      JSON.stringify(
        snapshot.recipients.map(({ tenantId, subject, body }) => ({ tenantId, subject, body })),
      )
    )
      throw new ReminderError('REVIEW_OPTIONS_UNAVAILABLE', 503);
    return preview;
  });
}

export async function dispatchReminder(previewId: string, key: string): Promise<Result<Preview>> {
  const actor = await requireManagerRole();
  return result(() =>
    new PaymentReminders().dispatch(actor, id.parse(previewId), z.string().uuid().parse(key)),
  );
}

export async function reminderHistory(leaseId: string): Promise<Result<Preview[]>> {
  const actor = await requireManagerRole();
  return result(() => new PaymentReminders().history(actor, id.parse(leaseId)));
}

export async function reconcileReminder(attemptId: string): Promise<Result<unknown>> {
  const actor = await requireManagerRole();
  return result(() => new PaymentReminders().reconcile(actor, id.parse(attemptId)));
}
