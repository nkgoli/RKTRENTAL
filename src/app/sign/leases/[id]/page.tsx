import { notFound, redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/server-session';
import { SigningPanel } from '@/components/lease-signing/SigningPanel';
import styles from '@/components/lease-signing/signing.module.css';
import { buildLeaseAccessWhere } from '@/lib/auth/policy';
import { db } from '@/lib/db/client';

export const dynamic = 'force-dynamic';
export default async function SigningPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) redirect(`/sign-in?next=${encodeURIComponent(`/sign/leases/${id}`)}`);
  const where = buildLeaseAccessWhere(session, id);
  if (!where || !(await db.lease.findFirst({ where, select: { id: true } }))) notFound();
  const documentsHref =
    session.role === 'TENANT'
      ? `/lease?lease=${id}#documents`
      : session.role === 'MANAGER'
        ? `/leases/${id}?tab=documents`
        : '#documents';
  return (
    <main className={styles.page}>
      <div className={styles.wrap}>
        <header className={styles.header}>
          <div className={styles.actions}>
            <a href={session.role === 'MANAGER' ? `/leases/${id}` : '/sign'}>Back to agreements</a>
            <a href="/sign-out">Sign out</a>
          </div>
          <h1>Review &amp; sign your lease</h1>
          <p>
            Signed in as {session.name} · {session.email}
          </p>
        </header>
        <SigningPanel leaseId={id} documentsHref={documentsHref} />
      </div>
    </main>
  );
}
