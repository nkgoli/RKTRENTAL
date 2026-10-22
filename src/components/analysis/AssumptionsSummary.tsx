'use client';
import type { MouseEvent, ReactNode } from 'react';
import type { AnalysisPayload, ValidationIssue, calculatePayload } from '@/lib/analysis';
import { fieldLabel } from './fields';
import styles from './analysis.module.css';

type Result = ReturnType<typeof calculatePayload>['base'];

/** Baseline assumptions live on the property; tax options and scenarios stay in the analysis. */
export function isBaselinePath(path: string) {
  return /^(input|options)(\.|$)/.test(path) && !path.startsWith('options.tax');
}

/**
 * The header's meta line (units · revision · assumption source · demo values) and, when inputs
 * are missing, the count with a guarded link to the first gap. Baseline inputs are maintained on
 * Add/Edit Property; the header's Edit assumptions action opens them.
 */
export function AssumptionsSummary({
  missing,
  incomplete,
  demoCount,
  completeHref,
  onEdit,
  meta,
}: {
  payload: AnalysisPayload;
  result: Result | null;
  stale: boolean;
  missing: ValidationIssue[];
  /** True when inputs are absent, rather than present but invalid or incalculable. */
  incomplete: boolean;
  demoCount: number;
  demoLabel?: string;
  source: string;
  editHref: string;
  completeHref: string;
  /** Lets the workspace guard unsaved scenario or comparison edits before leaving. */
  onEdit: (event: MouseEvent<HTMLAnchorElement>, path?: string) => void;
  /** Leading meta items (units, revision), each its own span. */
  meta?: ReactNode;
}) {
  return (
    <section className={styles.assumptionsLink} aria-label="Baseline assumptions">
      <p className={styles.context}>
        {meta}
        <span>Assumptions from property details</span>
        {demoCount > 0 && <span>{demoCount} demo values</span>}
      </p>
      {!!missing.length && (
        <p role="status" className={styles.missingNote}>
          {missing.length}{' '}
          {incomplete
            ? missing.length === 1
              ? 'input needed to calculate'
              : 'inputs needed to calculate'
            : 'assumptions to review'}
          . {fieldLabel(missing[0].path)}: {missing[0].message}{' '}
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
