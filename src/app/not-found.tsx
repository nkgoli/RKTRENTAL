import { EmptyState } from '@/components/RouteStates';
import { Icon } from '@/components/shell/Icons';
import styles from './(auth)/auth.module.css';

export default function NotFound() {
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
          eyebrow="Page unavailable"
          icon="folder"
          headingLevel={1}
          title="Page not found"
          description="This link may have changed or the page is no longer available."
          action="Return to your account"
          href="/"
          variant="primary"
        />
      </div>
    </main>
  );
}
