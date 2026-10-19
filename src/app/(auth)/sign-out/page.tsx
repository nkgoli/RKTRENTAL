import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/shell/Icons';
import { getSession } from '@/lib/auth/server-session';
import { roleHome } from '@/lib/auth/policy';
import styles from '../auth.module.css';
import { signOutAction } from './actions';

export default async function SignOutPage() {
  const session = await getSession();
  return (
    <main className={styles.page}>
      <section className={styles.card} aria-labelledby="sign-out-title">
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
            <p className={styles.eyebrow}>Secure account access</p>
            <h1 id="sign-out-title">Sign out</h1>
            <p className={styles.description}>
              {session ? `You are signed in as ${session.name}.` : 'You are already signed out.'}
            </p>
          </div>
        </div>
        <div className={styles.cardBody}>
          {session ? (
            <form className={styles.form} action={signOutAction}>
              <Button type="submit" variant="primary" block>
                Sign out of RocketRental
              </Button>
              <Button href={roleHome(session.role)} block>
                Stay signed in
              </Button>
            </form>
          ) : (
            <Button href="/sign-in" variant="primary" block>
              Go to sign in
            </Button>
          )}
        </div>
      </section>
    </main>
  );
}
