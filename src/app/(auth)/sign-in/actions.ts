'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { authenticateCredentials } from '@/lib/auth/credentials';
import { safeRedirectTarget } from '@/lib/auth/policy';
import { INVALID_CREDENTIALS, validateSignIn, type SignInState } from '@/lib/auth/sign-in';
import {
  createSessionToken,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  sessionCookieSecure,
} from '@/lib/auth/session';

export async function signInAction(
  previousState: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const next = String(formData.get('next') ?? '');
  const errors = validateSignIn(email, password);
  const attempt = previousState.attempt + 1;
  if (Object.keys(errors).length) return { email: email.slice(0, 254), errors, attempt };
  const identity = await authenticateCredentials(email, password);
  if (!identity) return { email, message: INVALID_CREDENTIALS, attempt };

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, await createSessionToken(identity), {
    httpOnly: true,
    secure: sessionCookieSecure(),
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });
  redirect(safeRedirectTarget(next, identity.role));
}
