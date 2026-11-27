'use client';
import { useId, type MouseEvent } from 'react';
import {
  ACTUAL_PERIOD_KEYS,
  compareActualToProjection,
  type ActualWindow,
  type ComparisonRow,
  type PeriodChoice,
  type ProjectionYear,
} from '@/lib/analysis/actuals';
import type { Coverage } from '@/lib/returns/actual';
import type { PeriodKey } from '@/lib/returns/period';
import { estimateValue, pct, signed, usd, type ActualsState } from './RoiActuals';
import { groups, type Values } from './fields';
import styles from './returns-summary.module.css';

/**
 * Summary-tab panels of the combined Returns & ROI view (Designs/redisgn): what is still needed
 * to complete actuals, the actual-versus-projected table, the estimates that never count as
 * actual and every baseline input. Recorded, projected and estimated figures keep their own
 * labels; a missing record stays "Not recorded", never $0.
 */

const PERIOD_LABELS: Record<PeriodKey, string> = {
  MTD: 'Month to date',
  QTD: 'Quarter to date',
  YTD: 'Year to date',
  '12M': 'Last 12 months',
  '2Y': '2 years',
  '3Y': '3 years',
  '5Y': '5 years',
  ALL: 'All time',
  CUSTOM: 'Custom dates',
};

function WarningIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" className={styles.warn}>
      <path
        d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const coverageWord = (status: Coverage['status']) =>
  status === 'complete' ? 'complete' : status === 'partial' ? 'partial' : 'not recorded';

type Gap = {
  key: string;
  label: string;
  status: Coverage['status'];
  value: string;
  note?: string;
  href: string;
  link: string;
};

