import { z } from 'zod';
import { getSession } from '@/lib/auth/server-session';
import { PaymentReminders } from './reminders';
import { ReminderError } from './reminder-transport';

export const reminders = new PaymentReminders();
const id = z.string().min(1).max(100);
export const previewInput = z.object({ leaseId: id, channel: z.enum(['EMAIL', 'SMS']) }).strict();
export const dispatchInput = z
  .object({ previewId: id, idempotencyKey: z.string().min(16).max(100) })
  .strict();
export const reconcileInput = z.object({ attemptId: id }).strict();

export async function reminderApi(
  work: (actor: NonNullable<Awaited<ReturnType<typeof getSession>>>) => Promise<unknown>,
) {
  const session = await getSession();
  if (!session) return Response.json({ error: 'AUTH_REQUIRED' }, { status: 401 });
  if (session.role !== 'MANAGER')
    return Response.json({ error: 'MANAGER_REQUIRED' }, { status: 403 });
  try {
    return Response.json(await work(session), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof ReminderError)
      return Response.json({ error: error.code }, { status: error.status });
    if (error instanceof z.ZodError || error instanceof SyntaxError)
      return Response.json({ error: 'INVALID_REQUEST' }, { status: 400 });
    return Response.json({ error: 'REMINDER_SERVICE_UNAVAILABLE' }, { status: 503 });
  }
}

export async function parseBody<T>(request: Request, schema: z.ZodType<T>) {
  const body = await request.text();
  if (body.length > 4096) throw new ReminderError('REQUEST_TOO_LARGE', 413);
  if (!request.headers.get('content-type')?.startsWith('application/json'))
    throw new ReminderError('JSON_REQUIRED', 415);
  // Same-origin cookie requests only. Non-browser authenticated clients may omit Origin.
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin)
    throw new ReminderError('INVALID_ORIGIN', 403);
  return schema.parse(JSON.parse(body));
}
