'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import styles from './route-states.module.css';

export function RouteError({
  error,
  reset,
  homeHref,
  homeLabel,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  homeHref?: string;
  homeLabel?: string;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section className={styles.error} role="alert">
      <p className={styles.eyebrow}>Page unavailable</p>
      <h2>Something went wrong</h2>
      <p>We couldn’t load this page. Please try again.</p>
      <div className={styles.actions}>
        <button className="btn btn-primary" onClick={reset} type="button">
          Try again
        </button>
        {homeHref && homeLabel && (
          <Link className="btn btn-secondary" href={homeHref}>
            {homeLabel}
          </Link>
        )}
      </div>
    </section>
  );
}
