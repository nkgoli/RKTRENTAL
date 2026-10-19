'use client';

import { RouteError } from '@/components/RouteError';
import { Icon } from '@/components/shell/Icons';
import styles from './(auth)/auth.module.css';

export default function ErrorBoundary(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
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
        <RouteError {...props} homeHref="/" homeLabel="Return to your account" />
      </div>
    </main>
  );
}
