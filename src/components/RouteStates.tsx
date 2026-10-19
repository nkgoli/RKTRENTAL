import Link from 'next/link';
import { Icon } from './shell/Icons';
import styles from './route-states.module.css';

export function EmptyState({
  title,
  description,
  action,
  href,
  eyebrow,
  icon,
  variant = 'secondary',
}: {
  title: string;
  description: string;
  action: string;
  href: string;
  eyebrow?: string;
  icon?: 'folder' | 'document';
  variant?: 'primary' | 'secondary';
}) {
  return (
    <section className={styles.empty}>
      {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
      {icon && (
        <span className={styles.stateMark} aria-hidden="true">
          <Icon name={icon === 'folder' ? 'documents' : 'leases'} />
        </span>
      )}
      <h2>{title}</h2>
      <p>{description}</p>
      <div className={styles.actions}>
        <Link className={`btn btn-${variant}`} href={href}>
          {action}
        </Link>
      </div>
    </section>
  );
}

export function LoadingState({ tenant = false }: { tenant?: boolean }) {
  return (
    <div className={styles.loading} role="status" aria-live="polite" aria-label="Loading page">
      <span className={styles.loadingLabel}>
        <span className={styles.spinner} aria-hidden="true" />
        Loading page…
      </span>
      {tenant && <div className={styles.heading} aria-hidden="true" />}
      <div className={styles.hero} aria-hidden="true">
        <div className={styles.lineShort} />
        <div className={styles.lineLong} />
        <div className={styles.lineMedium} />
      </div>
      <div className={styles.grid} aria-hidden="true">
        <div className={styles.tile} />
        <div className={styles.tile} />
        <div className={styles.tile} />
      </div>
      <div className={styles.hero} aria-hidden="true">
        <div className={styles.lineMedium} />
        <div className={styles.lineLong} />
      </div>
    </div>
  );
}
