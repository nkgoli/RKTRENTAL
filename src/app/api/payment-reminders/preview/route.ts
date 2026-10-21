import { reminderApi, reminders, parseBody, previewInput } from '@/lib/notifications/reminder-api';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  return reminderApi(async (actor) => {
    const input = await parseBody(request, previewInput);
    return reminders.preview(actor, input.leaseId, input.channel);
  });
}
