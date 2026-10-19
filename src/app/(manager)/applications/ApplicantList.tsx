'use client';

import { useEffect, useState, type ReactNode } from 'react';
import styles from './applications.module.css';

export function ApplicantList({
  children,
  count,
  total,
}: {
  children: ReactNode;
  count: number;
  total: number;
}) {
  const [open, setOpen] = useState(true);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 640px)');
    const update = () => setOpen(!media.matches);
    update();
    const reveal = () => {
      if (window.location.hash === '#applicants') setOpen(true);
    };
    reveal();
    window.addEventListener('hashchange', reveal);
    media.addEventListener('change', update);
    return () => {
      media.removeEventListener('change', update);
      window.removeEventListener('hashchange', reveal);
    };
  }, []);
  return (
    <details
      className={styles.listCard}
      id="applicants"
      tabIndex={-1}
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className={styles.listHeader}>
        <span>
          <strong id="applicants-title">Applicants</strong>
          <small>
            {count === total ? `${total} applications` : `${count} of ${total} applications`}
          </small>
        </span>
      </summary>
      {children}
    </details>
  );
}
