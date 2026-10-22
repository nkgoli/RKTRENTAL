'use client';

import type { ReactNode } from 'react';
import styles from './applications.module.css';

/** Phone-only link from the selected applicant back up to the list. */
export function BackToApplicants() {
  return (
    <a
      href="#applicants"
      className={styles.backToList}
      onClick={(event) => {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
          return;
        // Do this on every activation: an unchanged fragment emits no hashchange.
        document.getElementById('applicants')?.focus({ preventScroll: true });
      }}
    >
      ↑ Back to applicants
    </a>
  );
}

/** The Applicants card: title, count caption, then filters and the list rows passed as children. */
export function ApplicantList({
  children,
  count,
  total,
}: {
  children: ReactNode;
  count: number;
  total: number;
}) {
  return (
    <section
      className={`card ${styles.listCard}`}
      id="applicants"
      tabIndex={-1}
      aria-labelledby="applicants-title"
    >
      <div className={styles.listHeader}>
        <h2 id="applicants-title">Applicants</h2>
        <p>
          {count === total ? `${total} applications` : `${count} of ${total} applications`} · newest
          first
        </p>
      </div>
      {children}
    </section>
  );
}
