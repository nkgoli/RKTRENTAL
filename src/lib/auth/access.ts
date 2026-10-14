import { notFound, redirect } from 'next/navigation';
import { db } from '@/lib/db/client';
import { buildLeaseAccessWhere, canAccessRole, canWriteAsRole, roleHome } from './policy';
import { getSession } from './server-session';
import type { AuthRole, AuthSession } from './session';

export async function requireRole(...roles: AuthRole[]): Promise<AuthSession> {
  const session = await getSession();
  if (!session) redirect('/sign-in');
  if (!roles.includes(session.role)) redirect(roleHome(session.role));
  return session;
}

export async function requireManagerRole(): Promise<AuthSession> {
  const session = await getSession();
  if (!session) redirect('/sign-in');
  if (!canAccessRole(session.role, 'MANAGER')) redirect(roleHome(session.role));
  return session;
}

export async function requireManagerWriteRole(): Promise<AuthSession> {
  const session = await getSession();
  if (!session) redirect('/sign-in');
  if (!canWriteAsRole(session.role)) redirect(roleHome(session.role));
  return session;
}

export async function requireTenantRole(): Promise<AuthSession> {
  return requireRole('TENANT');
}

export async function findLeaseAccess(session: AuthSession, leaseId: string) {
  const where = buildLeaseAccessWhere(session, leaseId);
  if (!where) return null;

  return db.lease.findFirst({
    where,
    select: { id: true, organizationId: true },
  });
}

export async function requireLeaseAccess(leaseId: string) {
  const session = await requireRole('MANAGER', 'OWNER', 'TENANT');
  const lease = await findLeaseAccess(session, leaseId);
  if (!lease) notFound();
  return { ...lease, tenantId: session.tenantId };
}
