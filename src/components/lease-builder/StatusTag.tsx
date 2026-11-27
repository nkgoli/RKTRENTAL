import type { ReactNode } from 'react';
import styles from './lease-builder.module.css';
import { cx } from './summary';

export type StatusTone = 'ok' | 'info' | 'warn' | 'neutral';

/** A small status label (dot + text) whose colours keep 4.5:1 contrast at 12px. */
export function StatusTag({ tone, children }: { tone: StatusTone; children: ReactNode }) {
  return <span className={cx(styles.status, styles[`status_${tone}`])}>{children}</span>;
}
