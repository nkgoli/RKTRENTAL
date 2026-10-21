import { createHash } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { db } from '@/lib/db/client';
import { emailProvider } from '@/lib/notifications/provider';
import type { EmailMessage } from '@/lib/notifications/messages';
import { isSandboxEnabled } from '@/lib/providers/sandbox';
import { hashPassword } from './password';
import {
  createRecoveryToken,
  recoveryTokenClaims,
  verifyRecoveryToken,
  type RecoveryIdentity,
} from './recovery-token';

export type RecoveryUser = RecoveryIdentity & { email: string };
export interface RecoveryStore {
  findByEmail(email: string): Promise<RecoveryUser[]>;
  findById(id: string, organizationId: string): Promise<RecoveryUser | null>;
  replacePassword(user: RecoveryUser, passwordHash: string, updatedAt: Date): Promise<boolean>;
}

const select = { id: true, organizationId: true, email: true, passwordHash: true, updatedAt: true };
export function createRecoveryStore(client: Pick<PrismaClient, 'user'> = db): RecoveryStore {
  return {
    findByEmail: (email) =>
      client.user.findMany({
        where: { email: { equals: email, mode: 'insensitive' } },
        select,
        take: 2,
      }),
    findById: (id, organizationId) =>
      client.user.findFirst({ where: { id, organizationId }, select }),
    async replacePassword(user, passwordHash, updatedAt) {
      // A single atomic compare-and-set consumes every token issued for this credential version.
      // A concurrent reset can update at most one row; the loser must request a new link.
      const result = await client.user.updateMany({
        where: {
          id: user.id,
          organizationId: user.organizationId,
          passwordHash: user.passwordHash,
          updatedAt: user.updatedAt,
        },
        data: { passwordHash, updatedAt },
      });
      return result.count === 1;
    },
  };
}
export const recoveryStore = createRecoveryStore();

export function recoveryOrigin(
  requestOrigin: string | null,
  env: Record<string, string | undefined> = process.env,
): string {
  const configured = env.ROCKETRENTAL_APP_URL;
  const value = configured || (isSandboxEnabled(env) ? requestOrigin : null);
  if (!value) throw new Error('Recovery origin is unavailable');
  const url = new URL(value);
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== '/' ||
    (url.protocol !== 'https:' &&
      !(isSandboxEnabled(env) && loopback && url.protocol === 'http:')) ||
    (!configured && !loopback)
  )
    throw new Error('Recovery origin is unavailable');
  return url.origin;
}

type Options = { store?: RecoveryStore; now?: number; secret?: string };

/** Runs after the uniform public response so lookup/delivery timing cannot disclose accounts. */
export async function sendPasswordRecovery(
  email: string,
  origin: string,
  options: Options & { deliver?: (message: EmailMessage) => Promise<unknown> } = {},
): Promise<void> {
  const users = await (options.store ?? recoveryStore).findByEmail(email.trim().toLowerCase());
  // Sign-in requires a unique email across organizations too; do not guess an account.
  if (users.length !== 1) return;
  const user = users[0];
  const token = createRecoveryToken(user, options);
  const message: EmailMessage = {
    organizationId: user.organizationId,
    eventKey: `password-reset:${createHash('sha256').update(token).digest('hex')}`,
    kind: 'PASSWORD_RESET',
    recipient: user.email,
    subject: 'Reset your RocketRental password',
    body: `Use this link to choose a new password:\n\n${origin}/recover/${token}\n\nThis link expires in 15 minutes and can be used once. If you did not request this change, you can ignore this email. Your password has not changed.\n\nRocketRental`,
  };
  if (options.deliver) await options.deliver(message);
  else await (await emailProvider(user.organizationId)).send(message);
}

export async function recoveryUser(
  token: string,
  options: Options = {},
): Promise<RecoveryUser | null> {
  const claims = recoveryTokenClaims(token, options.now);
  if (!claims) return null;
  const user = await (options.store ?? recoveryStore).findById(
    claims.subjectId,
    claims.organizationId,
  );
  return user && verifyRecoveryToken(token, user, options) ? user : null;
}

export async function resetPassword(
  token: string,
  password: string,
  options: Options & { hash?: typeof hashPassword } = {},
): Promise<boolean> {
  if (password.length < 12 || password.length > 128) return false;
  const user = await recoveryUser(token, options);
  if (!user) return false;
  const passwordHash = await (options.hash ?? hashPassword)(password);
  // Recheck expiry after hashing; explicitly advance the version even within one millisecond.
  const now = options.now ?? Date.now();
  if (!verifyRecoveryToken(token, user, { ...options, now })) return false;
  return (options.store ?? recoveryStore).replacePassword(
    user,
    passwordHash,
    new Date(Math.max(now, user.updatedAt.getTime() + 1)),
  );
}
