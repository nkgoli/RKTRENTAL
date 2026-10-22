import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import { validEmail } from '@/lib/notifications/reminder-content';

export class InvitationError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
  ) {
    super(message);
  }
}
export const fullName = z
  .string()
  .trim()
  .min(2, 'Enter your full name.')
  .max(120)
  .refine((v) => !/[\u0000-\u001f\u007f]/.test(v));
export const createInvitationInput = z
  .object({
    fullName,
    email: z.string().trim().toLowerCase().refine(validEmail, 'Enter one valid email address.'),
    propertyId: z.string().min(1).max(100),
    unitId: z.string().min(1).max(100),
    requestKey: z.string().uuid(),
  })
  .strict();
export const managerInvitationInput = z
  .object({
    intent: z.enum(['send', 'renew']),
    generation: z.number().int().positive(),
    requestKey: z.string().uuid(),
  })
  .strict();
export const applicantInput = z
  .object({
    token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
    fullName,
    intent: z.enum(['save', 'submit']),
    confirmed: z.boolean(),
  })
  .strict();
export type InvitationEnvironment = Record<string, string | undefined>;
export const INVITATION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;
export function invitationOrigin(env: InvitationEnvironment = process.env) {
  try {
    const url = new URL(env.APPLICATIONS_PUBLIC_ORIGIN ?? '');
    const local =
      env.ROCKETRENTAL_SANDBOX === 'true' &&
      ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (
      (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) ||
      url.username ||
      url.password ||
      url.pathname !== '/' ||
      url.search ||
      url.hash
    )
      throw new Error();
    return url.origin;
  } catch {
    throw new InvitationError(
      'Secure application links are unavailable. Ask your administrator to check invitation configuration.',
      503,
    );
  }
}
function key(env: InvitationEnvironment) {
  const secret = env.APPLICATIONS_INVITATION_SECRET;
  if (!secret || secret.length < 32)
    throw new InvitationError(
      'Secure application links are unavailable. Ask your administrator to check invitation configuration.',
      503,
    );
  return createHash('sha256').update(secret).digest();
}
export function tokenHash(token: string) {
  return createHash('sha256').update(token).digest('hex');
}
export function createInvitationToken(env: InvitationEnvironment = process.env) {
  const secret = key(env);
  const token = randomBytes(32).toString('base64url');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', secret, iv);
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return {
    tokenHash: tokenHash(token),
    tokenCipher: [iv, cipher.getAuthTag(), encrypted].map((v) => v.toString('base64url')).join('.'),
  };
}
export function invitationLink(tokenCipher: string, env: InvitationEnvironment = process.env) {
  const [iv, tag, encrypted] = tokenCipher.split('.').map((v) => Buffer.from(v, 'base64url'));
  try {
    const decipher = createDecipheriv('aes-256-gcm', key(env), iv);
    decipher.setAuthTag(tag);
    const token = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
    return `${invitationOrigin(env)}/apply/${token}`;
  } catch (error) {
    if (error instanceof InvitationError) throw error;
    throw new InvitationError(
      'This link cannot be recovered with the current invitation key. Restore the configured key.',
      503,
    );
  }
}
export const deliveryLabels: Record<string, string> = {
  SENDING: 'Email dispatch started · outcome pending',
  MOCK_RECORDED: 'Sandbox recorded · no email sent',
  ACCEPTED: 'Email accepted by provider · delivery unconfirmed',
  FAILED: 'Email failed · retry available',
  UNCONFIGURED: 'Email unavailable · link can be copied',
  UNCERTAIN: 'Email outcome unknown · automatic retry blocked',
};
export function invitationStatus(
  row: { submittedAt: Date | null; expiresAt: Date; draftSavedAt: Date | null },
  now = new Date(),
) {
  return row.submittedAt
    ? 'Submitted'
    : row.expiresAt <= now
      ? 'Expired'
      : row.draftSavedAt
        ? 'Draft saved'
        : 'Awaiting applicant';
}
