import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getSession } from '@/lib/auth/server-session';
import { LeaseAgreementList } from '@/components/lease-signing/LeaseAgreementList';
import styles from '@/components/lease-signing/signing.module.css';

export const dynamic = 'force-dynamic';
export default async function AgreementsPage() {
  const session = await getSession();
  if (!session) redirect('/sign-in?next=/sign');
  return (
    <main className={styles.page}>
      <div className={styles.wrap}>
        <header className={styles.header}>
          <p>RocketRental</p>
          <h1>Lease agreements</h1>
          <a href="/sign-out">Sign out</a>
        </header>
        <LeaseAgreementList session={session} tenantPortal={session.role === 'TENANT'} />
        {session.role === 'MANAGER' && <Link href="/leases">Manage leases</Link>}
      </div>
    </main>
  );
}
