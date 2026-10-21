'use client';
import { useId, useState, type MouseEvent } from 'react';
import type { AnalysisPayload, ValidationIssue, calculatePayload } from '@/lib/analysis';
import { fieldLabel } from './fields';
import styles from './analysis.module.css';

type Result = ReturnType<typeof calculatePayload>['base'];

/** Baseline assumptions live on the property; tax options and scenarios stay in the analysis. */
export function isBaselinePath(path: string) {
  return /^(input|options)(\.|$)/.test(path) && !path.startsWith('options.tax');
}

const money = (v: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(v);
const pct = (v: number) => `${Number(v.toFixed(2))}%`;
const known = (v: number | undefined): v is number => typeof v === 'number';

/** Read-only digest of the baseline; display rounding only, the calculation keeps full precision. */
export function AssumptionsSummary({
  payload,
  result,
  stale,
  missing,
  incomplete,
  demoCount,
  demoLabel,
  source,
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
  const [open, setOpen] = useState(false);
  const detailsId = useId();
  const { purchase = {}, financing = {}, income = {}, appreciationExit = {} } = payload.input;
  const loan = financing.loanAmount;
  const financingText =
    loan === 0
      ? 'All cash'
      : [
          known(loan)
            ? `${money(loan)} loan`
            : known(financing.downPaymentPercent)
              ? `${pct(financing.downPaymentPercent)} down`
              : null,
          known(financing.interestRate) ? `at ${pct(financing.interestRate)}` : null,
          known(financing.loanTermYears) ? `${financing.loanTermYears} yr` : null,
        ]
          .filter(Boolean)
          .join(' ') || null;
  const items: [string, string | null][] = [
    ['Purchase price', known(purchase.purchasePrice) ? money(purchase.purchasePrice) : null],
    ['Financing', financingText],
    [
      'Scheduled rent',
      known(income.monthlyRent)
        ? `${money(income.monthlyRent)}/mo${income.otherMonthlyIncome ? ` + ${money(income.otherMonthlyIncome)} other` : ''}`
        : null,
    ],
    ['Vacancy', known(income.vacancyRate) ? pct(income.vacancyRate) : null],
    [
      'Operating expenses',
      result ? `${money(result.summaryMetrics.totalOperatingExpenses)}/yr` : null,
    ],
    [
      'Growth',
      known(income.annualRentGrowth) || known(appreciationExit.annualAppreciation)
        ? [
            known(income.annualRentGrowth) ? `Rent ${pct(income.annualRentGrowth)}` : null,
            known(appreciationExit.annualAppreciation)
              ? `Value ${pct(appreciationExit.annualAppreciation)}`
              : null,
          ]
            .filter(Boolean)
            .join(' · ')
        : null,
    ],
    [
      'Hold period',
      known(appreciationExit.holdingPeriodYears)
        ? `${appreciationExit.holdingPeriodYears} years`
        : null,
    ],
  ];
  // One compact row by default so results lead; the full digest opens on demand.
  return (
    <section className={`${styles.card} ${styles.summary}`} aria-label="Baseline assumptions">
      <div className={styles.summaryHead}>
        <h2>Assumptions</h2>
        <span className={styles.summarySource}>{source}</span>
        {!missing.length && (
          <span className={styles.summaryState} role="status">
            {result && !stale
              ? 'Calculated automatically from your current assumptions.'
              : result
                ? 'Out of date - correct the entries to review; results update automatically.'
                : 'Review your assumptions to calculate. No valid projection is available yet.'}
          </span>
        )}
        <span className={styles.summaryActions}>
          <button
            type="button"
            aria-expanded={open}
            aria-controls={detailsId}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? 'Hide details' : 'Show details'}
          </button>
          <a
            className={`btn btn-secondary ${styles.editLink}`}
            href={editHref}
            onClick={(event) => onEdit(event)}
          >
            Edit assumptions
          </a>
        </span>
      </div>
      <dl id={detailsId} className={styles.summaryGrid} hidden={!open}>
        {items.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd className={value ? undefined : styles.missingValue}>
              {value ?? (label === 'Operating expenses' ? 'Not calculated' : 'Missing')}
            </dd>
          </div>
        ))}
      </dl>
      {!!missing.length && (
        <p className={styles.missing} role="status">
          <strong>
            {incomplete
              ? `${missing.length} ${missing.length === 1 ? 'input' : 'inputs'} needed to calculate.`
              : `${missing.length} ${missing.length === 1 ? 'assumption' : 'assumptions'} to review.`}
          </strong>{' '}
          {fieldLabel(missing[0].path)}: {missing[0].message} No missing costs or rates are assumed.{' '}
          <a
            id="roi-complete-assumptions"
            href={completeHref}
            onClick={(event) => onEdit(event, missing[0]?.path)}
          >
            Complete assumptions
          </a>
        </p>
      )}
      {demoCount > 0 && (
        <p className={styles.demo} data-demo-assumptions={demoCount}>
          Sample data: {demoCount} assumption{demoCount === 1 ? ' is a' : 's are'} fictional demo
          value{demoCount === 1 ? '' : 's'} ({demoLabel}), not recorded actuals.
        </p>
      )}
    </section>
  );
}
