export const SESSION_COOKIE = 'rr_session';
export const SESSION_TTL_SECONDS = 60 * 60 * 8;

/** Secure by default; local HTTP development must opt out explicitly. */
export function sessionCookieSecure(env: Record<string, string | undefined> = process.env): boolean {
  return env.ROCKETRENTAL_AUTH_COOKIE_SECURE !== 'false';
}

export type AuthRole = 'MANAGER' | 'OWNER' | 'TENANT' | 'ADMIN';

export type SessionIdentity = {
  subjectId: string;
  organizationId: string;
  /** Snapshot of User.updatedAt; server session reads compare it to revoke stale tokens. */
  authVersion: number;
  email: string;
  name: string;
  role: AuthRole;
  tenantId?: string;
};

export type AuthSession = SessionIdentity & {
  issuedAt: number;
  expiresAt: number;
};

const encoder = new TextEncoder();

function sessionSecret(): string | null {
  if (process.env.ROCKETRENTAL_AUTH_SECRET) return process.env.ROCKETRENTAL_AUTH_SECRET;
  if (process.env.NODE_ENV === 'development') {
    return 'rocketrental-local-development-session-secret-change-me';
  }
  return null;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function base64UrlToBytes(value: string): Uint8Array {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  return copy.buffer;
}

async function importSigningKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

function isAuthRole(value: unknown): value is AuthRole {
  return value === 'MANAGER' || value === 'OWNER' || value === 'TENANT' || value === 'ADMIN';
}

function isSession(value: unknown, nowSeconds: number): value is AuthSession {
  if (!value || typeof value !== 'object') return false;
  const session = value as Partial<AuthSession>;
  return (
    typeof session.subjectId === 'string' &&
    typeof session.organizationId === 'string' &&
    Number.isSafeInteger(session.authVersion) &&
    typeof session.email === 'string' &&
    typeof session.name === 'string' &&
    isAuthRole(session.role) &&
    (session.role !== 'TENANT' || typeof session.tenantId === 'string') &&
    typeof session.issuedAt === 'number' &&
    typeof session.expiresAt === 'number' &&
    session.expiresAt > nowSeconds &&
    session.expiresAt - session.issuedAt <= SESSION_TTL_SECONDS
  );
}

export async function createSessionToken(
  identity: SessionIdentity,
  options: { secret?: string; nowSeconds?: number } = {},
): Promise<string> {
  const secret = options.secret ?? sessionSecret();
  if (!secret || secret.length < 32) {
    throw new Error(
      'Set ROCKETRENTAL_AUTH_SECRET to at least 32 characters before enabling authentication.',
    );
  }
  const issuedAt = options.nowSeconds ?? Math.floor(Date.now() / 1000);
  const session: AuthSession = {
    ...identity,
    issuedAt,
    expiresAt: issuedAt + SESSION_TTL_SECONDS,
  };
  const payload = bytesToBase64Url(encoder.encode(JSON.stringify(session)));
  const signature = new Uint8Array(
    await crypto.subtle.sign('HMAC', await importSigningKey(secret), encoder.encode(payload)),
  );
  return `${payload}.${bytesToBase64Url(signature)}`;
}

export async function verifySessionToken(
  token: string | undefined,
  options: { secret?: string; nowSeconds?: number } = {},
): Promise<AuthSession | null> {
  const secret = options.secret ?? sessionSecret();
  if (!token || !secret || secret.length < 32) return null;
  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra !== undefined) return null;

  try {
    const valid = await crypto.subtle.verify(
      'HMAC',
      await importSigningKey(secret),
      toArrayBuffer(base64UrlToBytes(signature)),
      encoder.encode(payload),
    );
    if (!valid) return null;
    const decoded = new TextDecoder().decode(base64UrlToBytes(payload));
    const candidate: unknown = JSON.parse(decoded);
    return isSession(candidate, options.nowSeconds ?? Math.floor(Date.now() / 1000))
      ? candidate
      : null;
  } catch {
    return null;
  }
}
