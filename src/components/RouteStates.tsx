import Link from 'next/link';
import { Icon } from './shell/Icons';
import { cx } from './ui/cx';
import styles from './route-states.module.css';

/**
 * One empty state, two sizes: `page` (icon, title, sentence, button) for list no-match views and
 * `inline` (a muted sentence with an optional link) for sections inside cards, kanban columns and
 * empty groups.
 */
export function EmptyState({
  title,
  description,
  action,
  href,
  eyebrow,
  icon,
  variant = 'secondary',
  headingLevel = 2,
  size = 'page',
}: {
  title: string;
  description?: string;
  action?: string;
  href?: string;
  eyebrow?: string;
  icon?: 'folder' | 'document' | 'tenants' | 'properties' | 'maintenance';
  variant?: 'primary' | 'secondary';
  headingLevel?: 1 | 2 | 3;
  size?: 'page' | 'inline';
}) {
  if (size === 'inline') {
    return (
      <p className={styles.inline}>
        <span>{title}</span>
        {description && <span className="muted"> {description}</span>}
        {action && href && (
          <>
            {' '}
            <Link href={href}>{action} →</Link>
          </>
        )}
      </p>
    );
  }
  const Heading = headingLevel === 1 ? 'h1' : headingLevel === 3 ? 'h3' : 'h2';
  const iconName =
    icon === 'folder'
      ? 'documents'
      : icon === 'document'
        ? 'leases'
        : icon === undefined
          ? undefined
          : icon;

  return (
    <section className={styles.empty}>
      {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
      {iconName && (
        <span className={styles.stateMark} aria-hidden="true">
          <Icon name={iconName} />
        </span>
      )}
      <Heading>{title}</Heading>
      {description && <p>{description}</p>}
      {action && href && (
        <div className={styles.actions}>
          <Link className={`btn btn-${variant}`} href={href}>
            {action}
          </Link>
        </div>
      )}
    </section>
  );
}

/**
 * Content-area skeleton. The page header stays in place (it is rendered by the shell), so only
 * the content shimmers, shaped like the destination: a KPI row and rows for lists, a hero and
 * two cards for detail pages, a tab strip plus a chart block for analysis.
 */
export function LoadingState({
  tenant = false,
  variant = 'list',
}: {
  tenant?: boolean;
  variant?: 'list' | 'detail' | 'analysis';
}) {
  return (
    <div
      className={cx(styles.loading, styles[variant])}
      role="status"
      aria-live="polite"
      aria-label="Loading page"
      aria-busy="true"
    >
      <span className={styles.srOnly}>Loading page…</span>
      {tenant && <div className={styles.heading} aria-hidden="true" />}
      {variant === 'analysis' && <div className={styles.tabs} aria-hidden="true" />}
      {variant !== 'detail' && (
        <div className={styles.grid} aria-hidden="true">
          <div className={styles.tile} />
          <div className={styles.tile} />
          <div className={styles.tile} />
          {variant === 'analysis' && <div className={styles.tile} />}
        </div>
      )}
      <div className={cx(styles.hero, variant === 'analysis' && styles.chart)} aria-hidden="true">
        <div className={styles.lineShort} />
        <div className={styles.lineLong} />
        <div className={styles.lineMedium} />
        {variant === 'list' && (
          <>
            <div className={styles.lineLong} />
            <div className={styles.lineMedium} />
            <div className={styles.lineLong} />
          </>
        )}
      </div>
      {variant === 'detail' && (
        <div className={styles.grid2} aria-hidden="true">
          <div className={styles.hero}>
            <div className={styles.lineShort} />
            <div className={styles.lineLong} />
          </div>
          <div className={styles.hero}>
            <div className={styles.lineShort} />
            <div className={styles.lineMedium} />
          </div>
        </div>
      )}
    </div>
  );
}
