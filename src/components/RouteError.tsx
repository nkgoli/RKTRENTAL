'use client';

import { useEffect } from 'react';
import styles from './route-states.module.css';

export function RouteError({
  error,
  reset,
  tenant = false,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  tenant?: boolean;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section className={styles.error} role="alert">
      {tenant ? <h1>Something went wrong</h1> : <h2>Something went wrong</h2>}
      <p>We couldn’t load this page. Please try again.</p>
      <button className="btn btn-primary" onClick={reset} type="button">
        Try again
      </button>
    </section>
  );
}
