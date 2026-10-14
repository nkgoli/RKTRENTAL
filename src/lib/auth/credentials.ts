import type { UserRole } from '@prisma/client';
import { db } from '@/lib/db/client';
import type { AuthRole, SessionIdentity } from './session';
import { verifyPasswordHash } from './password';

export { verifyPasswordHash };

function isSupportedRole(role: UserRole): role is AuthRole {
  return role === 'MANAGER' || role === 'OWNER' || role === 'TENANT' || role === 'ADMIN';
}

export async function authenticateCredentials(
  emailInput: string,
  password: string,
): Promise<SessionIdentity | null> {
  const email = emailInput.trim().toLowerCase();
  if (!email || !password || email.length > 254 || password.length > 1024) return null;

  const users = await db.user.findMany({
    where: { email: { equals: email, mode: 'insensitive' } },
    include: { tenant: true },
    take: 2,
  });
  if (users.length > 1) return null;

  if (users.length === 1) {
    const user = users[0];
    if (!isSupportedRole(user.role)) return null;
    const tenantId = user.tenant?.id;
    if (user.role === 'TENANT' && !tenantId) return null;
    if (!(await verifyPasswordHash(password, user.passwordHash))) return null;
    return {
      subjectId: user.id,
      organizationId: user.organizationId,
      email: user.email,
      name: user.name,
      role: user.role,
      ...(tenantId ? { tenantId } : {}),
    };
  }

  return null;
}
