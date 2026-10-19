'use client';

import { useMemo, useState, type ReactNode } from 'react';
import type { AnalysisPayload } from '@/lib/analysis/contract';
import {
  calculateExits,
  calculateSensitivity,
  dollars,
  exitControls,
  loanYears,
  projectionRows,
  rate,
  sensitivityControls,
  type ProjectionResult,
  type ExitControls,
  type SensitivityControls,
} from '@/lib/analysis/projections';
import styles from './analysis.module.css';
import chartStyles from './projections.module.css';

export function AnalysisTabs({
  id,
  label,
  choices,
  value,
  onChange,
}: {
  id: string;
  label: string;
  choices: readonly { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className={chartStyles.tabs} role="tablist" aria-label={label}>
      {choices.map((choice, index) => (
        <button
          key={choice.id}
          id={`${id}-tab-${choice.id}`}
          type="button"
          role="tab"
          aria-selected={choice.id === value}
          aria-controls={`${id}-panel-${choice.id}`}
          tabIndex={choice.id === value ? 0 : -1}
          onClick={() => onChange(choice.id)}
          onKeyDown={(event) => {
            const next =
              event.key === 'ArrowRight'
                ? (index + 1) % choices.length
                : event.key === 'ArrowLeft'
                  ? (index + choices.length - 1) % choices.length
                  : event.key === 'Home'
                    ? 0
                    : event.key === 'End'
                      ? choices.length - 1
                      : null;
            if (next === null) return;
            event.preventDefault();
            onChange(choices[next].id);
            document.getElementById(`${id}-tab-${choices[next].id}`)?.focus();
          }}
        >
          {choice.label}
        </button>
      ))}
    </div>
  );
}

function ExactTable({
  caption,
  headers,
  rows,
}: {
  caption: string;
  headers: string[];
  rows: ReactNode[][];
}) {
  return (
    <div
      className={`${styles.table} ${chartStyles.exact}`}
      role="region"
      tabIndex={0}
      aria-label={caption}
    >
      <table>
        <caption>{caption}</caption>
        <thead>
          <tr>
            {headers.map((header) => (
              <th scope="col" key={header}>
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              {row.map((cell, column) =>
                column === 0 ? (
                  <th scope="row" key={column}>
                    {cell}
                  </th>
                ) : (
                  <td key={column}>{cell}</td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type Series = { label: string; values: number[]; color: string; dashed?: boolean };
const blue = '#1e3a8a';
const warm = '#a4603d';
const slate = '#64748b';
const compact = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);

/** Shared zero baseline, including negative data; exact values live in the tables. */
function LineChart({ label, years, series }: { label: string; years: number[]; series: Series[] }) {
  const values = series.flatMap((s) => s.values);
  const min = Math.min(0, ...values);
  const max = Math.max(0, ...values);
  const span = max - min || 1;
  const x = (index: number) => 82 + (index / Math.max(1, years.length - 1)) * 550;
  const y = (value: number) => 220 - ((value - min) / span) * 192;
  const labels = [...new Set([0, Math.floor((years.length - 1) / 2), years.length - 1])];
  return (
    <>
      <svg
        className={chartStyles.graph}
        viewBox="0 0 660 264"
        role="img"
        aria-label={`${label}. USD; exact values in the table.`}
      >
        <title>{label}</title>
        {[min, min + span / 2, min + span].map((tick, index) => (
          <g key={index}>
            <path d={`M82 ${y(tick)}H632`} stroke="#e1e6ee" />
            <text x="72" y={y(tick) + 4} textAnchor="end">
              {compact(tick)}
            </text>
          </g>
        ))}
        <path d={`M82 ${y(0)}H632`} stroke="#64748b" strokeDasharray="2 3" />
        {series.map((s) => (
          <g key={s.label}>
            <polyline
              points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(' ')}
              fill="none"
              stroke={s.color}
              strokeWidth="3"
              strokeDasharray={s.dashed ? '6 5' : undefined}
            />
            {s.values.map((v, i) => (
              <circle key={i} cx={x(i)} cy={y(v)} r={years.length > 20 ? 2 : 3} fill={s.color} />
            ))}
          </g>
        ))}
        {labels.map((i) => (
          <text key={i} x={x(i)} y="250" textAnchor="middle">
            Year {years[i]}
          </text>
        ))}
      </svg>
      <div className={chartStyles.legend}>
        {series.map((s) => (
          <span key={s.label}>
            <i style={{ background: s.color }} />
            {s.label}
            {s.dashed ? ' (dashed)' : ''}
          </span>
        ))}
      </div>
    </>
  );
}

function Bars({ rows }: { rows: [string, number][] }) {
  const min = Math.min(0, ...rows.map((r) => r[1]));
  const max = Math.max(0, ...rows.map((r) => r[1]));
  const span = max - min || 1;
  const zero = (-min / span) * 100;
  return (
    <dl className={chartStyles.bars}>
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>
            <span className={chartStyles.track} aria-hidden="true">
              <i
                style={{
                  left: `${value < 0 ? ((value - min) / span) * 100 : zero}%`,
                  width: `${(Math.abs(value) / span) * 100}%`,
                  background: value < 0 ? '#dc2626' : blue,
                }}
              />
              <b style={{ left: `${zero}%` }} />
            </span>
            <span className={value < 0 ? chartStyles.negative : undefined}>{dollars(value)}</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Statement({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className={styles.statement}>
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function CashFlow({ result }: { result: ProjectionResult }) {
  const rows = projectionRows(result);
  const final = rows.at(-1)!;
  const first = rows[0];
  const metrics = result.summaryMetrics;
  return (
    <div className={chartStyles.stack}>
      <div className={chartStyles.split}>
        <section className={styles.card}>
          <h2>Cash flow &amp; cumulative return</h2>
          <p>After operating costs, debt and reserves · before tax. Sale proceeds excluded.</p>
          <LineChart
            label="Annual and cumulative operating cash flow"
            years={rows.map((r) => r.year)}
            series={[
              { label: 'Annual cash flow', values: rows.map((r) => r.cashFlow), color: blue },
              {
                label: 'Cumulative cash flow',
                values: rows.map((r) => r.cumulativeCashFlow),
                color: warm,
                dashed: true,
              },
            ]}
          />
        </section>
        <section className={styles.card}>
          <p className={styles.eyebrow}>Through year {final.year}</p>
          <h3>Cumulative cash flow</h3>
          <p className={chartStyles.big}>{dollars(final.cumulativeCashFlow)}</p>
          <Statement
            rows={[
              ['Initial cash required', dollars(metrics.totalCashRequired)],
              [
                'Cash recovered / initial cash',
                rate(
                  metrics.totalCashRequired > 0
                    ? final.cumulativeCashFlow / metrics.totalCashRequired
                    : null,
                ),
              ],
              [
                'Cash-only payback',
                metrics.paybackPeriodYears == null
                  ? 'Not recovered within hold'
                  : `${metrics.paybackPeriodYears.toFixed(2)} years`,
              ],
            ]}
          />
          <p>
            Cash recovery is before a sale; it is not profit. Open Exit for cash returned at sale.
          </p>
        </section>
      </div>
      <section className={styles.card}>
        <h2>From income to cash flow</h2>
        <p>Year 1 · USD per year</p>
        <Bars
          rows={[
            ['Scheduled rent', first.grossRent],
            ['Other income', first.otherIncome],
            ['Vacancy loss', -first.vacancyLoss],
            ['Effective income', first.effectiveGrossIncome],
            ['Operating costs', -first.operatingExpenses],
            ['Net operating income', first.noi],
            ['Debt service', -first.debtService],
            ['Capital reserves (below NOI)', -first.reserves],
            ['Cash flow', first.cashFlow],
          ]}
        />
      </section>
      <section className={styles.card}>
        <ExactTable
          caption="Projection amounts · USD · reserves below NOI"
          headers={[
            'Year',
            'Effective income',
            'Operating expenses',
            'NOI',
            'Debt service',
            'Capital reserves',
            'Cash flow',
            'Cumulative cash flow',
          ]}
          rows={rows.map((r) => [
            r.year,
            ...[
              r.effectiveGrossIncome,
              r.operatingExpenses,
              r.noi,
              r.debtService,
              r.reserves,
              r.cashFlow,
              r.cumulativeCashFlow,
            ].map(dollars),
          ])}
        />
      </section>
    </div>
  );
}

function Equity({ result }: { result: ProjectionResult }) {
  const rows = result.equityTimeline.filter((row) => row.month % 12 === 0);
  const final = rows.at(-1)!;
  return (
    <div className={chartStyles.stack}>
      <section className={styles.card}>
        <h2>Property value, equity &amp; debt</h2>
        <p>Projected balances at year end · before selling costs and taxes</p>
        <LineChart
          label="Property value, equity and debt"
          years={rows.map((r) => r.year)}
          series={[
            {
              label: 'Property value',
              values: rows.map((r) => r.propertyValue),
              color: slate,
              dashed: true,
            },
            { label: 'Equity', values: rows.map((r) => r.equity), color: blue },
            { label: 'Loan balance', values: rows.map((r) => r.loanBalance), color: warm },
          ]}
        />
      </section>
      <div className={chartStyles.grid}>
        <section className={styles.card}>
          <h2>Equity growth at year {final.year}</h2>
          <Bars
            rows={[
              ['Purchase equity', final.initialEquity],
              ['Principal paid', final.principalEquity],
              ['Appreciation & repair value change', final.appreciationEquity],
            ]}
          />
          <p>
            Equity excludes transaction costs. Initial cash required also includes closing,
            financing and improvement costs.
          </p>
        </section>
        <section className={styles.card}>
          <h2>Equity &amp; cash flow</h2>
          <p className={chartStyles.big}>
            {dollars(final.equity + result.annualCashflows.at(-1)!.cumulativeCashFlow)}
          </p>
          <p>
            Year {final.year} equity plus accumulated operating cash flow. This is not net cash
            after a sale.
          </p>
        </section>
      </div>
      <section className={styles.card}>
        <ExactTable
          caption="Exact year-end balances · USD"
          headers={[
            'Year',
            'Property value',
            'Loan balance',
            'Equity',
            'Purchase equity',
            'Principal paid',
            'Appreciation & repair value change',
          ]}
          rows={rows.map((r) => [
            r.year,
            ...[
              r.propertyValue,
              r.loanBalance,
              r.equity,
              r.initialEquity,
              r.principalEquity,
              r.appreciationEquity,
            ].map(dollars),
          ])}
        />
      </section>
    </div>
  );
}

function Expenses({ result, onEdit }: { result: ProjectionResult; onEdit: () => void }) {
  const rows = projectionRows(result);
  const e = result.expenseBreakdown;
  return (
    <div className={chartStyles.stack}>
      <div className={chartStyles.grid}>
        <section className={styles.card}>
          <h2>Expense breakdown</h2>
          <p>Year 1 · USD per year</p>
          <Bars
            rows={[
              ['Property tax', e.propertyTax],
              ['Insurance', e.insurance],
              ['HOA', e.hoa],
              ['Maintenance', e.maintenance],
              ['Management', e.propertyManagement],
              ['Utilities', e.utilities],
              ['Leasing', e.leasing],
              ['Other', e.other],
              ['Capital reserves (below NOI)', e.capex],
            ]}
          />
          <p>
            {dollars(result.summaryMetrics.totalOperatingExpenses)} operating / year ·{' '}
            {rate(result.summaryMetrics.oer)} of effective income
          </p>
        </section>
        <section className={styles.card}>
          <h2>Expense growth</h2>
          <LineChart
            label="Operating expenses and capital reserves"
            years={rows.map((r) => r.year)}
            series={[
              {
                label: 'Operating expenses',
                values: rows.map((r) => r.operatingExpenses),
                color: warm,
              },
              {
                label: 'Capital reserves',
                values: rows.map((r) => r.reserves),
                color: blue,
                dashed: true,
              },
            ]}
          />
          <p>
            A fixed dollar input replaces its percentage. Year-one percentage-based dollar costs
            grow at the expense-growth assumption; they are not recalculated from later rent.
          </p>
          <p>NOI excludes capital reserves. Reserves reduce spendable cash after debt service.</p>
          <button onClick={onEdit}>Edit expense assumptions</button>
        </section>
      </div>
      <section className={styles.card}>
        <ExactTable
          caption="Expense projections · USD per year"
          headers={['Year', 'Effective income', 'Operating expenses', 'Capital reserves']}
          rows={rows.map((r) => [
            r.year,
            ...[r.effectiveGrossIncome, r.operatingExpenses, r.reserves].map(dollars),
          ])}
        />
      </section>
    </div>
  );
}

function Amortization({ result }: { result: ProjectionResult }) {
  const rows = loanYears(result);
  const [year, setYear] = useState(1);
  const last = result.amortizationSchedule.at(-1);
  // The engine includes the maturity payoff in the actual final payment.
  const balloon = last && last.payment > result.summaryMetrics.monthlyDebtService + 1;
  return (
    <div className={chartStyles.stack}>
      <section className={styles.card}>
        <h2>Principal vs interest over time</h2>
        {result.summaryMetrics.loanAmount === 0 ? (
          <p>
            All-cash purchase · debt service $0.00. Debt coverage is not applicable; no loan
            schedule is needed.
          </p>
        ) : (
          <>
            <p>
              Scheduled payment {dollars(result.summaryMetrics.monthlyDebtService)} / month. Final
              payment may differ.
            </p>
            <LineChart
              label="Loan balance and cumulative principal and interest"
              years={rows.map((r) => r.year)}
              series={[
                { label: 'Loan balance', values: rows.map((r) => r.balance), color: blue },
                {
                  label: 'Cumulative principal',
                  values: rows.map((r) => r.cumulativePrincipal),
                  color: warm,
                },
                {
                  label: 'Cumulative interest',
                  values: rows.map((r) => r.cumulativeInterest),
                  color: slate,
                  dashed: true,
                },
              ]}
            />
            <p>
              The full loan schedule is shown, including payments beyond the analysis holding
              period.
            </p>
            {balloon && (
              <p className={styles.notice}>
                Balloon maturity · month {last.month}, year {last.year}
                {last.date ? ` · ${last.date.toISOString().slice(0, 10)}` : ''}. Final payment
                including remaining principal: {dollars(last.payment)}. This outflow is included in
                cash flow when the hold reaches maturity.
              </p>
            )}
          </>
        )}
      </section>
      {!!rows.length && (
        <section className={styles.card}>
          <h2>Amortization schedule</h2>
          <ExactTable
            caption="Annual loan payments · USD · full loan term"
            headers={['Year', 'Payment', 'Principal', 'Interest', 'Ending balance']}
            rows={rows.map((r) => [
              r.year,
              ...[r.payment, r.principal, r.interest, r.balance].map(dollars),
            ])}
          />
          <details className={chartStyles.disclosure}>
            <summary>Monthly schedule</summary>
            <label className={styles.field}>
              Loan schedule year
              <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
                {rows.map((r) => (
                  <option key={r.year} value={r.year}>
                    Year {r.year}
                  </option>
                ))}
              </select>
            </label>
            <ExactTable
              caption={`Monthly loan payments · year ${year} · USD`}
              headers={['Month', 'Date (UTC)', 'Payment', 'Principal', 'Interest', 'Balance']}
              rows={result.amortizationSchedule
                .filter((r) => r.year === year)
                .map((r) => [
                  r.month,
                  r.date?.toISOString().slice(0, 10) ?? 'Unavailable',
                  ...[r.payment, r.principal, r.interest, r.balance].map(dollars),
                ])}
            />
          </details>
        </section>
      )}
    </div>
  );
}

function Exit({
  payload,
  stale,
  saving,
  onEdit,
}: {
  payload: AnalysisPayload;
  stale: boolean;
  saving: boolean;
  onEdit: () => void;
}) {
  const [controls, setControls] = useState(() => exitControls(payload));
  const initial = useMemo(() => {
    try {
      return { rows: calculateExits(payload, exitControls(payload)), error: '' };
    } catch (error) {
      return {
        rows: null,
        error: error instanceof Error ? error.message : 'Calculation unavailable',
      };
    }
  }, [payload]);
  const [calculation, setCalculation] = useState(initial);
  const [changed, setChanged] = useState(false);
  const rows = stale || changed ? null : calculation.rows;
  const selected = rows?.at(-1);
  const result = selected?.result;
  const sale = result?.saleProceeds;
  const fields: [keyof ExitControls, string, string][] = [
    ['years', 'Probe exit year', 'Whole years, 1–50.'],
    ['sellingCosts', 'Probe selling costs (%)', '0–30% of sale price.'],
    [
      'salePrice',
      'Probe sale price override ($)',
      'Optional; blank uses appreciated value. Applies to every compared horizon.',
    ],
  ];
  return (
    <div className={chartStyles.stack}>
      <div className={chartStyles.split}>
        <section className={styles.card}>
          <h2>Exit Analysis</h2>
          {result && sale ? (
            <>
              <p>Estimated sale at the end of year {selected.year} · before tax</p>
              <Statement
                rows={[
                  ['Projected sale price', dollars(sale.grossSalePrice)],
                  ['Selling costs', dollars(-sale.sellingCosts)],
                  ['Loan payoff', dollars(-sale.loanPayoff)],
                  ['Net sale proceeds after debt', dollars(sale.netProceeds)],
                  [
                    'Cumulative operating cash flow',
                    dollars(result.annualCashflows.at(-1)!.cumulativeCashFlow),
                  ],
                  [
                    'Total cash returned',
                    dollars(
                      result.summaryMetrics.totalReturn + result.summaryMetrics.totalCashRequired,
                    ),
                  ],
                  ['Initial cash required', dollars(-result.summaryMetrics.totalCashRequired)],
                  ['Total profit', dollars(result.summaryMetrics.totalReturn)],
                  ['Total ROI', rate(result.summaryMetrics.totalReturnPercent)],
                  ['Hold-period leveraged IRR', rate(result.summaryMetrics.irrLeveraged)],
                ]}
              />
              {result.summaryMetrics.irrLeveraged === null && (
                <p>IRR unavailable: {result.unavailable.irrLeveraged}</p>
              )}
            </>
          ) : (
            <p>
              {stale
                ? 'Recalculate base assumptions before comparing exits.'
                : 'Update exit comparison to see results for these controls.'}
            </p>
          )}
        </section>
        <section className={styles.card}>
          <h2>Holding period comparison</h2>
          <p>
            Temporary probes leave saved base assumptions unchanged. All figures are before tax,
            even when optional tax estimates are enabled.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (stale || saving) return;
              try {
                setCalculation({ rows: calculateExits(payload, controls), error: '' });
                setChanged(false);
              } catch (error) {
                setCalculation({
                  rows: null,
                  error: error instanceof Error ? error.message : 'Calculation unavailable',
                });
              }
            }}
          >
            <fieldset disabled={stale || saving} className={chartStyles.stack}>
              {fields.map(([key, label, hint]) => (
                <label className={styles.field} key={key}>
                  <span id={`exit-probe-${key}-label`}>{label}</span>
                  <input
                    aria-labelledby={`exit-probe-${key}-label`}
                    aria-describedby={`exit-probe-${key}-hint`}
                    inputMode="decimal"
                    value={controls[key]}
                    onChange={(e) => {
                      setControls({ ...controls, [key]: e.target.value });
                      setChanged(true);
                    }}
                  />
                  <small id={`exit-probe-${key}-hint`}>{hint}</small>
                </label>
              ))}
              <button type="submit">Update exit comparison</button>
            </fieldset>
          </form>
          {calculation.error && (
            <p role="alert" className={styles.error}>
              Could not calculate exit comparison. {calculation.error} Correct the controls and try
              again.
            </p>
          )}
          <button className={chartStyles.edit} onClick={onEdit}>
            Edit saved exit assumptions
          </button>
        </section>
      </div>
      {rows && (
        <section className={styles.card}>
          <Bars
            rows={rows.map((r) => [`Year ${r.year} profit`, r.result.summaryMetrics.totalReturn])}
          />
          <ExactTable
            caption="Exit horizon comparison · USD · before tax"
            headers={[
              'Sell at end of',
              'Net sale proceeds after debt',
              'Cash returned',
              'Profit',
              'Total ROI',
            ]}
            rows={rows.map(({ year, result: r }) => [
              `Year ${year}`,
              dollars(r.saleProceeds.netProceeds),
              dollars(r.summaryMetrics.totalReturn + r.summaryMetrics.totalCashRequired),
              dollars(r.summaryMetrics.totalReturn),
              rate(r.summaryMetrics.totalReturnPercent),
            ])}
          />
          <p>
            Each horizon is recalculated with the public model. Cash returned includes operating
            cash flow and net sale proceeds; profit also deducts initial cash.
          </p>
        </section>
      )}
    </div>
  );
}

function Sensitivity({
  payload,
  stale,
  saving,
}: {
  payload: AnalysisPayload;
  stale: boolean;
  saving: boolean;
}) {
  const [controls, setControls] = useState(() => sensitivityControls(payload));
  const initial = useMemo(() => {
    try {
      return { grid: calculateSensitivity(payload, sensitivityControls(payload)), error: '' };
    } catch (error) {
      return {
        grid: null,
        error: error instanceof Error ? error.message : 'Calculation unavailable',
      };
    }
  }, [payload]);
  const [calculation, setCalculation] = useState(initial);
  const [changed, setChanged] = useState(false);
  const [metric, setMetric] = useState<'cashOnCash' | 'irr'>('cashOnCash');
  const [palette, setPalette] = useState(true);
  const grid = stale || changed ? null : calculation.grid;
  const fields: [keyof SensitivityControls, string][] = [
    ['rentMin', 'Minimum rent ($ / month)'],
    ['rentMax', 'Maximum rent ($ / month)'],
    ['rentSteps', 'Rent steps'],
    ['vacancyMin', 'Minimum vacancy (%)'],
    ['vacancyMax', 'Maximum vacancy (%)'],
    ['vacancySteps', 'Vacancy steps'],
  ];
  return (
    <section className={styles.card}>
      <h2>
        Sensitivity ·{' '}
        {metric === 'cashOnCash' ? 'cash-on-cash return' : 'hold-period leveraged IRR'}
      </h2>
      <p>
        Monthly rent assumptions × vacancy rate ·{' '}
        {metric === 'cashOnCash'
          ? 'Year 1'
          : `${payload.input.appreciationExit?.holdingPeriodYears}-year hold`}
        . Temporary probes leave saved base assumptions unchanged.
      </p>
      <p>
        Outlined cells match the base. Warm cells have a negative return. Values are always visible.
        Missing metrics remain unavailable.
      </p>
      <div className={styles.fields}>
        <label className={styles.field}>
          Sensitivity metric
          <select value={metric} onChange={(e) => setMetric(e.target.value as typeof metric)}>
            <option value="cashOnCash">Year 1 cash-on-cash</option>
            <option value="irr">Hold-period leveraged IRR</option>
          </select>
        </label>
        <label className={styles.field}>
          Sensitivity display
          <select
            value={palette ? 'palette' : 'values'}
            onChange={(e) => setPalette(e.target.value === 'palette')}
          >
            <option value="palette">Values + accessible palette</option>
            <option value="values">Values only</option>
          </select>
        </label>
      </div>
      {grid ? (
        <div
          className={`${styles.table} ${chartStyles.exact} ${palette ? chartStyles.heat : ''}`}
          role="region"
          tabIndex={0}
          aria-label="Sensitivity grid"
        >
          <table>
            <caption>
              {metric === 'cashOnCash' ? 'Year 1 cash-on-cash' : 'Hold-period leveraged IRR'} ·
              percentages
            </caption>
            <thead>
              <tr>
                <th scope="col">Monthly rent (USD)</th>
                {grid.vacancies.map((v) => (
                  <th key={v} scope="col">
                    {v.toFixed(4)}% vacancy
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grid.rents.map((rent, r) => (
                <tr key={rent}>
                  <th scope="row">{dollars(rent)}</th>
                  {grid.cells[r].map((cell, c) => {
                    const value = cell[metric];
                    const base =
                      Math.abs(rent - payload.input.income!.monthlyRent!) < 1e-6 &&
                      Math.abs(grid.vacancies[c] - payload.input.income!.vacancyRate!) < 1e-6;
                    return (
                      <td
                        key={c}
                        data-negative={value != null && value < 0}
                        className={base ? chartStyles.base : undefined}
                      >
                        {rate(value)}
                        {base && <small>Base</small>}
                        {value === null && (
                          <small>{metric === 'irr' ? cell.irrReason : cell.reason}</small>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p>
          {stale
            ? 'Recalculate base assumptions before running sensitivity.'
            : 'Update sensitivity to see results for these ranges.'}
        </p>
      )}
      <details className={chartStyles.disclosure} open>
        <summary>Adjust sensitivity ranges</summary>
        <p>
          Rent: $0–$10 billion / month. Vacancy: 0–100%. Use 1–7 whole-number steps per axis, at
          most 49 calculations. For one step, enter equal limits.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (stale || saving) return;
            try {
              setCalculation({ grid: calculateSensitivity(payload, controls), error: '' });
              setChanged(false);
            } catch (error) {
              setCalculation({
                grid: null,
                error: error instanceof Error ? error.message : 'Calculation unavailable',
              });
            }
          }}
        >
          <fieldset disabled={stale || saving}>
            <div className={chartStyles.rangeFields}>
              {fields.map(([key, label]) => (
                <label className={styles.field} key={key}>
                  {label}
                  <input
                    inputMode="decimal"
                    value={controls[key]}
                    onChange={(e) => {
                      setControls({ ...controls, [key]: e.target.value });
                      setChanged(true);
                    }}
                  />
                </label>
              ))}
            </div>
            <button type="submit">Update sensitivity</button>
          </fieldset>
        </form>
        {calculation.error && (
          <p role="alert" className={styles.error}>
            {calculation.error} Correct the ranges and try again.
          </p>
        )}
      </details>
      <p className={styles.notice}>
        Sensitivity is a model. It does not establish market rent. Review comparable rentals before
        changing a rent assumption.
      </p>
    </section>
  );
}

export const projectionPanels = [
  { id: 'cash-flow', label: 'Cash Flow' },
  { id: 'equity', label: 'Equity' },
  { id: 'expenses', label: 'Expenses' },
  { id: 'amortization', label: 'Amortization' },
  { id: 'exit', label: 'Exit' },
  { id: 'sensitivity', label: 'Sensitivity' },
] as const;

export function RoiProjections({
  result,
  calculatedPayload,
  calculationVersion,
  stale,
  saving,
  onEdit,
}: {
  result: ProjectionResult | null;
  calculatedPayload: AnalysisPayload | null;
  calculationVersion: number;
  stale: boolean;
  saving: boolean;
  onEdit: (path?: string) => void;
}) {
  const [panel, setPanel] = useState<string>('cash-flow');
  const content: Record<string, ReactNode> =
    result && calculatedPayload
      ? {
          'cash-flow': <CashFlow result={result} />,
          equity: <Equity result={result} />,
          expenses: (
            <Expenses result={result} onEdit={() => onEdit('input.expenses.propertyTax')} />
          ),
          amortization: <Amortization key={calculationVersion} result={result} />,
          exit: (
            <Exit
              key={calculationVersion}
              payload={calculatedPayload}
              stale={stale}
              saving={saving}
              onEdit={() => onEdit('input.appreciationExit.holdingPeriodYears')}
            />
          ),
          sensitivity: (
            <Sensitivity
              key={calculationVersion}
              payload={calculatedPayload}
              stale={stale}
              saving={saving}
            />
          ),
        }
      : {};
  return (
    <div className={chartStyles.projections}>
      <div className={chartStyles.toolbar}>
        <p>
          {result
            ? `${stale ? 'Out-of-date projection' : 'Projected'} · ${result.annualCashflows.length}-year hold · USD · before tax`
            : 'No valid projection available'}
        </p>
        <button onClick={() => onEdit()}>Edit assumptions</button>
      </div>
      <AnalysisTabs
        id="roi-chart"
        label="Projection views"
        choices={projectionPanels}
        value={panel}
        onChange={setPanel}
      />
      {projectionPanels.map((item) => (
        <div
          key={item.id}
          id={`roi-chart-panel-${item.id}`}
          role="tabpanel"
          aria-labelledby={`roi-chart-tab-${item.id}`}
          hidden={panel !== item.id}
          tabIndex={0}
        >
          {content[item.id] ?? (
            <section className={styles.card}>
              <h2>Complete your assumptions to see charts</h2>
              <p>
                Enter purchase, income and financing details, then recalculate. Correct any
                highlighted inputs and try again.
              </p>
              <button onClick={() => onEdit()}>Review assumptions</button>
            </section>
          )}
        </div>
      ))}
      <p>
        Charts share the selected property and base assumptions. Tables show USD to the cent and
        rates to four decimal places, without hover.
      </p>
    </div>
  );
}
