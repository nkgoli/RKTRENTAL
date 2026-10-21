import { reminderApi, reminders } from '@/lib/notifications/reminder-api';
import { ReminderError } from '@/lib/notifications/reminder-transport';
export const runtime = 'nodejs';
export async function GET(request: Request) {
  return reminderApi(async (actor) => {
    const leaseId = new URL(request.url).searchParams.get('leaseId');
    if (!leaseId || leaseId.length > 100) throw new ReminderError('LEASE_ID_REQUIRED', 400);
    return reminders.history(actor, leaseId);
  });
}
