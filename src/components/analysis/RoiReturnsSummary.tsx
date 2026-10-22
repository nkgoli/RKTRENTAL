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
import { MoreDetail } from './RoiChart';
import { groups, type Values } from './fields';
import styles from './returns-summary.module.css';

/**
 * Summary-tab panels of the combined Returns & ROI view (Designs/redisgn): what is still needed
 * to complete actuals, the actual-versus-projected table, the estimates that never count as
 * actual, the optional inputs and the method note. Recorded, projected and estimated figures
 * keep their own labels; a missing record stays "Not recorded", never $0.
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
  heading: string;
  note: string;
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
    items.push(
      {
        key: 'rent',
        label: 'Rent records',
        status: rent.status,
        heading: `${rent.observedDays} of ${rent.periodDays} days evidenced`,
        note:
          rent.status === 'complete'
            ? 'Every day of the period has a recorded rent charge.'
            : (rent.gaps[0] ?? 'No lease rent charge covers this period.'),
        href: data.income.excluded.undatedCount ? `${base}/payments` : `${base}/leases`,
        link: data.income.excluded.undatedCount ? 'Review payments →' : 'Review leases →',
      },
      {
        key: 'expenses',
        label: 'Expenses',
        status: expenses.status,
        heading: `${expenses.observedDays} of ${expenses.periodDays} days recorded`,
        note:
          expenses.status === 'complete'
            ? 'Every month of the period has a recorded expense.'
            : `${expenses.gaps[0] ?? 'Months without a recorded expense'} · unverified, not $0`,
        href: `/returns?${new URLSearchParams({ property: propertyId, add: '1' })}#add-expense`,
        link: 'Add expense →',
      },
      debt.status === 'unavailable'
        ? {
            key: 'loan',
            label: 'Loan payments',
            status: 'none',
            heading: 'Actual cash flow unavailable',
            note:
              data.scheduled.debtService.status === 'unavailable'
                ? 'Financing is unknown. Enter the loan amount (0 for a cash purchase).'
                : 'Estimates use scheduled debt service.',
            href: `${base}/edit`,
            link: 'Review financing →',
          }
        : {
            key: 'loan',
            label: 'Loan payments',
            status: debt.coverage.status,
            heading: debt.status === 'zero' ? 'Recorded $0' : `${usd(debt.cents)} recorded`,
            note: debt.coverage.gaps[0] ?? 'Recorded loan payments count toward cash flow.',
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
      {items.map((item) => (
        <div key={item.key} className={styles.gap}>
          <p className={`eyebrow ${item.status === 'none' ? styles.dangerText : ''}`}>
            {item.label} · {coverageWord(item.status)}
          </p>
          <h3 className={item.status === 'none' ? styles.dangerText : undefined}>{item.heading}</h3>
          <p className={styles.small}>{item.note}</p>
          <a href={item.href}>{item.link}</a>
        </div>
      ))}
    </section>
  );
}

function actualText(row: ComparisonRow) {
  const { actual } = row;
  if (actual.status === 'unavailable') return 'Not recorded';
  if (actual.status === 'partial') return `${usd(actual.cents)} · partial`;
  if (actual.status === 'zero') return `${usd(0)} · recorded`;
  return usd(actual.cents);
}

function differenceText(row: ComparisonRow) {
  if (row.difference.cents != null) return signed(row.difference.cents);
  return row.difference.reason === 'Actual not recorded'
    ? 'No actual to compare'
    : row.difference.reason === 'Actual is partial'
      ? 'Actual is partial · not compared'
      : (row.difference.reason ?? 'No projection yet');
}

/** Compact actual-versus-projected table with the shared period; the full view keeps export. */
export function ActualVsProjectedSummary({
  state,
  projection,
  stale,
  window: range,
  choice,
  projectionBasis,
  onPeriod,
  onOpen,
}: {
  state: ActualsState;
  projection: ProjectionYear | null;
  stale: boolean;
  window: ActualWindow;
  choice: PeriodChoice;
  projectionBasis: string;
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
            Whole property · {range.label}
            {range.throughToday ? ' (through today)' : ''}
            {comparison ? ` · ${comparison.scaleLabel}` : ''} · USD
          </p>
        </div>
        <label className={`field ${styles.period}`}>
          Period
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
      <p className={styles.caption}>
        Actual = recorded cash · Projected = Year 1 assumptions scaled to the period · Partial =
        records missing for part of the period
      </p>
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
                  Actual (recorded)
                </th>
                <th scope="col" className="num">
                  Projected (ROI assumptions)
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
                    {differenceText(row)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className={styles.footRow}>
        <p className={styles.caption}>
          Projection source: {stale ? 'none until assumptions are complete' : projectionBasis}.
        </p>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onOpen}>
          Open full comparison →
        </button>
      </div>
    </section>
  );
}

