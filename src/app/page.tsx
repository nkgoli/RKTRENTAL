import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/server-session';
import { roleHome } from '@/lib/auth/policy';

export default async function HomePage() {
  const session = await getSession();
  redirect(session ? roleHome(session.role) : '/sign-in');
}
