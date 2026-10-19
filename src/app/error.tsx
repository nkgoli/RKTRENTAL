'use client';

import { RouteError } from '@/components/RouteError';
import { Button } from '@/components/ui/Button';
import styles from './(auth)/auth.module.css';

export default function ErrorBoundary(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <RouteError {...props} tenant />
        <Button href="/" block>
          Return to your account
        </Button>
      </div>
    </main>
  );
}
