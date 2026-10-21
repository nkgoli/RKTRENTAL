'use client';
import type { MouseEvent } from 'react';
import type { AnalysisPayload, ValidationIssue, calculatePayload } from '@/lib/analysis';
import { fieldLabel } from './fields';
import styles from './analysis.module.css';

type Result = ReturnType<typeof calculatePayload>['base'];

/** Baseline assumptions live on the property; tax options and scenarios stay in the analysis. */
export function isBaselinePath(path: string) {
  return /^(input|options)(\.|$)/.test(path) && !path.startsWith('options.tax');
}

/** Read-only digest of the baseline; display rounding only, the calculation keeps full precision. */
export function AssumptionsSummary({
  missing,
  incomplete,
  demoCount,
  editHref,
  completeHref,
  onEdit,
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
}) {
  return (
    <section className={styles.assumptionsLink} aria-label="Baseline assumptions">
      <span>
        Assumptions from property details{demoCount > 0 ? ` · ${demoCount} demo values` : ''}
      </span>
      <a href={editHref} onClick={(event) => onEdit(event)}>
        Edit property assumptions
      </a>
      {!!missing.length && (
        <p role="status">
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
