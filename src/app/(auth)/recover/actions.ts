'use server';

import { after } from 'next/server';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { CredentialAttemptLimiter } from '@/lib/auth/credentials';
import { recoveryOrigin, resetPassword, sendPasswordRecovery } from '@/lib/auth/recovery';
import {
  validateRecoveryEmail,
  validateResetPassword,
  type RecoveryRequestState,
  type ResetPasswordState,
} from '@/lib/auth/recovery-fields';
import { SESSION_COOKIE } from '@/lib/auth/session';
import { isSandboxEnabled } from '@/lib/providers/sandbox';

const requests = new CredentialAttemptLimiter();

export async function requestRecoveryAction(
  previous: RecoveryRequestState,
  formData: FormData,
): Promise<RecoveryRequestState> {
  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase();
  const attempt = previous.attempt + 1;
  const error = validateRecoveryEmail(email);
  if (error) return { email: email.slice(0, 254), error, attempt };
  const requestHeaders = await headers();
  let origin: string;
  try {
    origin = recoveryOrigin(requestHeaders.get('origin'));
    // The installed transport is the sandbox outbox; never claim a live delivery is available.
    if (!isSandboxEnabled()) throw new Error('Unavailable');
    if ((process.env.ROCKETRENTAL_AUTH_SECRET?.length ?? 0) < 32) throw new Error('Unavailable');
  } catch {
    return {
      email,
      error: 'Password recovery is temporarily unavailable. Please try again later.',
      attempt,
    };
  }
  const ip =
    requestHeaders.get('x-real-ip')?.trim() ||
    requestHeaders.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown';
  const keys = [`email:${email}`, `ip:${ip}`];
  const now = Date.now();
  if (!requests.isLocked(keys, now)) {
    requests.recordFailure(keys, now);
    // The public response has identical content and timing for every account lookup outcome.
    after(async () => {
      try {
        await sendPasswordRecovery(email, origin);
      } catch {
        console.warn('Password recovery delivery unavailable');
      }
    });
  }
  return { email, sent: true, attempt };
}

export async function resetPasswordAction(
  previous: ResetPasswordState,
  formData: FormData,
): Promise<ResetPasswordState> {
  const password = String(formData.get('password') ?? '');
  const confirmation = String(formData.get('confirmation') ?? '');
  const token = String(formData.get('token') ?? '');
  const attempt = previous.attempt + 1;
  const errors = validateResetPassword(password, confirmation);
  if (Object.keys(errors).length) return { errors, attempt };
  let changed: boolean;
  try {
    changed = await resetPassword(token, password);
  } catch {
    return { error: 'We could not change your password. Please try again.', attempt };
  }
  if (!changed)
    return {
      error: 'This reset link has expired or has already been used. Request a new link.',
      attempt,
    };
  // User.updatedAt changed atomically with the password, revoking every existing session.
  (await cookies()).delete(SESSION_COOKIE);
  redirect('/sign-in?reset=1');
}
