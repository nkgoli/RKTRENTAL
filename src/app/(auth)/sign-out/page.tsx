import { Button } from '@/components/ui/Button';
import { getSession } from '@/lib/auth/server-session';
import styles from '../auth.module.css';
import { signOutAction } from './actions';

export default async function SignOutPage() {
  const session = await getSession();
  return (
    <main className={styles.page}>
      <section className={styles.card} aria-labelledby="sign-out-title">
        <div className={styles.brand} aria-label="RocketRental">
          <span className={styles.brandMark}>R</span>
          <span>RocketRental</span>
        </div>
        <p className={styles.eyebrow}>Secure account access</p>
        <h1 id="sign-out-title">Sign out</h1>
        <p className={styles.description}>
          {session ? `You are signed in as ${session.name}.` : 'You are already signed out.'}
        </p>
        {session ? (
          <form className={styles.form} action={signOutAction}>
            <Button type="submit" variant="primary" block>
              Sign out of RocketRental
            </Button>
          </form>
        ) : (
          <Button href="/sign-in" variant="primary" block>
            Go to sign in
          </Button>
        )}
      </section>
    </main>
  );
}
