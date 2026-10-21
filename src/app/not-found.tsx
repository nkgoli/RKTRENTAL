import { EmptyState } from '@/components/RouteStates';
import { Icon } from '@/components/shell/Icons';
import { getSession } from '@/lib/auth/server-session';
import { roleHome } from '@/lib/auth/policy';
import { GoBackLink } from './(auth)/GoBackLink';
import styles from './(auth)/auth.module.css';

export default async function NotFound() {
  const session = await getSession();
  const href = session ? roleHome(session.role) : '/sign-in';
  const action =
    session?.role === 'MANAGER'
      ? 'Back to dashboard'
      : session?.role === 'TENANT'
        ? 'Back to home'
        : session
          ? 'Back to your account'
          : 'Sign in';
  return (
    <main className={styles.page}>
      <div className={styles.publicState}>
        <div className={styles.brand} aria-label="RocketRental">
          <span className={styles.brandMark} aria-hidden="true">
            <Icon name="brand" />
          </span>
          <span>
            RocketRental<span className={styles.period}>.</span>
          </span>
        </div>
        <EmptyState
          headingLevel={1}
          title="Page not found"
          description="This link may have changed or the page is no longer available."
          action={action}
          href={href}
          variant="primary"
        />
        <GoBackLink fallback={href} />
      </div>
    </main>
  );
}
