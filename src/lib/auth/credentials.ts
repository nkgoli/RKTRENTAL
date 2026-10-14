import { headers } from 'next/headers';
import type { UserRole } from '@prisma/client';
import { db } from '@/lib/db/client';
import type { AuthRole, SessionIdentity } from './session';
import { verifyPasswordHash } from './password';

export { verifyPasswordHash };

const DUMMY_PASSWORD_HASH = `scrypt$16384$8$1$${'0'.repeat(32)}$${'0'.repeat(128)}`;
const MAX_FAILURES = 5;
const FAILURE_WINDOW_MS = 15 * 60_000;
const LOCKOUT_MS = 15 * 60_000;

type CredentialUser = {
  id: string;
  organizationId: string;
  email: string;
  name: string;
  role: UserRole;
  passwordHash: string | null;
  updatedAt: Date;
  tenant: { id: string } | null;
};

type FailureBucket = { count: number; windowStartedAt: number; lockedUntil: number };

/** Process-local fallback limiter. Deployments with multiple instances should also rate-limit at the edge. */
export class CredentialAttemptLimiter {
  private readonly buckets = new Map<string, FailureBucket>();

  isLocked(keys: string[], now: number): boolean {
    return keys.some((key) => {
      const bucket = this.buckets.get(key);
      if (!bucket) return false;
      if (bucket.lockedUntil > now) return true;
      if (now - bucket.windowStartedAt >= FAILURE_WINDOW_MS) this.buckets.delete(key);
      return false;
    });
  }

  recordFailure(keys: string[], now: number): void {
    for (const key of keys) {
      const current = this.buckets.get(key);
      const bucket =
        !current || now - current.windowStartedAt >= FAILURE_WINDOW_MS
          ? { count: 0, windowStartedAt: now, lockedUntil: 0 }
          : current;
      bucket.count += 1;
      if (bucket.count >= MAX_FAILURES) bucket.lockedUntil = now + LOCKOUT_MS;
      this.buckets.set(key, bucket);
    }
    if (this.buckets.size > 10_000) {
      for (const [key, bucket] of this.buckets) {
        if (bucket.lockedUntil <= now && now - bucket.windowStartedAt >= FAILURE_WINDOW_MS)
          this.buckets.delete(key);
        if (this.buckets.size <= 8_000) break;
      }
    }
  }

  clear(keys: string[]): void {
    for (const key of keys) this.buckets.delete(key);
  }
}

const defaultLimiter = new CredentialAttemptLimiter();

function isSupportedRole(role: UserRole): role is AuthRole {
  return role === 'MANAGER' || role === 'OWNER' || role === 'TENANT' || role === 'ADMIN';
}

async function requestIp(): Promise<string> {
  const requestHeaders = await headers();
  const direct = requestHeaders.get('x-real-ip')?.trim();
  const forwarded = requestHeaders.get('x-forwarded-for')?.split(',')[0]?.trim();
  return direct || forwarded || 'unknown';
}

export async function authenticateCredentials(
  emailInput: string,
  password: string,
  options: {
    remoteAddress?: string;
    now?: number;
    limiter?: CredentialAttemptLimiter;
    findUsers?: (email: string) => Promise<CredentialUser[]>;
    verify?: typeof verifyPasswordHash;
  } = {},
): Promise<SessionIdentity | null> {
  const email = emailInput.trim().toLowerCase();
  if (!email || !password || email.length > 254 || password.length > 1024) return null;

  const now = options.now ?? Date.now();
  const limiter = options.limiter ?? defaultLimiter;
  const ip = options.remoteAddress ?? (await requestIp());
  const rateKeys = [`email:${email}`, `ip:${ip}`];
  if (limiter.isLocked(rateKeys, now)) return null;

  const findUsers =
    options.findUsers ??
    (async (normalizedEmail: string) =>
      (await db.user.findMany({
        where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
        include: { tenant: { select: { id: true } } },
        take: 2,
      })) as CredentialUser[]);
  const users = await findUsers(email);
  const user = users.length === 1 ? users[0] : undefined;
  // Unknown, duplicate and password-less accounts still run the same scrypt derivation.
  const passwordMatches = await (options.verify ?? verifyPasswordHash)(
    password,
    user?.passwordHash ?? DUMMY_PASSWORD_HASH,
  );
  const tenantId = user?.tenant?.id;
  const accepted =
    users.length === 1 &&
    user !== undefined &&
    isSupportedRole(user.role) &&
    (user.role !== 'TENANT' || Boolean(tenantId)) &&
    passwordMatches;

  if (!accepted || !user || !isSupportedRole(user.role)) {
    limiter.recordFailure(rateKeys, now);
    return null;
  }
  limiter.clear(rateKeys);
  return {
    subjectId: user.id,
    organizationId: user.organizationId,
    authVersion: user.updatedAt.getTime(),
    email: user.email,
    name: user.name,
    role: user.role,
    ...(tenantId ? { tenantId } : {}),
  };
}
