'use client';
import { useState } from 'react';
import {
  ACTUAL_PERIOD_KEYS,
  compareActualToProjection,
  comparisonCsv,
  comparisonFileName,
  neededInputs,
  periodChoiceParams,
  type ActualWindow,
  type ComparisonRow,
  type NeededInput,
  type PeriodChoice,
  type ProjectionYear,
} from '@/lib/analysis/actuals';
import type { ActualAmount, ActualReturns, Coverage, Estimate } from '@/lib/returns/actual';
import { monthBucket } from '@/lib/returns/period';
import styles from './actuals.module.css';

export type ActualsState =
  | { status: 'loading' }
  | { status: 'ready'; data: ActualReturns }
  | { status: 'error'; message: string };

const usd = (cents: number | null) =>
  cents == null
    ? '—'
    : new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
      }).format(Math.round(cents) / 100);
const signed = (cents: number) =>
  `${cents > 0 ? '+' : cents < 0 ? '−' : ''}${usd(Math.abs(cents))}`;
const pct = (value: number | null) => (value == null ? '—' : `${(value * 100).toFixed(1)}%`);

const excludedLabels: Record<string, string> = {
  appreciation: 'appreciation',
  projectedRent: 'projected rent',
  listedOrMarketRent: 'listed or market rent',
  vacancyAllowance: 'vacancy allowance',
  assumedDebtService: 'assumed debt service',
  inferredZeroExpenses: 'zero-filled expenses',
};

export const actualFailure = (code: string) =>
  ({
    NOT_FOUND: 'This property is unavailable or archived. Choose another property.',
    FORBIDDEN: 'You do not have access to these returns.',
    INVALID: 'Choose a valid date range.',
  })[code] ?? 'Could not load recorded returns. Your analysis is unaffected. Try again.';

function ActualValue({ row }: { row: ComparisonRow }) {
  const { actual } = row;
  return (
    <>
      <strong>{actual.status === 'unavailable' ? 'Not recorded' : usd(actual.cents)}</strong>
      <span className={styles[actual.status]}>
        {actual.status === 'recorded'
          ? 'Recorded'
          : actual.status === 'zero'
            ? 'Recorded $0'
            : actual.status === 'partial'
              ? 'Partial'
              : 'Unavailable'}
      </span>
      {actual.notes.map((note) => (
        <small key={note}>{note}</small>
      ))}
    </>
  );
}

function CoverageLine({ label, coverage }: { label: string; coverage: Coverage }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>
        <span
          className={
            styles[
              coverage.status === 'complete'
                ? 'recorded'
                : coverage.status === 'partial'
                  ? 'partial'
                  : 'unavailable'
            ]
          }
        >
          {coverage.status === 'complete'
            ? 'Complete'
            : coverage.status === 'partial'
              ? 'Partial'
              : 'None'}
        </span>{' '}
        {coverage.observedDays} of {coverage.periodDays} days
        {coverage.recordedFrom
          ? ` · records ${coverage.recordedFrom} to ${coverage.recordedTo}`
          : ''}
        {coverage.gaps.map((gap) => (
          <small key={gap}>{gap}</small>
        ))}
      </dd>
    </div>
  );
}

const estimateValue = (estimate: Estimate | ActualAmount) =>
  'value' in estimate
    ? estimate.status === 'unavailable'
      ? 'Unavailable'
      : `${usd(estimate.value)}${estimate.status === 'partial' ? ' (partial)' : ''}`
    : estimate.status === 'unavailable'
      ? 'Not recorded'
      : usd(estimate.cents);

