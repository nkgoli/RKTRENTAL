import { cookies } from 'next/headers';
import { SESSION_COOKIE, verifySessionToken } from './session';

export async function getSession() {
  const cookieStore = await cookies();
  return verifySessionToken(cookieStore.get(SESSION_COOKIE)?.value);
}
