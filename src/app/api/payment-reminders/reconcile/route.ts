import {
  reminderApi,
  reminders,
  parseBody,
  reconcileInput,
} from '@/lib/notifications/reminder-api';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  return reminderApi(async (actor) => {
    const input = await parseBody(request, reconcileInput);
    return reminders.reconcile(actor, input.attemptId);
  });
}
