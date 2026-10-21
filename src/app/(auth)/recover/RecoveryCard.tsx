import type { ReactNode } from 'react';
import { Icon } from '@/components/shell/Icons';
import styles from '../auth.module.css';

export function RecoveryCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className={styles.page}>
      <section className={styles.card} aria-labelledby="recover-title">
        <div className={styles.cardHead}>
          <div className={styles.brand} aria-label="RocketRental">
            <span className={styles.brandMark} aria-hidden="true">
              <Icon name="brand" />
            </span>
            <span>
              RocketRental<span className={styles.period}>.</span>
            </span>
          </div>
          <div className={styles.heading}>
            <h1 id="recover-title">{title}</h1>
            <p className={styles.description}>{description}</p>
          </div>
        </div>
        <div className={styles.cardBody}>{children}</div>
      </section>
    </main>
  );
}