/** Scheduled and estimated amounts for the same period: never counted as actual. */
export function EstimatesPanel({ state }: { state: ActualsState }) {
  const id = useId();
  const data = state.status === 'ready' ? state.data : null;
  return (
    <section className={styles.inset} aria-labelledby={`${id}-title`}>
      <p className="eyebrow">Estimates · never counted as actual</p>
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
                  ['Rent billed (scheduled)', estimateValue(data.scheduled.billedRent)],
                  ['Debt service (scheduled)', estimateValue(data.scheduled.debtService)],
                  [
                    'Cash flow after scheduled debt',
                    estimateValue(data.estimates.cashFlowAfterScheduledDebt),
                  ],
                  ['NOI annualized from actuals', estimateValue(data.estimates.annualizedNoi)],
                  [
                    'Actual cap rate for the period',
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
      <MoreDetail summary="Sources and coverage">
        <p className={styles.small}>
          Actual: payments and expenses you record. Projected: ROI assumptions. Scheduled: lease
          charges and loan schedule.
        </p>
        {data && (
          <ul className={styles.sources}>
            {(
              [
                ['Rent records', data.income.confirmedRent.coverage],
                ['Expense records', data.expenses.total.coverage],
              ] as const
            ).map(([label, coverage]) => (
              <li key={label}>
                <strong>{label}</strong> · {coverageWord(coverage.status)} · {coverage.observedDays}{' '}
                of {coverage.periodDays} days
                {coverage.recordedFrom
                  ? ` · records ${coverage.recordedFrom} to ${coverage.recordedTo}`
                  : ''}
              </li>
            ))}
          </ul>
        )}
      </MoreDetail>
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
 * units its label names. They are edited on the property; tax options stay in Scenarios.
 */
export function OptionalInputs({
  values,
  demoPaths,
  editHref,
  onEdit,
  onTax,
}: {
  values: Values;
  demoPaths: string[];
  editHref: string;
  onEdit: (event: MouseEvent<HTMLAnchorElement>) => void;
  onTax: () => void;
}) {
  return (
    <details className={`disclosure ${styles.inputs}`}>
      <summary>
        <span>
          Optional ROI inputs
          <small className={styles.summaryNote}>
            Purchase price, loan rate, vacancy, reserves, rent and expense growth, hold period, sale
            proceeds
          </small>
        </span>
      </summary>
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
        <div className={styles.inputActions}>
          <a className="btn btn-secondary btn-sm" href={editHref} onClick={onEdit}>
            Edit these inputs
          </a>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onTax}>
            Tax estimate in Scenarios →
          </button>
        </div>
      </div>
    </details>
  );
}

/** Plain-language method note opened from the summary band. */
export function HowCalculated({ id }: { id: string }) {
  return (
    <details className={`disclosure ${styles.inputs}`} id={id}>
      <summary>How returns are calculated</summary>
      <div className="disclosure-body">
        <ul className={styles.sources}>
          <li>
            <strong>Projected</strong> figures come from the ROI assumptions: effective income less
            operating expenses is NOI; NOI less debt service and capital reserves is cash flow. All
            are before tax unless the optional tax estimate is on.
          </li>
          <li>
            <strong>Cash-on-cash</strong> is Year 1 cash flow ÷ total cash invested.{' '}
            <strong>Cap rate</strong> is Year 1 NOI ÷ purchase price.{' '}
            <strong>Debt service coverage</strong> is Year 1 NOI ÷ annual debt service.
          </li>
          <li>
            <strong>Actual</strong> figures are recorded cash: settled rent payments by paid date
            and expenses by date. A missing record stays Not recorded, never $0.
          </li>
          <li>
            <strong>Estimates</strong> such as scheduled rent and scheduled debt service are shown
            separately and never counted as actual.
          </li>
        </ul>
      </div>
    </details>
  );
}
