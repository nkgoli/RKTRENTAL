'use client';

import Link from 'next/link';
import styles from './auth.module.css';

export function GoBackLink({ fallback }: { fallback: string }) {
  return (
    <Link
      className={styles.textLink}
      href={fallback}
      onClick={(event) => {
        if (
          !event.metaKey &&
          !event.ctrlKey &&
          !event.shiftKey &&
          !event.altKey &&
          window.history.length > 1
        ) {
          event.preventDefault();
          window.history.back();
        }
      }}
    >
      Go back
    </Link>
  );
}