/** Period picker shared by the actual-versus-projected views. */
export function ActualPeriodPicker({
  choice,
  window: range,
  onChange,
  disabled,
}: {
  choice: PeriodChoice;
  window: ActualWindow;
  onChange: (choice: PeriodChoice) => void;
  disabled?: boolean;
}) {
  const [from, setFrom] = useState(choice.from ?? monthBucket(range.period.start));
  const [to, setTo] = useState(choice.to ?? monthBucket(new Date(range.period.end.getTime() - 1)));
  const today = monthBucket(new Date());
  return (
    <div className={styles.periods}>
      <div role="group" aria-label="Actuals period" className={styles.chips}>
        {ACTUAL_PERIOD_KEYS.map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={choice.key === key}
            disabled={disabled}
            onClick={() => onChange({ key })}
          >
            {key}
          </button>
        ))}
      </div>
      <form
        className={styles.custom}
        aria-label="Custom actuals period"
        onSubmit={(event) => {
          event.preventDefault();
          if (from && to) onChange({ key: 'CUSTOM', from, to });
        }}
      >
        <label>
          From
          <input
            type="month"
            value={from}
            max={today}
            required
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label>
          To
          <input
            type="month"
            value={to}
            max={today}
            required
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <button type="submit" disabled={disabled} aria-pressed={choice.key === 'CUSTOM'}>
          Apply
        </button>
      </form>
    </div>
  );
}

