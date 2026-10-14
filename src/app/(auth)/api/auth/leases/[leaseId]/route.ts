import { findLeaseAccess } from '@/lib/auth/access';
import { getSession } from '@/lib/auth/server-session';

export async function GET(_request: Request, { params }: { params: Promise<{ leaseId: string }> }) {
  const session = await getSession();
  if (!session) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.role !== 'TENANT' && session.role !== 'MANAGER' && session.role !== 'OWNER') {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { leaseId } = await params;
  const lease = await findLeaseAccess(session, leaseId);
  if (!lease) return Response.json({ error: 'Not found' }, { status: 404 });
  return Response.json({ leaseId: lease.id });
}
