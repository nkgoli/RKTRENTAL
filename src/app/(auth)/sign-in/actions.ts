'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { authenticateCredentials } from '@/lib/auth/credentials';
import { safeRedirectTarget } from '@/lib/auth/policy';
import { createSessionToken, SESSION_COOKIE, SESSION_TTL_SECONDS } from '@/lib/auth/session';

export async function signInAction(formData: FormData): Promise<void> {
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');
  const next = String(formData.get('next') ?? '');
  const identity = await authenticateCredentials(email, password);
  if (!identity) redirect('/sign-in?error=invalid');

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, await createSessionToken(identity), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });
  redirect(safeRedirectTarget(next, identity.role));
}
