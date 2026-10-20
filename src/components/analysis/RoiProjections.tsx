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
import {
  PAID_OFF_BELOW,
  breakevenYear,
  cashFlowLandmarks,
  equityLandmarks,
  equityYears,
  indexAgainst,
  wholeDollars,
  type EquityYear,
} from '@/lib/analysis/chart-data';
import {
  ChartCard,
  Check,
  Chips,
  ComboChart,
  Figure,
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

type Row = ReturnType<typeof projectionRows>[number];
const pct = (value: number | null, digits = 1) =>
  value == null || !Number.isFinite(value) ? 'Unavailable' : `${(value * 100).toFixed(digits)}%`;
const ratio = (a: number, b: number) => (b > 0 ? a / b : null);

/** C8 · Cash Flow & Cumulative (reference CashFlowCumulativeChart). */
function CashFlowCumulative({ rows, result }: { rows: Row[]; result: ProjectionResult }) {
  const [shown, horizon] = useHorizon(rows.length, 'Cash flow chart horizon', 10);
  const visible = rows.slice(0, shown);
  const marks = cashFlowLandmarks(visible);
  const be = breakevenYear(visible);
  const beIndex = be == null ? null : be - visible[0].year;
  const at = visible.at(-1)!;
  const metrics = result.summaryMetrics;
  const invested = metrics.totalCashRequired;
  const recovered = ratio(at.cumulativeCashFlow, invested);
  return (
    <ChartCard
      title="Cash Flow & Cumulative"
      subtitle="Annual cash flow (bars) and cumulative total (line) · projected · after operating costs, debt service and reserves · before tax"
      controls={horizon}
    >
      <Chips
        items={[
          be != null
            ? {
                icon: 'target' as const,
                tone: 'teal' as const,
                text: `Breakeven: Year ${be}`,
                info: 'First year cumulative cash flow turns positive',
                infoLabel: 'breakeven',
              }
            : {
                icon: 'target' as const,
                tone: 'red' as const,
                text: `No breakeven by Year ${at.year}`,
              },
          ...(marks.worst && marks.worst.cashFlow < 0
            ? [
                {
                  icon: 'down' as const,
                  tone: 'red' as const,
                  text: `Worst: ${wholeDollars(marks.worst.cashFlow)} (Year ${marks.worst.year})`,
                },
              ]
            : []),
          ...(marks.best
            ? [
                {
                  icon: 'up' as const,
                  tone: 'tealSoft' as const,
                  text: `Best: ${wholeDollars(marks.best.cashFlow)} (Year ${marks.best.year})`,
                },
              ]
            : []),
          {
            tone: 'slate' as const,
            text: `Cumulative at Year ${at.year}: ${wholeDollars(at.cumulativeCashFlow)}`,
          },
        ]}
      />
      <ComboChart
        label="Annual and cumulative operating cash flow"
        years={visible.map((r) => r.year)}
        series={[
          {
            label: 'Annual Cash Flow',
            kind: 'bar',
            values: visible.map((r) => r.cashFlow),
            color: chartColors.teal,
            negativeColor: chartColors.red,
          },
          {
            label: 'Cumulative',
            values: visible.map((r) => r.cumulativeCashFlow),
            color: chartColors.slate,
            width: 3,
            dot: 3,
          },
        ]}
        bands={
          beIndex == null
            ? [{ from: 0, to: visible.length - 1, color: chartColors.red }]
            : [
                { from: 0, to: beIndex - 0.5, color: chartColors.red },
                { from: beIndex + 0.5, to: visible.length - 1, color: chartColors.emerald },
              ]
        }
        markers={
          beIndex == null
            ? []
            : [
                {
                  index: beIndex,
                  label: 'Breakeven',
                  color: chartColors.green,
                  dot: visible[beIndex].cumulativeCashFlow,
                  align: 'end',
                },
              ]
        }
        legend={[
          { label: 'Cash Flow', kind: 'bar', color: chartColors.teal },
          ...(visible.some((r) => r.cashFlow < 0)
            ? [{ label: 'Negative year', kind: 'bar' as const, color: chartColors.red }]
            : []),
          { label: 'Cumulative', kind: 'line', color: chartColors.slate },
          { label: 'Pre-breakeven', kind: 'band', color: chartColors.red },
          { label: 'Post-breakeven', kind: 'band', color: chartColors.emerald },
        ]}
        tooltip={(i) => ({
          title: `Year ${visible[i].year}`,
          rows: [
            {
              label: 'Annual Cash Flow',
              value: visible[i].cashFlow,
              tone: 'auto',
              swatch: { color: chartColors.teal },
            },
            {
              label: 'Cumulative',
              value: visible[i].cumulativeCashFlow,
              tone: 'auto',
              swatch: { color: chartColors.slate, kind: 'line' },
            },
          ],
        })}
      />
      <Insight>
        {recovered == null ? (
          <>
            At Year {at.year}, cumulative cash flow is{' '}
            <Figure tone={at.cumulativeCashFlow < 0 ? 'red' : 'teal'}>
              {wholeDollars(at.cumulativeCashFlow)}
            </Figure>
            . No initial cash is recorded, so recovery cannot be measured.
          </>
        ) : at.cumulativeCashFlow < 0 ? (
          <>
            At Year {at.year}, cumulative cash flow is{' '}
            <Figure tone="red">{wholeDollars(at.cumulativeCashFlow)}</Figure>: you have contributed
            more than the property has paid out, so none of your initial investment (
            {wholeDollars(invested)}) is recovered yet.
          </>
        ) : recovered < 1 ? (
          <>
            At Year {at.year}, cumulative cash flow covers <Figure>{pct(recovered)}</Figure> of your
            initial investment ({wholeDollars(invested)}).
          </>
        ) : (
          <>
            At Year {at.year}, cumulative cash flow has fully recovered your initial investment (
            {wholeDollars(invested)}) plus <Figure>{pct(recovered - 1)}</Figure> additional return.
          </>
        )}{' '}
        Operating cash only, before a sale and before tax; it is not profit. Open Exit Analysis for
        cash returned at sale.
      </Insight>
      <Tiles
        size="sm"
        items={[
          {
            label: `Cumulative cash flow · year ${at.year}`,
            value: dollars(at.cumulativeCashFlow),
            note: 'Operating cash only; not profit',
            tone: at.cumulativeCashFlow < 0 ? 'red' : 'teal',
          },
          {
            label: 'Initial cash required',
            value: dollars(invested),
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
    </ChartCard>
  );
}

/** C9 · Income to Cash Flow Bridge (reference IncomeBridgeChart), with reserves reconciled. */
function IncomeBridge({ rows }: { rows: Row[] }) {
  const [shown, horizon] = useHorizon(rows.length, 'Income bridge horizon', 10);
  const visible = rows.slice(0, shown);
  const first = rows[0];
  const last = visible.at(-1)!;
  const gap = last.noi - last.debtService;
  const margin = ratio(last.cashFlow, last.effectiveGrossIncome);
  const growth = visible.length > 1 && first.noi > 0 ? last.noi / first.noi - 1 : null;
  return (
    <ChartCard
      title="Income to Cash Flow Bridge"
      subtitle="GOI → NOI → Cash Flow (lines show income levels, bars show cash flow) · projected · before tax"
      controls={horizon}
    >
      <Tiles
        size="sm"
        items={[
          {
            label: 'GOI (Y1)',
            value: wholeDollars(first.effectiveGrossIncome),
            info: 'Gross Operating Income = Rent + Other Income − Vacancy (effective gross income)',
          },
          {
            label: 'NOI (Y1)',
            value: wholeDollars(first.noi),
            tone: 'tealSoft',
            valueTone: first.noi < 0 ? 'red' : undefined,
            info: 'Net Operating Income = GOI − Operating Expenses. Capital reserves are deducted below NOI.',
          },
          {
            label: 'OpEx Ratio',
            value: pct(ratio(first.operatingExpenses, first.effectiveGrossIncome)),
            tone: 'slate',
            info: 'Operating Expenses ÷ GOI — lower is better',
          },
          {
            label: 'NOI Margin',
            value: pct(ratio(first.noi, first.effectiveGrossIncome)),
            tone: 'slate',
            info: 'NOI ÷ GOI — higher is better',
          },
        ]}
      />
      <ComboChart
        label="Income, NOI, debt service and cash flow by year"
        years={visible.map((r) => r.year)}
        series={[
          {
            label: 'Gross Income (GOI)',
            values: visible.map((r) => r.effectiveGrossIncome),
            color: chartColors.tealMid,
            width: 2,
            dot: 2,
          },
          {
            label: 'NOI (GOI − OpEx)',
            values: visible.map((r) => r.noi),
            color: chartColors.tealDark,
            width: 2,
            dot: 2,
          },
          {
            label: 'Debt Service (annual)',
            values: visible.map((r) => r.debtService),
            color: chartColors.slateLight,
            width: 2,
            dot: 2,
            dash: '5 5',
            dashed: true,
          },
          {
            label: 'Cash Flow (NOI − Debt − Reserves)',
            kind: 'bar',
            values: visible.map((r) => r.cashFlow),
            color: chartColors.teal,
            negativeColor: chartColors.red,
          },
        ]}
        legend={[
          { label: 'Gross Income (GOI)', kind: 'line', color: chartColors.tealMid },
          { label: 'NOI (GOI − OpEx)', kind: 'line', color: chartColors.tealDark },
          { label: 'Debt Service (annual)', kind: 'dashed', color: chartColors.slateLight },
          { label: 'Cash Flow (NOI − Debt − Reserves)', kind: 'bar', color: chartColors.teal },
          ...(visible.some((r) => r.cashFlow < 0)
            ? [{ label: 'Negative year', kind: 'bar' as const, color: chartColors.red }]
            : []),
        ]}
        tooltip={(i) => {
          const r = visible[i];
          return {
            title: `Year ${r.year}`,
            rows: [
              { label: 'Gross Operating Income', value: r.effectiveGrossIncome, tone: 'teal' },
              { label: 'Operating Expenses', op: '−', value: r.operatingExpenses, tone: 'muted' },
              { label: 'NOI', op: '=', value: r.noi, tone: 'auto', total: true },
              { label: 'Debt Service', op: '−', value: r.debtService, tone: 'muted' },
              { label: 'Capital Reserves', op: '−', value: r.reserves, tone: 'muted' },
              { label: 'Cash Flow', op: '=', value: r.cashFlow, tone: 'auto', total: true },
              {
                note: `OpEx Ratio: ${pct(ratio(r.operatingExpenses, r.effectiveGrossIncome))} · NOI Margin: ${pct(ratio(r.noi, r.effectiveGrossIncome))}`,
              },
            ],
          };
        }}
      />
      <Insight>
        {gap > 0 ? (
          <>
            By Year {last.year}, NOI exceeds Debt Service by <Figure>{wholeDollars(gap)}</Figure>
            /year
            {last.reserves > 0 && (
              <>
                ; after {wholeDollars(last.reserves)} of capital reserves, cash flow is{' '}
                <Figure tone={last.cashFlow < 0 ? 'red' : 'teal'}>
                  {wholeDollars(last.cashFlow)}
                </Figure>
              </>
            )}
            , yielding a{' '}
            <Figure tone={margin != null && margin < 0 ? 'red' : 'teal'}>{pct(margin)}</Figure> cash
            flow margin on gross income.
          </>
        ) : (
          <>
            At Year {last.year}, Debt Service still exceeds NOI by{' '}
            <Figure tone="red">{wholeDollars(-gap)}</Figure>/year, so cash flow is{' '}
            <Figure tone={last.cashFlow < 0 ? 'red' : 'teal'}>{wholeDollars(last.cashFlow)}</Figure>
            .
          </>
        )}
        {growth != null && growth > 0 && (
          <>
            {' '}
            NOI grew <Figure>{pct(growth, 0)}</Figure> over this period.
          </>
        )}
      </Insight>
    </ChartCard>
  );
}

function CashFlow({ result }: { result: ProjectionResult }) {
  const rows = projectionRows(result);
  const first = rows[0];
  return (
    <div className={chartStyles.stack}>
      <CashFlowCumulative rows={rows} result={result} />
      <IncomeBridge rows={rows} />
      <ChartCard
        title="From income to cash flow"
        subtitle="Year 1 · exact breakdown · projected · USD per year"
      >
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

const mortgageText = (balance: number, financed: boolean) =>
  !financed ? 'No loan' : balance < PAID_OFF_BELOW ? 'Paid off' : wholeDollars(balance);

/** C6 · Equity Composition vs Debt Paydown (reference EquityDebtChart). */
function EquityComposition({ all, result }: { all: EquityYear[]; result: ProjectionResult }) {
  const [shown, horizon] = useHorizon(all.length, 'Equity chart horizon', 30);
  const [withPurchase, setWithPurchase] = useState(false);
  const [indexed, setIndexed] = useState(false);
  const rows = all.slice(0, shown);
  const final = rows.at(-1)!;
  const financed = result.summaryMetrics.loanAmount > 0;
  const invested = result.summaryMetrics.totalCashRequired;
  const marks = equityLandmarks(rows, financed, withPurchase);
  const finalPaid = financed && final.loanBalance < PAID_OFF_BELOW;
  const ci = marks.crossover ? marks.crossover.year - rows[0].year : null;
  const bar = (r: EquityYear) => (withPurchase ? r.initialEquity : 0) + r.equityGain;
  const base = bar(rows[0]);
  const scaled = (values: number[], b = base) => (indexed ? indexAgainst(values, b) : values);
  return (
    <ChartCard
      title="Equity Composition vs Debt Paydown"
      subtitle={`${
        indexed
          ? 'Indexed view (Y1 = 100) — shows relative growth'
          : withPurchase
            ? 'Bars = equity composition (left axis) • Line = mortgage (right axis)'
            : 'Bars = equity growth from principal + appreciation • Line = mortgage'
      } · projected year-end · before selling costs and tax`}
      controls={
        <>
          <div>
            {horizon}
            <Check label="Include down payment" checked={withPurchase} onChange={setWithPurchase} />
          </div>
          <div>
            <Segmented
              size="md"
              label="Equity chart scale"
              options={[
                { value: 'usd', label: '$ Value' },
                { value: 'index', label: 'Indexed' },
              ]}
              value={indexed ? 'index' : 'usd'}
              onChange={(value) => setIndexed(value === 'index')}
            />
          </div>
        </>
      }
    >
      <Tiles
        items={[
          {
            label: `Equity (Year ${final.year})`,
            value: wholeDollars(final.equity),
            valueTone: final.equity < 0 ? 'red' : undefined,
            note: finalPaid
              ? 'Mortgage paid off — 100% equity'
              : financed
                ? 'Property Value − Mortgage'
                : 'All-cash purchase · no mortgage',
          },
          {
            label: 'Equity Growth',
            value: wholeDollars(final.equityGain),
            valueTone: final.equityGain < 0 ? 'red' : undefined,
            tone: 'tealSoft',
            note:
              final.equityGain > 0 && invested > 0
                ? `+${((final.equityGain / invested) * 100).toFixed(0)}% of initial investment`
                : 'Principal + appreciation',
          },
          {
            label: `Mortgage (Year ${final.year})`,
            value: mortgageText(final.loanBalance, financed),
            valueTone: finalPaid ? 'teal' : undefined,
            tone: 'slate',
            note: finalPaid
              ? 'Loan fully repaid'
              : financed
                ? 'Remaining balance'
                : 'All-cash purchase',
          },
        ]}
      />
      <Chips
        items={[
          ...(marks.crossover
            ? [
                {
                  tone: 'teal' as const,
                  text: `${withPurchase ? 'Total equity' : 'Equity gain'} exceeds debt in Year ${marks.crossover.year}`,
                },
              ]
            : []),
          ...(marks.paidOff ? [{ text: `Mortgage paid off in Year ${marks.paidOff.year}` }] : []),
          ...(marks.momentum ? [{ tone: 'tealSoft' as const, text: marks.momentum }] : []),
        ]}
      />
      <ComboChart
        label="Equity composition and loan balance"
        unit={indexed ? 'Index' : 'USD'}
        years={rows.map((r) => r.year)}
        axes={{
          left: indexed ? 'Index' : withPurchase ? 'Equity' : 'Equity Growth',
          right: financed ? (indexed ? 'Index' : 'Debt') : undefined,
          leftColor: chartColors.tealDeep,
          rightColor: chartColors.slateMid,
        }}
        series={[
          ...(withPurchase
            ? [
                {
                  label: 'Down payment',
                  kind: 'bar' as const,
                  stack: true,
                  values: scaled(rows.map((r) => r.initialEquity)),
                  color: chartColors.slatePale,
                  opacity: 0.5,
                  stroke: '#cbd5e1',
                },
              ]
            : []),
          {
            label: 'Principal paid',
            kind: 'bar',
            stack: true,
            values: scaled(rows.map((r) => r.principalEquity)),
            color: chartColors.teal,
          },
          {
            label: 'Appreciation & repair value change',
            kind: 'bar',
            stack: true,
            values: scaled(rows.map((r) => r.appreciationEquity)),
            color: chartColors.tealLight,
            negativeColor: chartColors.red,
          },
          ...(financed
            ? [
                {
                  label: 'Mortgage balance',
                  values: scaled(
                    rows.map((r) => r.loanBalance),
                    rows[0].loanBalance,
                  ),
                  color: chartColors.slateMid,
                  width: 3,
                  dot: 2,
                },
              ]
            : []),
        ]}
        bands={
          !indexed && ci != null
            ? [{ from: ci - 0.5, to: rows.length - 1, color: chartColors.teal, opacity: 0.08 }]
            : []
        }
        markers={
          !indexed && ci != null
            ? [
                {
                  index: ci,
                  label: withPurchase ? 'Equity > Debt' : 'Gain > Debt',
                  color: chartColors.tealDark,
                  dot: rows[ci].loanBalance,
                  align: 'end',
                },
              ]
            : []
        }
        legend={[
          ...(financed
            ? [{ label: 'Mortgage Balance', kind: 'line' as const, color: chartColors.slateMid }]
            : []),
          { label: 'Appreciation', kind: 'bar', color: chartColors.tealLight },
          { label: 'Principal Paid', kind: 'bar', color: chartColors.teal },
          ...(withPurchase
            ? [{ label: 'Down Payment', kind: 'bar' as const, color: '#cbd5e1' }]
            : []),
          ...(rows.some((r) => r.appreciationEquity < 0)
            ? [{ label: 'Value decline', kind: 'bar' as const, color: chartColors.red }]
            : []),
        ]}
        tooltip={(i) => {
          const r = rows[i];
          return {
            title: `Year ${r.year}`,
            rows: [
              { label: 'Property Value', value: r.propertyValue, money: true },
              {
                label: 'Mortgage Balance',
                op: '−',
                value: r.loanBalance,
                money: true,
                text: financed && r.loanBalance < PAID_OFF_BELOW ? 'Paid off' : undefined,
                tone: financed && r.loanBalance < PAID_OFF_BELOW ? 'teal' : 'muted',
              },
              { label: 'Equity', op: '=', value: r.equity, money: true, tone: 'auto', total: true },
              { section: 'Equity Composition' },
              ...(withPurchase
                ? [
                    {
                      label: 'Down payment',
                      value: r.initialEquity,
                      money: true,
                      swatch: { color: chartColors.slatePale },
                    },
                  ]
                : []),
              {
                label: 'Principal paid',
                value: r.principalEquity,
                money: true,
                swatch: { color: chartColors.teal },
              },
              {
                label: 'Appreciation',
                value: r.appreciationEquity,
                money: true,
                swatch: {
                  color: r.appreciationEquity < 0 ? chartColors.red : chartColors.tealLight,
                },
              },
              ...(indexed
                ? [
                    {
                      note: `Index (Y1 = 100): bars ${indexAgainst([bar(r)], base)[0]?.toFixed(1) ?? 'Unavailable'}${
                        financed
                          ? ` · mortgage ${indexAgainst([r.loanBalance], rows[0].loanBalance)[0]?.toFixed(1) ?? 'Unavailable'}`
                          : ''
                      }`,
                    },
                  ]
                : []),
            ],
          };
        }}
      />
      {indexed && (
        <p className={chartStyles.footnote}>
          Y1 = 100. Higher values show faster growth relative to starting point.
          {base <= 0 && ' Year-1 equity is not positive, so the bars cannot be indexed.'}
        </p>
      )}
    </ChartCard>
  );
}

/** C7 · Value vs Mortgage Balance (reference EquityChart): equity is the band between. */
function ValueVsMortgage({
  all,
  result,
  startValue,
}: {
  all: EquityYear[];
  result: ProjectionResult;
  startValue: number;
}) {
  const [shown, horizon] = useHorizon(all.length, 'Value vs mortgage horizon', 30);
  const rows = all.slice(0, shown);
  const loan = result.summaryMetrics.loanAmount;
  const financed = loan > 0;
  const points = [
    { year: 0, propertyValue: startValue, loanBalance: loan, equity: startValue - loan },
    ...rows,
  ];
  const final = rows.at(-1)!;
  const start = points[0];
  const growth = final.equity - start.equity;
  const growthRate = start.equity > 0 ? final.equity / start.equity - 1 : null;
  return (
    <ChartCard
      title="Value vs Mortgage Balance"
      subtitle={
        <>
          Equity = Property Value − Mortgage Balance (shaded area) ·{' '}
          <b className={chartStyles.grew} data-negative={growth < 0 || undefined}>
            Equity {growth < 0 ? 'fell' : 'grew'} {growth < 0 ? '' : '+'}
            {wholeDollars(growth)}
            {growthRate != null && ` (${(growthRate * 100).toFixed(0)}%)`}
          </b>{' '}
          · projected
        </>
      }
      controls={horizon}
    >
      <Tiles
        size="sm"
        items={[
          { label: 'Property Value', value: wholeDollars(final.propertyValue), tone: 'slate' },
          { label: 'Mortgage', value: mortgageText(final.loanBalance, financed), tone: 'slate' },
          {
            label: 'Equity',
            value: wholeDollars(final.equity),
            valueTone: final.equity < 0 ? 'red' : undefined,
          },
        ]}
      />
      <ComboChart
        label="Property value and mortgage balance"
        height={288}
        years={points.map((p) => p.year)}
        series={[
          {
            label: 'Property Value',
            values: points.map((p) => p.propertyValue),
            color: chartColors.slateDark,
            dot: 3,
          },
          {
            label: 'Mortgage Balance',
            values: points.map((p) => p.loanBalance),
            color: chartColors.slateLight,
            dot: 3,
          },
        ]}
        areas={[
          {
            upper: points.map((p) => p.propertyValue),
            lower: points.map((p) => p.loanBalance),
            color: chartColors.teal,
          },
        ]}
        legend={[
          { label: 'Property Value', kind: 'line', color: chartColors.slateDark },
          { label: 'Mortgage Balance', kind: 'line', color: chartColors.slateLight },
          { label: 'Equity (shaded area)', kind: 'area', color: chartColors.teal },
        ]}
        tooltip={(i) => {
          const p = points[i];
          return {
            title: i === 0 ? 'Start' : `End of Year ${p.year}`,
            rows: [
              { label: 'Property Value', value: p.propertyValue },
              {
                label: 'Mortgage Balance',
                op: '−',
                value: p.loanBalance,
                text: financed && p.loanBalance < PAID_OFF_BELOW ? 'Paid off' : undefined,
                tone: 'muted',
              },
              { label: 'Equity', op: '=', value: p.equity, tone: 'auto', total: true },
              {
                note:
                  financed && p.loanBalance < PAID_OFF_BELOW
                    ? 'Mortgage paid off — 100% equity'
                    : `Equity is ${pct(ratio(p.equity, p.propertyValue), 0)} of property value`,
              },
            ],
          };
        }}
      />
      <p className={chartStyles.footnote}>
        The <i className={chartStyles.bandSwatch} aria-hidden="true" /> teal band between the lines
        represents your equity. Start uses the after-repair value (or purchase price) and the
        original loan.
      </p>
    </ChartCard>
  );
}

function Equity({ result, startValue }: { result: ProjectionResult; startValue: number }) {
  const all = equityYears(result);
  const final = all.at(-1)!;
  const cumulative = result.annualCashflows.find((y) => y.year === final.year)?.cumulativeCashFlow;
  return (
    <div className={chartStyles.stack}>
      <EquityComposition all={all} result={result} />
      <ValueVsMortgage all={all} result={result} startValue={startValue} />
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

/** Reference sub-tab order: Equity first. */
export const projectionPanels = [
  { id: 'equity', label: 'Equity' },
  { id: 'cash-flow', label: 'Cash Flow' },
  { id: 'expenses', label: 'Expenses' },
  { id: 'amortization', label: 'Amortization' },
  { id: 'exit', label: 'Exit Analysis' },
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
  const [panel, setPanel] = useState<string>('equity');
  const content: Record<string, ReactNode> =
    result && calculatedPayload
      ? {
          'cash-flow': <CashFlow result={result} />,
          equity: (
            <Equity
              result={result}
              startValue={
                calculatedPayload.input.purchase?.afterRepairValue ??
                result.summaryMetrics.purchasePrice
              }
            />
          ),
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
