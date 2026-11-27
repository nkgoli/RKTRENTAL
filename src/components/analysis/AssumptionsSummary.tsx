'use client';
import type { MouseEvent } from 'react';
import type { ValidationIssue } from '@/lib/analysis';
import styles from './analysis.module.css';

/** Baseline assumptions live on the property; tax options and scenarios stay in the analysis. */
export function isBaselinePath(path: string) {
  return /^(input|options)(\.|$)/.test(path) && !path.startsWith('options.tax');
}

/**
 * The header's meta line (units · revision · demo values) and, when inputs are missing, the
 * count with a guarded link to the first gap. Baseline inputs are maintained on Add/Edit
 * Property; the header's Edit assumptions action opens them.
 */
export function AssumptionsSummary({
  missing,
  incomplete,
  demoCount,
  completeHref,
  onEdit,
  meta = [],
}: {
  missing: ValidationIssue[];
  /** True when inputs are absent, rather than present but invalid or incalculable. */
  incomplete: boolean;
  demoCount: number;
  completeHref: string;
  /** Lets the workspace guard unsaved scenario or comparison edits before leaving. */
  onEdit: (event: MouseEvent<HTMLAnchorElement>, path?: string) => void;
  /** Leading meta items (units, revision). */
  meta?: string[];
}) {
  const items = [...meta, ...(demoCount > 0 ? [`${demoCount} demo values`] : [])];
  return (
    <section className={styles.assumptionsLink} aria-label="Baseline assumptions">
      {items.length > 0 && (
        <p className={styles.context}>
          {items.map((item) => (
            <span key={item}>{item}</span>
          ))}
        </p>
      )}
      {!!missing.length && (
        <p role="status" className={styles.missingNote}>
          {missing.length}{' '}
          {incomplete
            ? missing.length === 1
              ? 'input needed to calculate'
              : 'inputs needed to calculate'
            : missing.length === 1
              ? 'assumption to review'
              : 'assumptions to review'}
          .{' '}
          <a
            id="roi-complete-assumptions"
            href={completeHref}
            onClick={(event) => onEdit(event, missing[0]?.path)}
          >
            Complete assumptions
          </a>
        </p>
      )}
    </section>
  );
}
