import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const RECOVERY_TOKEN_TTL_MS = 15 * 60_000;
export type RecoveryIdentity = {
  id: string;
  organizationId: string;
  passwordHash: string | null;
  updatedAt: Date;
};
type Claims = {
  purpose: 'password-reset';
  subjectId: string;
  organizationId: string;
  authVersion: number;
  issuedAt: number;
  expiresAt: number;
  nonce: string;
};

function secret(value?: string): string {
  const configured = value ?? process.env.ROCKETRENTAL_AUTH_SECRET;
  if (!configured || configured.length < 32) throw new Error('Recovery signing is unavailable');
  return configured;
}

function signature(payload: string, user: RecoveryIdentity, signingSecret?: string): Buffer {
  return createHmac('sha256', secret(signingSecret))
    .update('rocketrental-password-reset-v1\0')
    .update(user.passwordHash ?? '')
    .update('\0')
    .update(payload)
    .digest();
}

export function createRecoveryToken(
  user: RecoveryIdentity,
  options: { now?: number; secret?: string } = {},
): string {
  const now = options.now ?? Date.now();
  const claims: Claims = {
    purpose: 'password-reset',
    subjectId: user.id,
    organizationId: user.organizationId,
    authVersion: user.updatedAt.getTime(),
    issuedAt: now,
    expiresAt: now + RECOVERY_TOKEN_TTL_MS,
    nonce: randomBytes(24).toString('base64url'),
  };
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  return `${payload}.${signature(payload, user, options.secret).toString('base64url')}`;
}

/** These bounded claims identify a lookup only; callers must still verify the signature. */
export function recoveryTokenClaims(token: string, now = Date.now()): Claims | null {
  if (token.length > 2048 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(token)) return null;
  try {
    const claims = JSON.parse(
      Buffer.from(token.split('.')[0], 'base64url').toString(),
    ) as Partial<Claims>;
    if (
      claims.purpose !== 'password-reset' ||
      typeof claims.subjectId !== 'string' ||
      !claims.subjectId ||
      claims.subjectId.length > 128 ||
      typeof claims.organizationId !== 'string' ||
      !claims.organizationId ||
      claims.organizationId.length > 128 ||
      !Number.isSafeInteger(claims.authVersion) ||
      !Number.isSafeInteger(claims.issuedAt) ||
      !Number.isSafeInteger(claims.expiresAt) ||
      claims.issuedAt! > now ||
      claims.expiresAt! <= now ||
      claims.expiresAt! - claims.issuedAt! !== RECOVERY_TOKEN_TTL_MS ||
      typeof claims.nonce !== 'string' ||
      !/^[A-Za-z0-9_-]{32}$/.test(claims.nonce)
    )
      return null;
    return claims as Claims;
  } catch {
    return null;
  }
}

export function verifyRecoveryToken(
  token: string,
  user: RecoveryIdentity,
  options: { now?: number; secret?: string } = {},
): boolean {
  const claims = recoveryTokenClaims(token, options.now);
  if (
    !claims ||
    claims.subjectId !== user.id ||
    claims.organizationId !== user.organizationId ||
    claims.authVersion !== user.updatedAt.getTime()
  )
    return false;
  try {
    const [payload, provided] = token.split('.');
    return timingSafeEqual(
      Buffer.from(provided, 'base64url'),
      signature(payload, user, options.secret),
    );
  } catch {
    return false;
  }
}
