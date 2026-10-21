import { redirect } from 'next/navigation';
import { roleHome } from '@/lib/auth/policy';
import { getSession } from '@/lib/auth/server-session';
import { Icon } from '@/components/shell/Icons';
import styles from '../auth.module.css';
import { SignInForm } from './SignInForm';

type SignInPageProps = {
  searchParams: Promise<{
    error?: string;
    loggedOut?: string;
    next?: string;
    email?: string;
    reset?: string;
  }>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const session = await getSession();
  if (session) redirect(roleHome(session.role));
  const params = await searchParams;

  return (
    <main className={styles.page}>
      <section className={styles.card} aria-labelledby="sign-in-title">
        <div className={styles.cardHead}>
          <div className={styles.brand} aria-label="RocketRental">
            <span className={styles.brandMark} aria-hidden="true">
              <Icon name="brand" />
            </span>
            <span>
              RocketRental<span className={styles.period}>.</span>
            </span>
          </div>
          <div className={styles.heading}>
            <h1 id="sign-in-title">Welcome back</h1>
            <p className={styles.description}>Sign in to manage your rental account.</p>
          </div>
        </div>
        <div className={styles.cardBody}>
          {params.reset === '1' && (
            <p className={styles.success} role="status">
              Your password has been changed. Sign in with your new password.
            </p>
          )}
          {params.loggedOut && (
            <p className={styles.success} role="status">
              You have been signed out.
            </p>
          )}

          <SignInForm
            next={params.next ?? ''}
            invalid={params.error === 'invalid'}
            email={params.email?.slice(0, 254) ?? ''}
          />
          <p className={styles.footnote}>Need an account? Ask your property manager.</p>
        </div>
      </section>
    </main>
  );
}
