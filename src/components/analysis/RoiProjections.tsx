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
import { cashFlowLandmarks } from '@/lib/analysis/chart-data';
import {
  ChartCard,
  Chips,
  ComboChart,
  Insight,
  Segmented,
  Tiles,
  chartColors,
  useHorizon,
} from './RoiChart';
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
                  background: value < 0 ? chartColors.red : chartColors.teal,
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
  const [shown, horizon] = useHorizon(rows.length, 'Cash flow chart horizon');
  const visible = rows.slice(0, shown);
  const marks = cashFlowLandmarks(visible);
  const at = visible.at(-1)!;
  const first = rows[0];
  const metrics = result.summaryMetrics;
  const recovered =
    metrics.totalCashRequired > 0 ? at.cumulativeCashFlow / metrics.totalCashRequired : null;
  return (
    <div className={chartStyles.stack}>
      <ChartCard
        title="Cash flow & cumulative return"
        subtitle="Projected · after operating costs, debt and reserves · before tax · sale proceeds excluded"
        controls={horizon}
      >
        <Tiles
          items={[
            {
              label: `Cumulative cash flow · year ${at.year}`,
              value: dollars(at.cumulativeCashFlow),
              note: 'Operating cash only; not profit',
              tone: at.cumulativeCashFlow < 0 ? 'red' : 'teal',
            },
            {
              label: 'Initial cash required',
              value: dollars(metrics.totalCashRequired),
              note: 'Cash invested at purchase',
              tone: 'slate',
            },
            {
              label: 'Cash recovered / initial cash',
              value: rate(recovered),
              note: `Through year ${at.year}`,
              tone: 'slate',
            },
            {
              label: 'Cash-only payback',
              value:
                metrics.paybackPeriodYears == null
                  ? 'Not recovered within hold'
                  : `${metrics.paybackPeriodYears.toFixed(2)} years`,
              note: `Across the ${rows.length}-year hold`,
              tone: 'slate',
            },
          ]}
        />
        <Chips
          items={[
            ...(marks.turnsPositive != null
              ? [
                  {
                    text: `Cumulative turns positive · year ${marks.turnsPositive}`,
                    tone: 'teal' as const,
                  },
                ]
              : []),
            ...(marks.worst && marks.worst.cashFlow < 0
              ? [
                  {
                    text: `Lowest: ${dollars(marks.worst.cashFlow)} · year ${marks.worst.year}`,
                    tone: 'red' as const,
                  },
                ]
              : []),
            ...(marks.best && visible.length > 1
              ? [
                  {
                    text: `Highest: ${dollars(marks.best.cashFlow)} · year ${marks.best.year}`,
                    tone: 'teal' as const,
                  },
                ]
              : []),
          ]}
        />
        <ComboChart
          label="Annual and cumulative operating cash flow"
          years={visible.map((r) => r.year)}
          series={[
            {
              label: 'Annual cash flow',
              kind: 'bar',
              values: visible.map((r) => r.cashFlow),
              color: chartColors.teal,
              negativeColor: chartColors.red,
            },
            {
              label: 'Cumulative cash flow',
              values: visible.map((r) => r.cumulativeCashFlow),
              color: chartColors.slate,
            },
          ]}
          markers={
            marks.turnsPositive != null
              ? [{ index: marks.turnsPositive - visible[0].year, label: 'Cumulative > $0' }]
              : []
          }
        />
        <Insight>
          <strong>Reading:</strong> at year {at.year}, cumulative operating cash flow is{' '}
          <strong>{dollars(at.cumulativeCashFlow)}</strong>
          {recovered != null && (
            <>
              {' '}
              ({rate(recovered)} of {dollars(metrics.totalCashRequired)} initial cash)
            </>
          )}
          . Cash recovery is before a sale; it is not profit. Open Exit for cash returned at sale.
        </Insight>
      </ChartCard>
      <ChartCard title="From income to cash flow" subtitle="Year 1 · projected · USD per year">
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
      </ChartCard>
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
  const all = result.equityTimeline.filter((row) => row.month % 12 === 0);
  const [shown, horizon] = useHorizon(all.length, 'Equity chart horizon');
  const [withPurchase, setWithPurchase] = useState(false);
  const rows = all.slice(0, shown);
  const final = rows.at(-1)!;
  const financed = result.summaryMetrics.loanAmount > 0;
  const paidOff = financed ? rows.find((r) => r.loanBalance < 0.005) : undefined;
  const cumulative = result.annualCashflows.find((y) => y.year === final.year)?.cumulativeCashFlow;
  // A crossover only counts when equity started below the loan balance.
  const crossover =
    rows.length && rows[0].equity <= rows[0].loanBalance
      ? rows.find((r) => r.equity > r.loanBalance)
      : undefined;
  return (
    <div className={chartStyles.stack}>
      <ChartCard
        title="Equity composition vs debt paydown"
        subtitle={
          withPurchase
            ? 'Projected year-end balances · bars = equity, line = loan balance · before selling costs and taxes'
            : 'Projected year-end balances · bars = equity gained from principal and value change, line = loan balance'
        }
        controls={
          <>
            {horizon}
            <Segmented
              label="Equity bars"
              options={[
                { value: 'gain', label: 'Equity gain' },
                { value: 'total', label: 'Incl. purchase equity' },
              ]}
              value={withPurchase ? 'total' : 'gain'}
              onChange={(value) => setWithPurchase(value === 'total')}
            />
          </>
        }
      >
        <Tiles
          items={[
            {
              label: `Equity · year ${final.year}`,
              value: dollars(final.equity),
              note: 'Property value − loan balance',
            },
            {
              label: 'Equity gain',
              value: dollars(final.principalEquity + final.appreciationEquity),
              note: 'Principal paid + appreciation & repair value change',
            },
            {
              label: `Loan balance · year ${final.year}`,
              value: dollars(final.loanBalance),
              note: financed
                ? paidOff
                  ? 'Loan paid off'
                  : 'Remaining balance'
                : 'All-cash purchase',
              tone: 'slate',
            },
          ]}
        />
        <Chips
          items={[
            ...(crossover
              ? [
                  {
                    text: `Equity exceeds loan balance · year ${crossover.year}`,
                    tone: 'teal' as const,
                  },
                ]
              : []),
            ...(paidOff ? [{ text: `Loan paid off · year ${paidOff.year}` }] : []),
          ]}
        />
        <ComboChart
          label="Equity composition and loan balance"
          years={rows.map((r) => r.year)}
          series={[
            ...(withPurchase
              ? [
                  {
                    label: 'Purchase equity',
                    kind: 'bar' as const,
                    stack: true,
                    values: rows.map((r) => r.initialEquity),
                    color: chartColors.slateLight,
                  },
                ]
              : []),
            {
              label: 'Principal paid',
              kind: 'bar',
              stack: true,
              values: rows.map((r) => r.principalEquity),
              color: chartColors.teal,
            },
            {
              label: 'Appreciation & repair value change',
              kind: 'bar',
              stack: true,
              values: rows.map((r) => r.appreciationEquity),
              color: chartColors.tealLight,
              negativeColor: chartColors.red,
            },
            {
              label: 'Loan balance',
              values: rows.map((r) => r.loanBalance),
              color: chartColors.slate,
            },
          ]}
          markers={
            crossover ? [{ index: crossover.year - rows[0].year, label: 'Equity > loan' }] : []
          }
          details={(i) => [
            ['Property value', dollars(rows[i].propertyValue)],
            ['= Equity (value − loan)', dollars(rows[i].equity)],
          ]}
        />
      </ChartCard>
      <div className={chartStyles.grid}>
        <ChartCard title={`Equity growth at year ${final.year}`} subtitle="Projected · USD">
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
        </ChartCard>
        <ChartCard title="Equity & cash flow" subtitle={`Projected · year ${final.year}`}>
          <p className={chartStyles.big}>{dollars(final.equity + (cumulative ?? NaN))}</p>
          <p>
            Year {final.year} equity plus accumulated operating cash flow. This is not net cash
            after a sale.
          </p>
        </ChartCard>
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
          rows={all.map((r) => [
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
  const [shown, horizon] = useHorizon(rows.length, 'Expense chart horizon');
  const visible = rows.slice(0, shown);
  const e = result.expenseBreakdown;
  return (
    <div className={chartStyles.stack}>
      <div className={chartStyles.grid}>
        <ChartCard title="Expense breakdown" subtitle="Year 1 · projected · USD per year">
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
          <Tiles
            items={[
              {
                label: 'Operating expenses / year',
                value: dollars(result.summaryMetrics.totalOperatingExpenses),
                tone: 'slate',
              },
              {
                label: 'Share of effective income',
                value: rate(result.summaryMetrics.oer),
                tone: 'slate',
              },
            ]}
          />
        </ChartCard>
        <ChartCard title="Expense growth" subtitle="Projected · USD per year" controls={horizon}>
          <ComboChart
            label="Operating expenses and capital reserves"
            years={visible.map((r) => r.year)}
            series={[
              {
                label: 'Operating expenses',
                values: visible.map((r) => r.operatingExpenses),
                color: chartColors.slate,
              },
              {
                label: 'Capital reserves',
                values: visible.map((r) => r.reserves),
                color: chartColors.teal,
                dashed: true,
              },
            ]}
          />
          <p>
            A fixed dollar input replaces its percentage. Year-one percentage-based dollar costs
            grow at the expense-growth assumption; they are not recalculated from later rent.
          </p>
          <p>NOI excludes capital reserves. Reserves reduce spendable cash after debt service.</p>
          <div>
            <button onClick={onEdit}>Edit expense assumptions</button>
          </div>
        </ChartCard>
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
  const final = rows.at(-1);
  return (
    <div className={chartStyles.stack}>
      <ChartCard
        title="Principal vs interest over time"
        subtitle="Scheduled loan · full term, including years beyond the holding period"
      >
        {result.summaryMetrics.loanAmount === 0 || !final ? (
          <p>
            All-cash purchase · debt service $0.00. Debt coverage is not applicable; no loan
            schedule is needed.
          </p>
        ) : (
          <>
            <Tiles
              items={[
                { label: 'Loan amount', value: dollars(result.summaryMetrics.loanAmount) },
                {
                  label: 'Scheduled payment',
                  value: dollars(result.summaryMetrics.monthlyDebtService),
                  note: 'Per month; final payment may differ',
                  tone: 'slate',
                },
                {
                  label: 'Interest over the term',
                  value: dollars(final.cumulativeInterest),
                  note: `Through loan year ${final.year}`,
                  tone: 'amber',
                },
              ]}
            />
            <ComboChart
              label="Loan balance and cumulative principal and interest"
              xLabel="Loan year"
              axisTitle="Loan yr"
              years={rows.map((r) => r.year)}
              series={[
                {
                  label: 'Loan balance',
                  values: rows.map((r) => r.balance),
                  color: chartColors.slate,
                },
                {
                  label: 'Cumulative principal',
                  values: rows.map((r) => r.cumulativePrincipal),
                  color: chartColors.teal,
                },
                {
                  label: 'Cumulative interest',
                  values: rows.map((r) => r.cumulativeInterest),
                  color: chartColors.amber,
                  dashed: true,
                },
              ]}
            />
            <p>
              Scheduled payment {dollars(result.summaryMetrics.monthlyDebtService)} / month. Final
              payment may differ. The full loan schedule is shown, including payments beyond the
              analysis holding period.
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
      </ChartCard>
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
        <ChartCard
          title="Exit Analysis"
          subtitle={
            result && sale
              ? `Estimated sale at the end of year ${selected.year} · projected · before tax`
              : 'Projected sale · before tax'
          }
        >
          {result && sale ? (
            <>
              <Tiles
                items={[
                  {
                    label: 'Total profit',
                    value: dollars(result.summaryMetrics.totalReturn),
                    tone: result.summaryMetrics.totalReturn < 0 ? 'red' : 'teal',
                  },
                  {
                    label: 'Total ROI',
                    value: rate(result.summaryMetrics.totalReturnPercent),
                    tone: 'slate',
                  },
                ]}
              />
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
        </ChartCard>
        <ChartCard
          title="Holding period comparison"
          subtitle="Temporary probes leave saved base assumptions unchanged. All figures are before tax, even when optional tax estimates are enabled."
        >
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
          <div>
            <button onClick={onEdit}>Edit saved exit assumptions</button>
          </div>
        </ChartCard>
      </div>
      {rows && (
        <ChartCard
          title="Profit by exit year"
          subtitle="Each horizon recalculated · projected · USD · before tax"
        >
          <ComboChart
            label="Cash returned and profit by exit year"
            xLabel="Sell at end of year"
            axisTitle="Exit yr"
            years={rows.map((r) => r.year)}
            series={[
              {
                label: 'Cash returned',
                kind: 'bar',
                values: rows.map(
                  (r) =>
                    r.result.summaryMetrics.totalReturn + r.result.summaryMetrics.totalCashRequired,
                ),
                color: chartColors.slateLight,
                negativeColor: chartColors.red,
              },
              {
                label: 'Profit',
                kind: 'bar',
                values: rows.map((r) => r.result.summaryMetrics.totalReturn),
                color: chartColors.teal,
                negativeColor: chartColors.red,
              },
            ]}
            details={(i) => [['Total ROI', rate(rows[i].result.summaryMetrics.totalReturnPercent)]]}
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
        </ChartCard>
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
    <ChartCard
      title={`Sensitivity · ${metric === 'cashOnCash' ? 'cash-on-cash return' : 'hold-period leveraged IRR'}`}
      subtitle={`Monthly rent assumptions × vacancy rate · ${
        metric === 'cashOnCash'
          ? 'Year 1'
          : `${payload.input.appreciationExit?.holdingPeriodYears}-year hold`
      } · projected. Temporary probes leave saved base assumptions unchanged.`}
    >
      <p>
        Outlined cells match the base. Red-tinted cells have a negative return. Values are always
        visible. Missing metrics remain unavailable.
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
    </ChartCard>
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
