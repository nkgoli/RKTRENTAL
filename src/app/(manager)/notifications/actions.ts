'use server';

import { z } from 'zod';
import { getSession } from '@/lib/auth/server-session';
import { PaymentReminders } from '@/lib/notifications/reminders';
import { ReminderError } from '@/lib/notifications/reminder-transport';
import { reminderReviewInput } from '@/lib/notifications/reminder-content';
import type { Channel, Draft, Preview, Result } from '@/components/notifications/model';

const id = z.string().min(1).max(100);
async function requireReminderActor() {
  const actor = await getSession();
  if (!actor) throw new ReminderError('AUTH_REQUIRED', 401);
  if (actor.role !== 'MANAGER') throw new ReminderError('MANAGER_REQUIRED', 403);
  return actor;
}
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
  return result(async () => {
    const actor = await requireReminderActor();
    id.parse(leaseId);
    z.enum(['EMAIL', 'SMS']).parse(channel);
    const edit = reminderReviewInput.parse(draft);
    return new PaymentReminders().preview(actor, leaseId, channel, edit);
  });
}

export async function dispatchReminder(previewId: string, key: string): Promise<Result<Preview>> {
  return result(async () =>
    new PaymentReminders().dispatch(
      await requireReminderActor(),
      id.parse(previewId),
      z.string().uuid().parse(key),
    ),
  );
}

export async function reminderHistory(leaseId: string): Promise<Result<Preview[]>> {
  return result(async () =>
    new PaymentReminders().history(await requireReminderActor(), id.parse(leaseId)),
  );
}

export async function reconcileReminder(attemptId: string): Promise<Result<unknown>> {
  return result(async () =>
    new PaymentReminders().reconcile(await requireReminderActor(), id.parse(attemptId)),
  );
}
