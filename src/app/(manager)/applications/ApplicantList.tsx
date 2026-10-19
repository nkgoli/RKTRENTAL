'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import styles from './applications.module.css';

export function BackToApplicants() {
  return (
    <a
      href="#applicants"
      className={styles.backToList}
      onClick={(event) => {
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
          return;
        const list = document.getElementById('applicants');
        if (list instanceof HTMLDetailsElement) {
          // Do this on every activation: an unchanged fragment emits no hashchange.
          list.open = true;
          list.focus({ preventScroll: true });
        }
      }}
    >
      ↑ Back to applicants
    </a>
  );
}

export function ApplicantList({
  children,
  count,
  total,
}: {
  children: ReactNode;
  count: number;
  total: number;
}) {
  const list = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 640px)');
    const update = () => {
      if (list.current) list.current.open = !media.matches;
    };
    update();
    const reveal = () => {
      if (window.location.hash === '#applicants' && list.current) list.current.open = true;
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
    <details className={styles.listCard} id="applicants" tabIndex={-1} ref={list} open>
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
