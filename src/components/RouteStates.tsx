import Link from 'next/link';
import styles from './route-states.module.css';

export function EmptyState({
  title,
  description,
  action,
  href,
}: {
  title: string;
  description: string;
  action: string;
  href: string;
}) {
  return (
    <div className={styles.empty} role="status">
      <div className={styles.emptyMark} aria-hidden="true">＋</div>
      <h2>{title}</h2>
      <p>{description}</p>
      <Link className="btn btn-primary" href={href}>{action}</Link>
    </div>
  );
}

export function LoadingState({ tenant = false }: { tenant?: boolean }) {
  return (
    <div className={styles.loading} role="status" aria-live="polite" aria-label="Loading page">
      <span className={styles.srOnly}>Loading page…</span>
      {tenant && <div className={styles.heading} aria-hidden="true" />}
      <div className={styles.hero} aria-hidden="true">
        <div className={styles.lineShort} />
        <div className={styles.lineLong} />
        <div className={styles.lineMedium} />
      </div>
      <div className={styles.grid} aria-hidden="true">
        <div className={styles.tile} /><div className={styles.tile} /><div className={styles.tile} />
      </div>
      <div className={styles.hero} aria-hidden="true">
        <div className={styles.lineMedium} />
        <div className={styles.lineLong} />
      </div>
    </div>
  );
}
