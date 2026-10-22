import Link from 'next/link';
import type { ReactNode } from 'react';
import { cx } from './cx';

export type SummaryStat = {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  /** Makes the whole stat card a link to the page that explains the figure. */
  href?: string;
};

export type SummaryBandProps = {
  /** Primary uppercase label above the lead figure, e.g. "October 2026 · Rent collection". */
  eyebrow: string;
  value: ReactNode;
  detail?: ReactNode;
  /** Lead figure in danger red, for negative money only. */
  danger?: boolean;
  progress?: { label: string; value: number; tone?: 'primary' | 'accent'; valueText?: string };
  /** Row under the figure: a status line and its one action. */
  footer?: ReactNode;
  stats?: SummaryStat[];
  label?: string;
};

/**
 * The screen's single most important number in a white bordered surface (Designs/redisgn),
 * with quiet inset stat cards beside it on desktop and scrolling below it on phones.
 */
export function SummaryBand({
  eyebrow,
  value,
  detail,
  danger,
  progress,
  footer,
  stats = [],
  label,
}: SummaryBandProps) {
  const percent = progress ? Math.max(0, Math.min(100, Math.round(progress.value))) : 0;
  return (
    <section
      className={cx('summary-band', !stats.length && 'single')}
      aria-label={label ?? eyebrow}
    >
      <div className="summary-band-main">
        <p className="eyebrow">{eyebrow}</p>
        <p className={cx('summary-band-value', danger && 'danger')}>{value}</p>
        {detail && <p className="summary-band-detail">{detail}</p>}
        {progress && (
          <div className={cx('summary-band-progress', progress.tone === 'accent' && 'accent')}>
            <span>{progress.label}</span>
            <span
              className="bar"
              role="meter"
              aria-label={progress.label}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
              aria-valuetext={progress.valueText ?? `${percent}%`}
            >
              <span style={{ width: `${percent}%` }} />
            </span>
          </div>
        )}
        {footer && <div className="summary-band-foot">{footer}</div>}
      </div>
      {stats.length > 0 && (
        <div className="summary-band-stats">
          {stats.map((stat) => {
            const body = (
              <>
                <span className="summary-stat-label">{stat.label}</span>
                <strong>{stat.value}</strong>
                {stat.detail && <small>{stat.detail}</small>}
              </>
            );
            return stat.href ? (
              <Link key={stat.label} className="summary-stat" href={stat.href}>
                {body}
              </Link>
            ) : (
              <div key={stat.label} className="summary-stat">
                {body}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
