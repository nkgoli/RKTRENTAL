import { cookies } from 'next/headers';
import { db } from '@/lib/db/client';
import { SESSION_COOKIE, verifySessionToken, type AuthRole, type AuthSession } from './session';

type SessionUser = {
  id: string;
  organizationId: string;
  email: string;
  name: string;
  role: string;
  updatedAt: Date;
  tenant: { id: string } | null;
};

function isAuthRole(role: string): role is AuthRole {
  return role === 'MANAGER' || role === 'OWNER' || role === 'TENANT' || role === 'ADMIN';
}

/** Reconcile the signed token with current user state; User.updatedAt acts as the revocation version. */
export function hydrateCurrentSession(token: AuthSession, user: SessionUser | null): AuthSession | null {
  if (
    !user ||
    user.id !== token.subjectId ||
    user.organizationId !== token.organizationId ||
    user.updatedAt.getTime() !== token.authVersion ||
    !isAuthRole(user.role) ||
    (user.role === 'TENANT' && !user.tenant?.id)
  )
    return null;
  const tenantId = user.role === 'TENANT' ? user.tenant!.id : undefined;
  return {
    ...token,
    email: user.email,
    name: user.name,
    role: user.role,
    ...(tenantId ? { tenantId } : { tenantId: undefined }),
  };
}

export async function getSession(): Promise<AuthSession | null> {
  const cookieStore = await cookies();
  const token = await verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
  if (!token) return null;
  try {
    const user = await db.user.findFirst({
      where: { id: token.subjectId, organizationId: token.organizationId },
      select: {
        id: true,
        organizationId: true,
        email: true,
        name: true,
        role: true,
        updatedAt: true,
        tenant: { select: { id: true } },
      },
    });
    return hydrateCurrentSession(token, user);
  } catch {
    // Do not authenticate from a stale token when the revocation check is unavailable.
    return null;
  }
}
