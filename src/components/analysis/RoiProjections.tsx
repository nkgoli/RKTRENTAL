'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { AnalysisPayload } from '@/lib/analysis/contract';
import { dollars, projectionRows, type ProjectionResult } from '@/lib/analysis/projections';
import {
  PAID_OFF_BELOW,
  breakevenYear,
  equityLandmarks,
  equityYears,
  indexAgainst,
  wholeDollars,
  type EquityYear,
} from '@/lib/analysis/chart-data';
import {
  ChartCard,
  Check,
  ComboChart,
  ExactTable,
  Figure,
  InfoTip,
  Insight,
  MoreDetail,
  Segmented,
  Tiles,
  entityColors,
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
  const list = useRef<HTMLDivElement>(null);
  // Which ends of a sideways-scrolling row hide more tabs ("start end"); empty when all fit.
  const [more, setMore] = useState('');
  useEffect(() => {
    // On phones the tabs scroll sideways; keep the selected one in view without moving the page.
    const row = list.current;
    const tab = row?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!row || !tab || row.scrollWidth <= row.clientWidth) return;
    const left = tab.offsetLeft - row.offsetLeft;
    if (left < row.scrollLeft || left + tab.offsetWidth > row.scrollLeft + row.clientWidth)
      row.scrollLeft = Math.max(0, left - 16);
  }, [value]);
  useEffect(() => {
    const row = list.current;
    if (!row) return;
    const measure = () => {
      const hidden = row.scrollWidth - row.clientWidth;
      setMore(
        [row.scrollLeft > 1 && 'start', hidden > 1 && row.scrollLeft < hidden - 1 && 'end']
          .filter(Boolean)
          .join(' '),
      );
    };
    measure();
    row.addEventListener('scroll', measure, { passive: true });
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(row);
    return () => {
      row.removeEventListener('scroll', measure);
      observer?.disconnect();
    };
  }, []);
  return (
    <div
      ref={list}
      className={chartStyles.tabs}
      role="tablist"
      aria-label={label}
      data-more={more || undefined}
    >
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

/** Thin labelled bars from one zero line; an optional colour names the entity. */
function Bars({ rows }: { rows: [string, number, string?][] }) {
  const min = Math.min(0, ...rows.map((r) => r[1]));
  const max = Math.max(0, ...rows.map((r) => r[1]));
  const span = max - min || 1;
  const zero = (-min / span) * 100;
  return (
    <dl className={chartStyles.bars}>
      {rows.map(([label, value, color]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>
            <span className={chartStyles.track} aria-hidden="true">
              <i
                data-negative={value < 0 || undefined}
                style={{
                  left: `${value < 0 ? ((value - min) / span) * 100 : zero}%`,
                  width: `${(Math.abs(value) / span) * 100}%`,
                  background:
                    value < 0 ? entityColors.negative : (color ?? entityColors.cashFlow),
                }}
              />
              {min < 0 && <b style={{ left: `${zero}%` }} />}
            </span>
            <span className={value < 0 ? chartStyles.negative : undefined}>
              {wholeDollars(value)}
            </span>
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

/** C8 · Cash flow by year: annual bars and the running total since purchase. */
function CashFlowCumulative({ rows, result }: { rows: Row[]; result: ProjectionResult }) {
  const [shown, horizon] = useHorizon(rows.length, 'Cash flow chart horizon', 10);
  const visible = rows.slice(0, shown);
  const be = breakevenYear(visible);
  const beIndex = be == null ? null : be - visible[0].year;
  const at = visible.at(-1)!;
  const metrics = result.summaryMetrics;
  const invested = metrics.totalCashRequired;
  const recovered = ratio(at.cumulativeCashFlow, invested);
  const anyPositive = visible.some((r) => r.cashFlow >= 0);
  const anyNegative = visible.some((r) => r.cashFlow < 0);
  return (
    <ChartCard title="Cash flow by year" controls={horizon}>
      <Tiles
        items={[
          {
            label: `Cumulative · year ${at.year}`,
            value: wholeDollars(at.cumulativeCashFlow),
            negative: at.cumulativeCashFlow < 0,
          },
          { label: 'Cash invested', value: wholeDollars(invested) },
          {
            label: 'Recovered',
            value: pct(recovered),
            negative: recovered != null && recovered < 0,
            note:
              recovered != null && recovered < 0 ? `Still paying in at year ${at.year}` : undefined,
          },
          {
            label: 'Cash payback',
            value:
              metrics.paybackPeriodYears == null
                ? 'Not within hold'
                : `${metrics.paybackPeriodYears.toFixed(2)} years`,
          },
        ]}
      />
      <ComboChart
        label="Annual and cumulative operating cash flow"
        years={visible.map((r) => r.year)}
        series={[
          {
            label: 'Cash flow',
            kind: 'bar',
            values: visible.map((r) => r.cashFlow),
            color: entityColors.cashFlow,
            negativeColor: entityColors.negative,
          },
          {
            label: 'Cumulative',
            values: visible.map((r) => r.cumulativeCashFlow),
            color: entityColors.cumulative,
          },
        ]}
        markers={
          beIndex == null
            ? []
            : [
                {
                  index: beIndex,
                  label: 'Breakeven',
                  color: entityColors.cumulative,
                  dot: visible[beIndex].cumulativeCashFlow,
                  align: 'end',
                },
              ]
        }
        // Only what is drawn: no cash-flow key when every year is negative.
        legend={[
          ...(anyPositive
            ? [{ label: 'Cash flow', kind: 'bar' as const, color: entityColors.cashFlow }]
            : []),
          ...(anyNegative
            ? [{ label: 'Negative year', kind: 'bar' as const, color: entityColors.negative }]
            : []),
          { label: 'Cumulative', kind: 'line', color: entityColors.cumulative },
        ]}
        tooltip={(i) => ({
          title: `Year ${visible[i].year}`,
          rows: [
            {
              label: 'Cash flow',
              value: visible[i].cashFlow,
              tone: 'auto',
              swatch: { color: entityColors.cashFlow },
            },
            {
              label: 'Cumulative',
              value: visible[i].cumulativeCashFlow,
              tone: 'auto',
              swatch: { color: entityColors.cumulative, kind: 'line' },
            },
          ],
        })}
      />
      <Insight>
        {be != null ? (
          <>
            <span>Breakeven: Year {be}</span>
            <InfoTip label="breakeven">First year cumulative cash flow turns positive</InfoTip>
          </>
        ) : (
          <span>No breakeven by Year {at.year}</span>
        )}
      </Insight>
    </ChartCard>
  );
}

/** C9 · NOI against debt service, with the cash flow they leave, reserves reconciled. */
function IncomeBridge({ rows }: { rows: Row[] }) {
  const [shown, horizon] = useHorizon(rows.length, 'Income bridge horizon', 10);
  const visible = rows.slice(0, shown);
  const last = visible.at(-1)!;
  const gap = last.noi - last.debtService;
  return (
    <ChartCard title="NOI and debt service" controls={horizon}>
      <ComboChart
        label="Income, NOI, debt service and cash flow by year"
        years={visible.map((r) => r.year)}
        series={[
          {
            label: 'Effective income',
            values: visible.map((r) => r.effectiveGrossIncome),
            color: entityColors.income,
          },
          { label: 'NOI', values: visible.map((r) => r.noi), color: entityColors.noi },
          {
            label: 'Debt service',
            values: visible.map((r) => r.debtService),
            color: entityColors.debtService,
          },
          {
            label: 'Cash flow',
            kind: 'bar',
            values: visible.map((r) => r.cashFlow),
            color: entityColors.cashFlow,
            negativeColor: entityColors.negative,
          },
        ]}
        legend={[
          { label: 'Effective income', kind: 'line', color: entityColors.income },
          { label: 'NOI', kind: 'line', color: entityColors.noi },
          { label: 'Debt service', kind: 'line', color: entityColors.debtService },
          ...(visible.some((r) => r.cashFlow >= 0)
            ? [{ label: 'Cash flow', kind: 'bar' as const, color: entityColors.cashFlow }]
            : []),
          ...(visible.some((r) => r.cashFlow < 0)
            ? [{ label: 'Negative year', kind: 'bar' as const, color: entityColors.negative }]
            : []),
        ]}
        tooltip={(i) => {
          const r = visible[i];
          return {
            title: `Year ${r.year}`,
            rows: [
              { label: 'Effective income', value: r.effectiveGrossIncome },
              { label: 'Operating expenses', op: '−', value: r.operatingExpenses, tone: 'muted' },
              { label: 'NOI', op: '=', value: r.noi, tone: 'auto', total: true },
              { label: 'Debt service', op: '−', value: r.debtService, tone: 'muted' },
              { label: 'Capital reserves', op: '−', value: r.reserves, tone: 'muted' },
              { label: 'Cash flow', op: '=', value: r.cashFlow, tone: 'auto', total: true },
              {
                note: `OpEx ratio ${pct(ratio(r.operatingExpenses, r.effectiveGrossIncome))} · NOI margin ${pct(ratio(r.noi, r.effectiveGrossIncome))}`,
              },
            ],
          };
        }}
      />
      <Insight>
        {gap > 0 ? (
          <>
            By year {last.year}, NOI exceeds debt service by <Figure>{wholeDollars(gap)}</Figure> a
            year.
          </>
        ) : (
          <>
            At year {last.year}, debt service exceeds NOI by{' '}
            <Figure tone="red">{wholeDollars(-gap)}</Figure> a year.
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
      <ChartCard title="Year 1 breakdown">
        <Bars
          rows={[
            ['Scheduled rent', first.grossRent],
            ['Other income', first.otherIncome],
            ['Vacancy loss', -first.vacancyLoss],
            ['Effective income', first.effectiveGrossIncome],
            ['Operating costs', -first.operatingExpenses],
            ['Net operating income', first.noi],
            ['Debt service', -first.debtService],
            ['Capital reserves', -first.reserves],
            ['Cash flow', first.cashFlow],
          ]}
        />
        <MoreDetail summary="View exact amounts">
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
        </MoreDetail>
      </ChartCard>
    </div>
  );
}

const mortgageText = (balance: number, financed: boolean) =>
  !financed ? 'No loan' : balance < PAID_OFF_BELOW ? 'Paid off' : wholeDollars(balance);

/** C6 · Equity build-up: principal paid and appreciation against the mortgage still owed. */
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
  // The one landmark that matters: when equity overtakes the debt, else when the loan is gone.
  const landmark = marks.crossover
    ? `${withPurchase ? 'Total equity' : 'Equity gain'} exceeds debt in Year ${marks.crossover.year}`
    : marks.paidOff
      ? `Mortgage paid off in Year ${marks.paidOff.year}`
      : null;
  return (
    <ChartCard
      title="Equity build-up"
      subtitle={indexed ? 'Indexed, Year 1 = 100' : undefined}
      controls={
        <>
          {horizon}
          <Segmented
            label="Equity chart scale"
            options={[
              { value: 'usd', label: 'Dollars' },
              { value: 'index', label: 'Indexed' },
            ]}
            value={indexed ? 'index' : 'usd'}
            onChange={(value) => setIndexed(value === 'index')}
          />
          <Check label="Include down payment" checked={withPurchase} onChange={setWithPurchase} />
        </>
      }
    >
      <Tiles
        items={[
          {
            label: `Equity · year ${final.year}`,
            value: wholeDollars(final.equity),
            negative: final.equity < 0,
            note: finalPaid ? 'Mortgage paid off — 100% equity' : undefined,
          },
          {
            label: 'Equity growth',
            value: wholeDollars(final.equityGain),
            negative: final.equityGain < 0,
            note:
              final.equityGain > 0 && invested > 0
                ? `+${((final.equityGain / invested) * 100).toFixed(0)}% of cash invested`
                : undefined,
          },
          {
            label: `Mortgage · year ${final.year}`,
            value: mortgageText(final.loanBalance, financed),
          },
        ]}
      />
      <ComboChart
        label="Equity composition and loan balance"
        unit={indexed ? 'Index' : 'USD'}
        years={rows.map((r) => r.year)}
        series={[
          ...(withPurchase
            ? [
                {
                  label: 'Down payment',
                  kind: 'bar' as const,
                  stack: true,
                  values: scaled(rows.map((r) => r.initialEquity)),
                  color: entityColors.purchaseEquity,
                },
              ]
            : []),
          {
            label: 'Principal paid',
            kind: 'bar',
            stack: true,
            values: scaled(rows.map((r) => r.principalEquity)),
            color: entityColors.principal,
          },
          {
            label: 'Appreciation & repair value change',
            kind: 'bar',
            stack: true,
            values: scaled(rows.map((r) => r.appreciationEquity)),
            color: entityColors.appreciation,
            negativeColor: entityColors.negative,
          },
          ...(financed
            ? [
                {
                  label: 'Mortgage balance',
                  values: scaled(
                    rows.map((r) => r.loanBalance),
                    rows[0].loanBalance,
                  ),
                  color: entityColors.balance,
                },
              ]
            : []),
        ]}
        markers={
          !indexed && ci != null
            ? [
                {
                  index: ci,
                  label: withPurchase ? 'Equity > Debt' : 'Gain > Debt',
                  color: entityColors.balance,
                  dot: rows[ci].loanBalance,
                  align: 'end',
                },
              ]
            : []
        }
        // Stack order, bottom up, then the line; no principal key without a loan.
        legend={[
          ...(withPurchase
            ? [{ label: 'Down payment', kind: 'bar' as const, color: entityColors.purchaseEquity }]
            : []),
          ...(financed
            ? [{ label: 'Principal paid', kind: 'bar' as const, color: entityColors.principal }]
            : []),
          { label: 'Appreciation', kind: 'bar', color: entityColors.appreciation },
          ...(rows.some((r) => r.appreciationEquity < 0)
            ? [{ label: 'Value decline', kind: 'bar' as const, color: entityColors.negative }]
            : []),
          ...(financed
            ? [{ label: 'Mortgage balance', kind: 'line' as const, color: entityColors.balance }]
            : []),
        ]}
        tooltip={(i) => {
          const r = rows[i];
          return {
            title: `Year ${r.year}`,
            rows: [
              { label: 'Property value', value: r.propertyValue, money: true },
              {
                label: 'Mortgage balance',
                op: '−',
                value: r.loanBalance,
                money: true,
                text: financed && r.loanBalance < PAID_OFF_BELOW ? 'Paid off' : undefined,
                tone: 'muted',
              },
              { label: 'Equity', op: '=', value: r.equity, money: true, tone: 'auto', total: true },
              { section: 'Equity composition' },
              ...(withPurchase
                ? [
                    {
                      label: 'Down payment',
                      value: r.initialEquity,
                      money: true,
                      swatch: { color: entityColors.purchaseEquity },
                    },
                  ]
                : []),
              {
                label: 'Principal paid',
                value: r.principalEquity,
                money: true,
                swatch: { color: entityColors.principal },
              },
              {
                label: 'Appreciation',
                value: r.appreciationEquity,
                money: true,
                swatch: {
                  color:
                    r.appreciationEquity < 0 ? entityColors.negative : entityColors.appreciation,
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
      {landmark && <Insight>{landmark}</Insight>}
      {indexed && base <= 0 && (
        <p className={chartStyles.footnote}>Year 1 equity is not positive, so it cannot be indexed.</p>
      )}
    </ChartCard>
  );
}

/** C7 · Value vs mortgage: equity is the soft band between the two lines. */
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
      title={financed ? 'Value vs mortgage' : 'Property value'}
      subtitle={
        <>
          Equity {growth < 0 ? 'fell' : 'grew'}{' '}
          <b className={chartStyles.grew}>
            {growth < 0 ? '' : '+'}
            {wholeDollars(growth)}
          </b>
          {growthRate != null && ` (${(growthRate * 100).toFixed(0)}%)`} by year {final.year}
        </>
      }
      controls={horizon}
    >
      <ComboChart
        label="Property value and mortgage balance"
        years={points.map((p) => p.year)}
        xFormat={(year) => (year === 0 ? 'Start' : String(year))}
        // Label every year on short holds; the chart thins them when they would collide.
        xTicks={points.length <= 11 ? points.map((_, i) => i) : undefined}
        series={[
          {
            label: 'Property value',
            values: points.map((p) => p.propertyValue),
            color: entityColors.propertyValue,
          },
          ...(financed
            ? [
                {
                  label: 'Mortgage balance',
                  values: points.map((p) => p.loanBalance),
                  color: entityColors.balance,
                },
              ]
            : []),
        ]}
        areas={[
          {
            upper: points.map((p) => p.propertyValue),
            lower: points.map((p) => p.loanBalance),
            color: entityColors.propertyValue,
          },
        ]}
        legend={[
          { label: 'Property value', kind: 'line', color: entityColors.propertyValue },
          ...(financed
            ? [{ label: 'Mortgage balance', kind: 'line' as const, color: entityColors.balance }]
            : []),
          { label: 'Equity', kind: 'area', color: entityColors.propertyValue },
        ]}
        tooltip={(i) => {
          const p = points[i];
          return {
            title: i === 0 ? 'Start' : `End of year ${p.year}`,
            rows: [
              { label: 'Property value', value: p.propertyValue },
              {
                label: 'Mortgage balance',
                op: '−',
                value: p.loanBalance,
                text: !financed
                  ? 'No loan'
                  : p.loanBalance < PAID_OFF_BELOW
                    ? 'Paid off'
                    : undefined,
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
      <MoreDetail summary="View exact amounts">
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
      </MoreDetail>
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
        <ChartCard title={`Equity at year ${final.year}`}>
          <Bars
            rows={[
              ['Purchase equity', final.initialEquity, entityColors.purchaseEquity],
              ['Principal paid', final.principalEquity, entityColors.principal],
              [
                'Appreciation & repair value change',
                final.appreciationEquity,
                entityColors.appreciation,
              ],
            ]}
          />
        </ChartCard>
        <ChartCard title="Equity + cash flow" subtitle={`Year ${final.year} · before selling costs`}>
          <p
            className={chartStyles.big}
            data-negative={(cumulative ?? 0) + final.equity < 0 || undefined}
          >
            {wholeDollars(cumulative == null ? null : final.equity + cumulative)}
          </p>
          <p className={chartStyles.sum}>
            Equity {wholeDollars(final.equity)} {cumulative != null && cumulative < 0 ? '−' : '+'}{' '}
            cash flow {cumulative == null ? 'Unavailable' : wholeDollars(Math.abs(cumulative))}
          </p>
        </ChartCard>
      </div>
    </div>
  );
}

/** Reference sub-tab order: Equity first. */
export const projectionPanels = [
  { id: 'equity', label: 'Equity' },
  { id: 'cash-flow', label: 'Cash flow' },
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
  panel: chosen,
  onPanel,
}: {
  result: ProjectionResult | null;
  calculatedPayload: AnalysisPayload | null;
  calculationVersion: number;
  stale: boolean;
  saving: boolean;
  onEdit: (path?: string) => void;
  /** The selected sub-tab when the workspace keeps it in the address; otherwise kept here. */
  panel?: string;
  onPanel?: (panel: string) => void;
}) {
  const [own, setOwn] = useState<string>('equity');
  const panel = chosen ?? own;
  const setPanel = onPanel ?? setOwn;
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
      <p className={chartStyles.context}>
        {result ? (
          <>
            {stale ? <b>Out of date</b> : 'Projected'} · {result.annualCashflows.length}-year hold
            · before tax
          </>
        ) : (
          'No valid projection available'
        )}
      </p>
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
              <p>Enter the purchase, income and financing details.</p>
              <button onClick={() => onEdit()}>Review assumptions</button>
            </section>
          )}
        </div>
      ))}
    </div>
  );
}
