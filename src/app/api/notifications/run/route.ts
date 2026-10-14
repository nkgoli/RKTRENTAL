import { getSession } from '@/lib/auth/server-session';
import { runNotificationSweep } from '@/lib/notifications/service';

export const runtime = 'nodejs';

/** Manager-triggered sweep; suitable for a scheduled authenticated API caller. */
export async function POST() {
  const session = await getSession();
  if (!session) return Response.json({ error: 'Sign in required' }, { status: 401 });
  if (session.role !== 'MANAGER' && session.role !== 'OWNER')
    return Response.json({ error: 'Manager access required' }, { status: 403 });
  const result = await runNotificationSweep(session.organizationId);
  return Response.json(result);
}