/** Rent, expense and loan-payment coverage for the period, each with where to complete it. */
export function ActualsToComplete({
  propertyId,
  state,
}: {
  propertyId: string;
  state: ActualsState;
}) {
  const id = useId();
  const data = state.status === 'ready' ? state.data : null;
  const base = `/properties/${encodeURIComponent(propertyId)}`;
  const items: Gap[] = [];
  if (data) {
    const rent = data.income.confirmedRent.coverage;
    const expenses = data.expenses.total.coverage;
    const debt = data.debtService.actual;
    const unclassified = data.income.receipts.filter(
      (r) => r.classification === 'mixed' || r.classification === 'unapplied',
    ).length;
    items.push(
      {
        key: 'rent',
        label: 'Rent records',
        status: rent.status,
        value: `${rent.observedDays} of ${rent.periodDays} days`,
        note: unclassified
          ? `${unclassified} unmatched ${unclassified === 1 ? 'receipt' : 'receipts'}`
          : undefined,
        href: data.income.excluded.undatedCount ? `${base}/payments` : `${base}/leases`,
        link: data.income.excluded.undatedCount ? 'Review payments →' : 'Review leases →',
      },
      {
        key: 'expenses',
        label: 'Expenses',
        status: expenses.status,
        value: `${expenses.observedDays} of ${expenses.periodDays} days`,
        href: `/returns?${new URLSearchParams({ property: propertyId, add: '1' })}#add-expense`,
        link: 'Add expense →',
      },
      debt.status === 'unavailable'
        ? {
            key: 'loan',
            label: 'Loan payments',
            status: 'none',
            value: 'Cash flow unavailable',
            href: `${base}/edit`,
            link: 'Review financing →',
          }
        : {
            key: 'loan',
            label: 'Loan payments',
            status: debt.coverage.status,
            value: debt.status === 'zero' ? 'Recorded $0' : `${usd(debt.cents)} recorded`,
            href: `${base}/edit`,
            link: 'Review financing →',
          },
    );
  }
  const incomplete = items.some((item) => item.status !== 'complete');
  return (
    <section className={`card ${styles.card}`} aria-labelledby={`${id}-title`}>
      <div className={styles.titleRow}>
        {(!data || incomplete) && <WarningIcon />}
        <h2 id={`${id}-title`}>
          {data && !incomplete ? 'Actuals coverage' : 'To complete actuals'}
        </h2>
      </div>
      {state.status === 'loading' && (
        <p role="status" className={styles.caption}>
          Loading recorded returns…
        </p>
      )}
      {state.status === 'error' && (
        <p role="status" className={styles.caption}>
          {state.message}
        </p>
      )}
      {items.length > 0 && (
        <ul className={styles.gaps}>
          {items.map((item) => (
            <li key={item.key} data-status={item.status}>
              <div>
                <p className={styles.gapLabel}>
                  {item.label} · {coverageWord(item.status)}
                </p>
                <p className={styles.gapValue}>
                  {item.value}
                  {item.note && <small> · {item.note}</small>}
                </p>
              </div>
              <a href={item.href}>{item.link}</a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function actualText(row: ComparisonRow) {
  const { actual } = row;
  if (actual.status === 'unavailable') return 'Not recorded';
  if (actual.status === 'partial') return `${usd(actual.cents)} · partial`;
  if (actual.status === 'zero') return usd(0);
  return usd(actual.cents);
}

/** Why a row has no difference: shown as a dash, with the reason for screen readers. */
function differenceReason(row: ComparisonRow) {
  return row.difference.reason === 'Actual not recorded'
    ? 'No actual to compare'
    : row.difference.reason === 'Actual is partial'
      ? 'Actual is partial, not compared'
      : (row.difference.reason ?? 'No projection yet');
}

/** Compact actual-versus-projected table with the shared period; the full view keeps export. */
export function ActualVsProjectedSummary({
  state,
  projection,
  stale,
  window: range,
  choice,
  onPeriod,
  onOpen,
}: {
  state: ActualsState;
  projection: ProjectionYear | null;
  stale: boolean;
  window: ActualWindow;
  choice: PeriodChoice;
  onPeriod: (choice: PeriodChoice) => void;
  /** Opens the full Actual vs projected view (custom dates, export and sources). */
  onOpen: () => void;
}) {
  const id = useId();
  const data = state.status === 'ready' ? state.data : null;
  const comparison = data ? compareActualToProjection(data, stale ? null : projection) : null;
  return (
    <section className={`card ${styles.card}`} aria-labelledby={`${id}-title`}>
      <div className={styles.headRow}>
        <div>
          <h2 id={`${id}-title`}>Actual vs projected</h2>
          <p className={styles.caption}>
            {range.label}
            {comparison ? ` · ${comparison.scaleLabel}` : ''}
          </p>
        </div>
        <label className={`field ${styles.period}`}>
          <span className={styles.srOnly}>Period</span>
          <select
            value={choice.key}
            disabled={state.status === 'loading'}
            onChange={(event) => {
              const key = event.target.value as PeriodKey;
              if (key === 'CUSTOM') onOpen();
              else onPeriod({ key });
            }}
          >
            {ACTUAL_PERIOD_KEYS.map((key) => (
              <option key={key} value={key}>
                {PERIOD_LABELS[key]}
              </option>
            ))}
            <option value="CUSTOM">{PERIOD_LABELS.CUSTOM}</option>
          </select>
        </label>
      </div>
      {state.status === 'loading' && <p role="status">Loading recorded returns…</p>}
      {state.status === 'error' && <p role="status">{state.message}</p>}
      {comparison && (
        <div
          className="table-region"
          role="region"
          tabIndex={0}
          aria-label="Actual and projected amounts, summary"
        >
          <table className={`table ${styles.table}`}>
            <thead>
              <tr>
                <th scope="col">Line</th>
                <th scope="col" className="num">
                  Actual
                </th>
                <th scope="col" className="num">
                  Projected
                </th>
                <th scope="col" className="num">
                  Difference
                </th>
              </tr>
            </thead>
            <tbody>
              {comparison.rows.map((row) => (
                <tr key={row.key}>
                  <th scope="row">{row.label}</th>
                  <td className="num" data-status={row.actual.status}>
                    {actualText(row)}
                  </td>
                  <td
                    className="num"
                    data-tone={(row.projected.cents ?? 0) < 0 ? 'loss' : undefined}
                  >
                    {row.projected.status === 'projected'
                      ? usd(row.projected.cents)
                      : 'No projection'}
                  </td>
                  <td
                    className="num"
                    data-tone={
                      row.difference.cents == null || row.difference.cents === 0
                        ? 'muted'
                        : row.difference.cents > 0 !== row.costLike
                          ? 'gain'
                          : 'loss'
                    }
                  >
                    {row.difference.cents != null ? (
                      signed(row.difference.cents)
                    ) : (
                      <>
                        <span aria-hidden="true">—</span>
                        <span className={styles.srOnly}>{differenceReason(row)}</span>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/** Scheduled and estimated amounts for the same period: never counted as actual. */
export function EstimatesPanel({ state }: { state: ActualsState }) {
  const id = useId();
  const data = state.status === 'ready' ? state.data : null;
  return (
    <section className={`card ${styles.card}`} aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>Scheduled and estimated</h2>
      {!data ? (
        <p className={styles.caption}>
          {state.status === 'error' ? state.message : 'Loading recorded returns…'}
        </p>
      ) : (
        <div className="table-region" role="region" tabIndex={0} aria-label="Estimates">
          <table className={`table ${styles.table}`}>
            <thead>
              <tr>
                <th scope="col">Estimate</th>
                <th scope="col" className="num">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {(
                [
                  ['Rent billed', estimateValue(data.scheduled.billedRent)],
                  ['Debt service', estimateValue(data.scheduled.debtService)],
                  [
                    'Cash flow after debt',
                    estimateValue(data.estimates.cashFlowAfterScheduledDebt),
                  ],
                  ['Annualized NOI', estimateValue(data.estimates.annualizedNoi)],
                  [
                    'Actual cap rate',
                    data.actual.periodCapRate.status === 'unavailable'
                      ? 'Unavailable'
                      : `${pct(data.actual.periodCapRate.value)}${data.actual.periodCapRate.status === 'partial' ? ' (partial)' : ''}`,
                  ],
                ] as const
              ).map(([label, value]) => (
                <tr key={label}>
                  <th scope="row">{label}</th>
                  <td className="num">{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

const shownValue = (label: string, raw: string | undefined) => {
  const value = raw?.trim() ?? '';
  if (!value) return 'Not set';
  if (value === 'true') return 'Yes';
  if (value === 'false') return 'No';
  const number = Number(value);
  if (!Number.isFinite(number) || /date/i.test(label)) return value.replaceAll('_', ' ');
  return number.toLocaleString('en-US', { maximumFractionDigits: 4 });
};

/**
 * Every baseline input, including the optional ones the analysis persists, read-only in the
 * units its label names. They are edited on the property; the tax estimate stays in the analysis.
 */
export function OptionalInputs({
  values,
  demoPaths,
  editHref,
  onEdit,
}: {
  values: Values;
  demoPaths: string[];
  editHref: string;
  onEdit: (event: MouseEvent<HTMLAnchorElement>) => void;
}) {
  return (
    <details className="disclosure plain">
      <summary>All assumptions</summary>
      <div className="disclosure-body">
        {groups.map((group) => (
          <div key={group.title} className={styles.inputGroup}>
            <h3>{group.title}</h3>
            <dl>
              {group.fields.map((field) => (
                <div key={field.path}>
                  <dt>
                    {field.label}
                    {field.optional ? ' · optional' : ''}
                  </dt>
                  <dd>
                    {shownValue(field.label, values[field.path])}
                    {demoPaths.includes(field.path) && (
                      <small className={styles.demo}> · demo value</small>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
        <div>
          <a className="btn btn-secondary btn-sm" href={editHref} onClick={onEdit}>
            Edit these inputs
          </a>
        </div>
      </div>
    </details>
  );
}
