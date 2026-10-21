'use client';

import { useState, type ReactNode } from 'react';
import type { AnalysisPayload } from '@/lib/analysis/contract';
import { dollars, projectionRows, rate, type ProjectionResult } from '@/lib/analysis/projections';
import {
  PAID_OFF_BELOW,
  breakevenYear,
  cashFlowLandmarks,
  equityAxisMax,
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
  ExactTable,
  Figure,
  Insight,
  Segmented,
  Tiles,
  chartColors,
  useHorizon,
} from './RoiChart';
import { Amortization } from './RoiAmortization';
import { Expenses } from './RoiExpenses';
import { Exit } from './RoiExit';
import { Sensitivity } from './RoiSensitivity';
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
                  background: value < 0 ? chartColors.bad : chartColors.primary,
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
            color: chartColors.primary,
            negativeColor: chartColors.bad,
          },
          {
            label: 'Cumulative',
            values: visible.map((r) => r.cumulativeCashFlow),
            color: chartColors.muted,
            width: 3,
            dot: 3,
          },
        ]}
        bands={
          beIndex == null
            ? [{ from: 0, to: visible.length - 1, color: chartColors.bad }]
            : [
                { from: 0, to: beIndex - 0.5, color: chartColors.bad },
                { from: beIndex + 0.5, to: visible.length - 1, color: chartColors.accent },
              ]
        }
        markers={
          beIndex == null
            ? []
            : [
                {
                  index: beIndex,
                  label: 'Breakeven',
                  color: chartColors.accent,
                  dot: visible[beIndex].cumulativeCashFlow,
                  align: 'end',
                },
              ]
        }
        legend={[
          { label: 'Cash Flow', kind: 'bar', color: chartColors.primary },
          ...(visible.some((r) => r.cashFlow < 0)
            ? [{ label: 'Negative year', kind: 'bar' as const, color: chartColors.bad }]
            : []),
          { label: 'Cumulative', kind: 'line', color: chartColors.muted },
          { label: 'Pre-breakeven', kind: 'band', color: chartColors.bad },
          { label: 'Post-breakeven', kind: 'band', color: chartColors.accent },
        ]}
        tooltip={(i) => ({
          title: `Year ${visible[i].year}`,
          rows: [
            {
              label: 'Annual Cash Flow',
              value: visible[i].cashFlow,
              tone: 'auto',
              swatch: { color: chartColors.primary },
            },
            {
              label: 'Cumulative',
              value: visible[i].cumulativeCashFlow,
              tone: 'auto',
              swatch: { color: chartColors.muted, kind: 'line' },
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
            color: chartColors.primaryMid,
            width: 2,
            dot: 2,
          },
          {
            label: 'NOI (GOI − OpEx)',
            values: visible.map((r) => r.noi),
            color: chartColors.primaryDark,
            width: 2,
            dot: 2,
          },
          {
            label: 'Debt Service (annual)',
            values: visible.map((r) => r.debtService),
            color: chartColors.mutedLight,
            width: 2,
            dot: 2,
            dash: '5 5',
            dashed: true,
          },
          {
            label: 'Cash Flow (NOI − Debt − Reserves)',
            kind: 'bar',
            values: visible.map((r) => r.cashFlow),
            color: chartColors.primary,
            negativeColor: chartColors.bad,
          },
        ]}
        legend={[
          { label: 'Gross Income (GOI)', kind: 'line', color: chartColors.primaryMid },
          { label: 'NOI (GOI − OpEx)', kind: 'line', color: chartColors.primaryDark },
          { label: 'Debt Service (annual)', kind: 'dashed', color: chartColors.mutedLight },
          { label: 'Cash Flow (NOI − Debt − Reserves)', kind: 'bar', color: chartColors.primary },
          ...(visible.some((r) => r.cashFlow < 0)
            ? [{ label: 'Negative year', kind: 'bar' as const, color: chartColors.bad }]
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
        domainMax={(largest) => equityAxisMax(largest, indexed)}
        axes={{
          left: indexed ? 'Index' : withPurchase ? 'Equity' : 'Equity Growth',
          right: financed ? (indexed ? 'Index' : 'Debt') : undefined,
          leftColor: chartColors.navy,
          rightColor: chartColors.mutedMid,
        }}
        series={[
          ...(withPurchase
            ? [
                {
                  label: 'Down payment',
                  kind: 'bar' as const,
                  stack: true,
                  values: scaled(rows.map((r) => r.initialEquity)),
                  color: chartColors.border,
                  opacity: 0.5,
                  stroke: '#c5cfdc',
                },
              ]
            : []),
          {
            label: 'Principal paid',
            kind: 'bar',
            stack: true,
            values: scaled(rows.map((r) => r.principalEquity)),
            color: chartColors.primary,
          },
          {
            label: 'Appreciation & repair value change',
            kind: 'bar',
            stack: true,
            values: scaled(rows.map((r) => r.appreciationEquity)),
            color: chartColors.primaryLight,
            negativeColor: chartColors.bad,
          },
          ...(financed
            ? [
                {
                  label: 'Mortgage balance',
                  values: scaled(
                    rows.map((r) => r.loanBalance),
                    rows[0].loanBalance,
                  ),
                  color: chartColors.mutedMid,
                  width: 3,
                  dot: 2,
                },
              ]
            : []),
        ]}
        bands={
          !indexed && ci != null
            ? [{ from: ci - 0.5, to: rows.length - 1, color: chartColors.primary, opacity: 0.08 }]
            : []
        }
        markers={
          !indexed && ci != null
            ? [
                {
                  index: ci,
                  label: withPurchase ? 'Equity > Debt' : 'Gain > Debt',
                  color: chartColors.primaryDark,
                  dot: rows[ci].loanBalance,
                  align: 'end',
                },
              ]
            : []
        }
        legend={[
          ...(financed
            ? [{ label: 'Mortgage Balance', kind: 'line' as const, color: chartColors.mutedMid }]
            : []),
          { label: 'Appreciation', kind: 'bar', color: chartColors.primaryLight },
          { label: 'Principal Paid', kind: 'bar', color: chartColors.primary },
          ...(withPurchase
            ? [{ label: 'Down Payment', kind: 'bar' as const, color: '#c5cfdc' }]
            : []),
          ...(rows.some((r) => r.appreciationEquity < 0)
            ? [{ label: 'Value decline', kind: 'bar' as const, color: chartColors.bad }]
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
                      swatch: { color: chartColors.border },
                    },
                  ]
                : []),
              {
                label: 'Principal paid',
                value: r.principalEquity,
                money: true,
                swatch: { color: chartColors.primary },
              },
              {
                label: 'Appreciation',
                value: r.appreciationEquity,
                money: true,
                swatch: {
                  color: r.appreciationEquity < 0 ? chartColors.bad : chartColors.primaryLight,
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
            color: chartColors.ink,
            dot: 3,
          },
          {
            label: 'Mortgage Balance',
            values: points.map((p) => p.loanBalance),
            color: chartColors.mutedLight,
            dot: 3,
          },
        ]}
        areas={[
          {
            upper: points.map((p) => p.propertyValue),
            lower: points.map((p) => p.loanBalance),
            color: chartColors.primary,
          },
        ]}
        legend={[
          { label: 'Property Value', kind: 'line', color: chartColors.ink },
          { label: 'Mortgage Balance', kind: 'line', color: chartColors.mutedLight },
          { label: 'Equity (shaded area)', kind: 'area', color: chartColors.primary },
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
        rates to four decimal places (sensitivity rates to one), without hover.
      </p>
    </div>
  );
}
