import { reminderApi, reminders, parseBody, dispatchInput } from '@/lib/notifications/reminder-api';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  return reminderApi(async (actor) => {
    const input = await parseBody(request, dispatchInput);
    return reminders.dispatch(actor, input.previewId, input.idempotencyKey);
  });
}
