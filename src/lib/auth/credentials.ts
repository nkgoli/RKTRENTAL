import { scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import type { UserRole } from '@prisma/client';
import { db } from '@/lib/db/client';
import type { AuthRole, SessionIdentity } from './session';

const demoCredentials: Record<string, { role: AuthRole; envName: string; fallback: string }> = {
  'jordan.mills@rocketrental.example': {
    role: 'MANAGER',
    envName: 'ROCKETRENTAL_DEMO_MANAGER_PASSWORD',
    fallback: 'JordanDemo#2026',
  },
  'alex.rivera@email.com': {
    role: 'TENANT',
    envName: 'ROCKETRENTAL_DEMO_TENANT_PASSWORD',
    fallback: 'AlexDemo#2026',
  },
};

function constantTimePasswordMatch(received: string, expected: string): boolean {
  const receivedDigest = createHash('sha256').update(received).digest();
  const expectedDigest = createHash('sha256').update(expected).digest();
  return timingSafeEqual(receivedDigest, expectedDigest);
}

function verifyConfiguredHash(email: string, password: string): boolean | null {
  const raw = process.env.ROCKETRENTAL_AUTH_PASSWORD_HASHES;
  if (!raw) return null;
  try {
    const hashes = JSON.parse(raw) as Record<string, unknown>;
    const encoded = hashes[email];
    if (typeof encoded !== 'string') return false;
    const [algorithm, salt, expected] = encoded.split('$');
    if (algorithm !== 'scrypt' || !salt || !expected) return false;
    const saltBytes = Buffer.from(salt, 'base64url');
    const expectedBytes = Buffer.from(expected, 'base64url');
    if (saltBytes.length < 16 || expectedBytes.length !== 32) return false;
    const actual = scryptSync(password, saltBytes, expectedBytes.length);
    return timingSafeEqual(actual, expectedBytes);
  } catch {
    return false;
  }
}

function verifyPassword(email: string, role: AuthRole, password: string): boolean {
  const configured = verifyConfiguredHash(email, password);
  if (configured !== null) return configured;
  if (process.env.NODE_ENV !== 'development') return false;
  const demo = demoCredentials[email];
  if (!demo || demo.role !== role) return false;
  return constantTimePasswordMatch(password, process.env[demo.envName] ?? demo.fallback);
}

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
    if (!verifyPassword(email, user.role, password)) return null;
    return {
      subjectId: user.id,
      organizationId: user.organizationId,
      email: user.email,
      name: user.name,
      role: user.role,
      ...(tenantId ? { tenantId } : {}),
    };
  }

  const tenants = await db.tenant.findMany({
    where: { email: { equals: email, mode: 'insensitive' } },
    take: 2,
  });
  if (tenants.length !== 1) return null;
  const tenant = tenants[0];
  if (!verifyPassword(email, 'TENANT', password)) return null;
  return {
    subjectId: tenant.userId ?? tenant.id,
    organizationId: tenant.organizationId,
    email: tenant.email ?? email,
    name: tenant.name,
    role: 'TENANT',
    tenantId: tenant.id,
  };
}
