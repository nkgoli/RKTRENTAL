import { getSession } from '@/lib/auth/server-session';
import { db } from '@/lib/db/client';

export const runtime = 'nodejs';

/** Development inspection of the durable mock outbox. */
export async function GET() {
  if (process.env.NODE_ENV === 'production') return new Response(null, { status: 404 });
  const session = await getSession();
  if (!session) return Response.json({ error: 'Sign in required' }, { status: 401 });
  if (session.role !== 'MANAGER' && session.role !== 'OWNER')
    return Response.json({ error: 'Manager access required' }, { status: 403 });
  const deliveries = await db.emailDelivery.findMany({
    // Recovery links are bearer credentials, never organization-wide notification history.
    where: { organizationId: session.organizationId, kind: { not: 'PASSWORD_RESET' } },
    orderBy: { sentAt: 'desc' },
    take: 100,
  });
  return Response.json({ deliveries });
}