function Needed({
  items,
  onReviewAssumptions,
}: {
  items: NeededInput[];
  onReviewAssumptions: () => void;
}) {
  if (!items.length) return null;
  return (
    <section className={styles.needed} aria-label="Needed to complete this comparison">
      <h3>Needed to complete this comparison</h3>
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            <span>{item.text}</span>
            {item.href ? (
              <a href={item.href}>{item.linkLabel}</a>
            ) : (
              <button type="button" onClick={onReviewAssumptions}>
                {item.linkLabel}
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Recorded rent and expenses beside the ROI projection for the same period and scope. */
export function RoiActuals({
  propertyId,
  propertyName,
  choice,
  window: range,
  state,
  projection,
  stale,
  missingAssumptions,
  projectionBasis,
  onPeriod,
  onRetry,
  onReviewAssumptions,
}: {
  propertyId: string;
  propertyName: string;
  choice: PeriodChoice;
  window: ActualWindow;
  state: ActualsState;
  projection: ProjectionYear | null;
  stale: boolean;
  missingAssumptions: number;
  /** Where the projected column comes from (saved revision, defaults or unsaved edits). */
  projectionBasis: string;
  onPeriod: (choice: PeriodChoice) => void;
  onRetry: () => void;
  onReviewAssumptions: () => void;
}) {
  const data = state.status === 'ready' ? state.data : null;
  const comparison = data ? compareActualToProjection(data, stale ? null : projection) : null;
  const needed = neededInputs(propertyId, data, stale ? missingAssumptions : 0);
  const [exported, setExported] = useState('');
  // The CSV is built from exactly what is on screen: same property, days and statuses.
  function exportComparison() {
    if (!data || !comparison) return;
    const csv = comparisonCsv(data, comparison, {
      propertyId,
      propertyName,
      windowLabel: `${range.label}${range.throughToday ? ' (through today)' : ''}`,
      projectionBasis: stale ? 'No projection (assumptions incomplete)' : projectionBasis,
    });
    const name = comparisonFileName(data);
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    setExported(`Exported ${name}`);
  }
  return (
    <div className={styles.actuals}>
      <section className={styles.card} aria-labelledby="actuals-heading">
        <div className={styles.head}>
          <div>
            <h2 id="actuals-heading">Actual vs projected</h2>
            <p>
              {propertyName} · Whole property · {range.label}
              {range.throughToday ? ' (through today)' : ''}
            </p>
          </div>
          <ActualPeriodPicker
            key={`${choice.key}-${choice.from}-${choice.to}`}
            choice={choice}
            window={range}
            onChange={onPeriod}
            disabled={state.status === 'loading'}
          />
        </div>
        <p className={styles.basis}>
          <strong>Actual</strong> is recorded cash: settled rent payments by paid date and expenses
          by date, in USD. <strong>Projected</strong> is your ROI assumptions at the Year-1 rate,
          scaled to the same period
          {comparison ? ` (${comparison.scaleLabel})` : ''}. Neither side fills in the other.
        </p>
        <p role="status" aria-live="polite" className={styles.status}>
          {state.status === 'loading'
            ? 'Loading recorded returns…'
            : state.status === 'error'
              ? state.message
              : stale
                ? 'Showing recorded actuals. The projection column needs complete, current assumptions.'
                : 'Recorded actuals and the current projection for the same period.'}
        </p>
        {state.status === 'error' && (
          <button type="button" onClick={onRetry}>
            Retry loading actuals
          </button>
        )}
        {comparison && (
          <div
            className={styles.tableWrap}
            role="region"
            aria-label="Actual and projected amounts"
            tabIndex={0}
          >
            <table className={styles.table}>
              <caption className={styles.caption}>
                Actual and projected amounts, {range.label}
              </caption>
              <thead>
                <tr>
                  <th scope="col">Line</th>
                  <th scope="col">Actual (recorded)</th>
                  <th scope="col">Projected (ROI assumptions)</th>
                  <th scope="col">Difference</th>
                </tr>
              </thead>
              <tbody>
                {comparison.rows.map((row) => (
                  <tr key={row.key}>
                    <th scope="row">{row.label}</th>
                    <td data-label="Actual (recorded)" className={styles.cell}>
                      <div className={styles.value}>
                        <ActualValue row={row} />
                      </div>
                    </td>
                    <td data-label="Projected (ROI assumptions)" className={styles.cell}>
                      <div className={styles.value}>
                        <strong>
                          {row.projected.status === 'projected'
                            ? usd(row.projected.cents)
                            : 'No projection'}
                        </strong>
                        {row.projected.status === 'projected' && (
                          <span className={styles.projected}>Projected</span>
                        )}
                      </div>
                    </td>
                    <td data-label="Difference" className={styles.cell}>
                      <div className={styles.value}>
                        {row.difference.cents == null ? (
                          <small>{row.difference.reason}</small>
                        ) : (
                          <strong
                            className={
                              row.difference.cents === 0
                                ? undefined
                                : row.difference.cents > 0 !== row.costLike
                                  ? styles.better
                                  : styles.worse
                            }
                          >
                            {signed(row.difference.cents)}
                          </strong>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Needed items={needed} onReviewAssumptions={onReviewAssumptions} />
      </section>
      {data && (
        <div className={styles.grid}>
          <section className={styles.card} aria-labelledby="actuals-estimates">
            <h2 id="actuals-estimates">Scheduled and estimated</h2>
            <p>What was billed or scheduled, not what was paid. Never counted as actual.</p>
            <dl className={styles.list}>
              <div>
                <dt>Rent billed (scheduled)</dt>
                <dd>{estimateValue(data.scheduled.billedRent)}</dd>
              </div>
              <div>
                <dt>Debt service (scheduled)</dt>
                <dd>{estimateValue(data.scheduled.debtService)}</dd>
              </div>
              <div>
                <dt>Cash flow after scheduled debt (estimate)</dt>
                <dd>{estimateValue(data.estimates.cashFlowAfterScheduledDebt)}</dd>
              </div>
              <div>
                <dt>NOI annualized from actuals (estimate)</dt>
                <dd>{estimateValue(data.estimates.annualizedNoi)}</dd>
              </div>
              <div>
                <dt>Projected Year-1 NOI</dt>
                <dd>
                  {projection && !stale ? usd(Math.round(projection.noi * 100)) : 'No projection'}
                </dd>
              </div>
              <div>
                <dt>Actual cap rate for the period</dt>
                <dd>
                  {data.actual.periodCapRate.status === 'unavailable'
                    ? 'Unavailable'
                    : `${pct(data.actual.periodCapRate.value)}${data.actual.periodCapRate.status === 'partial' ? ' (partial)' : ''}`}
                </dd>
              </div>
            </dl>
          </section>
          <section className={styles.card} aria-labelledby="actuals-sources">
            <h2 id="actuals-sources">Sources and coverage</h2>
            <dl className={styles.list}>
              <CoverageLine label="Rent records" coverage={data.income.confirmedRent.coverage} />
              <CoverageLine label="Expense records" coverage={data.expenses.total.coverage} />
              <div>
                <dt>Receipts in period</dt>
                <dd>
                  {data.income.receipts.length} settled payment(s) ·{' '}
                  {data.income.receipts.filter((r) => r.classification === 'rent').length} confirmed
                  rent
                  {data.income.excluded.pendingCents
                    ? ` · ${usd(data.income.excluded.pendingCents)} pending, not counted`
                    : ''}
                  {data.income.securityDeposits.cents
                    ? ` · ${usd(data.income.securityDeposits.cents)} deposits held, not income`
                    : ''}
                </dd>
              </div>
              <div>
                <dt>Expenses by category</dt>
                <dd>
                  {data.expenses.byCategory.length
                    ? data.expenses.byCategory
                        .map(
                          (e) =>
                            `${e.category.replaceAll('_', ' ').toLowerCase()} ${usd(e.cents)} (${e.count})`,
                        )
                        .join(' · ')
                    : 'None recorded'}
                </dd>
              </div>
            </dl>
            <p>
              Actuals never include{' '}
              {data.excludedAssumptions.map((a) => excludedLabels[a] ?? a).join(', ')}.
            </p>
            <p className={styles.links}>
              <button type="button" onClick={exportComparison}>
                Export this comparison (CSV)
              </button>
              <a
                href={`/returns?${new URLSearchParams({ property: propertyId, ...periodChoiceParams(choice) })}`}
              >
                Portfolio returns (estimates)
              </a>
            </p>
            <p className={styles.fine}>
              The export matches this table: {propertyName}, {data.period.from} to {data.period.to},
              with unavailable and partial values kept as shown. Portfolio returns are month-based
              summaries that use scheduled debt service and 3% assumed appreciation; they are
              estimates, not recorded results.
            </p>
            {exported && (
              <p role="status" className={styles.fine}>
                {exported}
              </p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

/** Compact Summary-tab card: recorded NOI beside the projected NOI for the shared period. */
export function ActualSnapshot({
  window: range,
  state,
  projection,
  stale,
  onOpen,
}: {
  window: ActualWindow;
  state: ActualsState;
  projection: ProjectionYear | null;
  stale: boolean;
  onOpen: () => void;
}) {
  const data = state.status === 'ready' ? state.data : null;
  const rows = data ? compareActualToProjection(data, stale ? null : projection).rows : [];
  const pick = (key: ComparisonRow['key']) => rows.find((r) => r.key === key);
  return (
    <section className={styles.card} aria-labelledby="actual-snapshot">
      <h2 id="actual-snapshot">Actual vs projected</h2>
      <p>{range.label} · recorded cash beside the projection for the same period.</p>
      {state.status === 'loading' && <p role="status">Loading recorded returns…</p>}
      {state.status === 'error' && <p role="status">{state.message}</p>}
      {data && (
        <dl className={styles.list}>
          {(['income', 'expenses', 'noi'] as const).map((key) => {
            const row = pick(key)!;
            return (
              <div key={key}>
                <dt>{row.label}</dt>
                <dd>
                  <span>
                    Actual{' '}
                    <strong>
                      {row.actual.status === 'unavailable' ? 'Not recorded' : usd(row.actual.cents)}
                    </strong>
                    {row.actual.status === 'partial' ? ' (partial)' : ''}
                  </span>
                  <span>
                    Projected{' '}
                    <strong>{row.projected.cents == null ? '—' : usd(row.projected.cents)}</strong>
                  </span>
                </dd>
              </div>
            );
          })}
        </dl>
      )}
      <button type="button" onClick={onOpen}>
        Open actual vs projected
      </button>
    </section>
  );
}
