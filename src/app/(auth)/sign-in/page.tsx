import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { roleHome } from '@/lib/auth/policy';
import { getSession } from '@/lib/auth/server-session';
import styles from '../auth.module.css';
import { signInAction } from './actions';

type SignInPageProps = {
  searchParams: Promise<{ error?: string; loggedOut?: string; next?: string }>;
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const session = await getSession();
  if (session) redirect(roleHome(session.role));
  const params = await searchParams;

  return (
    <main className={styles.page}>
      <section className={styles.card} aria-labelledby="sign-in-title">
        <div className={styles.brand} aria-label="RocketRental">
          <span className={styles.brandMark}>R</span>
          <span>RocketRental</span>
        </div>
        <p className={styles.eyebrow}>Secure account access</p>
        <h1 id="sign-in-title">Welcome back</h1>
        <p className={styles.description}>Sign in to manage your rental account.</p>

        {params.error === 'invalid' && (
          <p className={styles.error} role="alert">
            Email or password was not recognized.
          </p>
        )}
        {params.loggedOut && <p className={styles.success}>You have been signed out.</p>}

        <form className={styles.form} action={signInAction}>
          <input type="hidden" name="next" value={params.next ?? ''} />
          <label className={styles.field}>
            <span>Email address</span>
            <input autoComplete="username" name="email" type="email" required />
          </label>
          <label className={styles.field}>
            <span>Password</span>
            <input autoComplete="current-password" name="password" type="password" required />
          </label>
          <Button type="submit" variant="primary" block>
            Sign in
          </Button>
        </form>
        <p className={styles.footnote}>
          Your account role determines which RocketRental pages you can open.
        </p>
      </section>
    </main>
  );
}
