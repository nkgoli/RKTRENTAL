import { z } from 'zod';
import { db } from '@/lib/db/client';
import { getSession } from '@/lib/auth/server-session';
import { parseBody } from '@/lib/notifications/reminder-api';
import { ReminderError } from '@/lib/notifications/reminder-transport';

export const runtime = 'nodejs';
const input = z
  .object({ emailRemindersEnabled: z.boolean(), smsRemindersEnabled: z.boolean() })
  .strict();
export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: 'AUTH_REQUIRED' }, { status: 401 });
  if (session.role !== 'TENANT' || !session.tenantId)
    return Response.json({ error: 'TENANT_REQUIRED' }, { status: 403 });
  try {
    const data = await parseBody(request, input);
    const result = await db.tenant.updateMany({
      where: {
        id: session.tenantId,
        organizationId: session.organizationId,
        userId: session.subjectId,
      },
      data,
    });
    if (!result.count) return Response.json({ error: 'TENANT_NOT_FOUND' }, { status: 404 });
    return Response.json(data, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof ReminderError)
      return Response.json({ error: error.code }, { status: error.status });
    if (error instanceof z.ZodError || error instanceof SyntaxError)
      return Response.json({ error: 'INVALID_REQUEST' }, { status: 400 });
    return Response.json({ error: 'PREFERENCES_UNAVAILABLE' }, { status: 503 });
  }
}
