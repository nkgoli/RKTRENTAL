'use client';

import { useId, useState } from 'react';
import {
  calendarYear,
  equityYears,
  firstPositiveAfterNegative,
  milestoneYears,
  wealthAt,
  wholeDollars,
} from '@/lib/analysis/chart-data';
import { dollars, projectionRows, type ProjectionResult } from '@/lib/analysis/projections';
import {
  ChartCard,
  ComboChart,
  Donut,
  ExactTable,
  InfoTip,
  MiniBar,
  MoreDetail,
  Segmented,
  entityColors,
  useHorizon,
} from './RoiChart';
import s from './summary-charts.module.css';

const pct = (value: number | null, digits = 2) =>
  value == null || !Number.isFinite(value) ? 'Unavailable' : `${(value * 100).toFixed(digits)}%`;
const signed = (value: number) => `${value > 0 ? '+' : ''}${wholeDollars(value)}`;

/** C1 · Net cash flow by year (bars; the Summary shows the same series as a table). */
export function NetCashFlowCard({ result }: { result: ProjectionResult }) {
  const rows = projectionRows(result);
  const [shown, horizon] = useHorizon(rows.length, 'Net cash flow horizon', 5);
  const visible = rows.slice(0, shown);
  const values = visible.map((r) => r.cashFlow);
  const turn = firstPositiveAfterNegative(values);
  return (
    <ChartCard title="Net cash flow by year" controls={horizon}>
      <ComboChart
        label={`Net cash flow, years 1 to ${visible.length}`}
        height={240}
        xFormat={(y) => `Y${y}`}
        years={visible.map((r) => r.year)}
        series={[
          {
            label: 'Net cash flow',
            kind: 'bar',
            values,
            color: entityColors.cashFlow,
            negativeColor: entityColors.negative,
          },
        ]}
        markers={
          turn == null
            ? []
            : [{ index: turn, label: `Positive Y${visible[turn].year}`, align: 'center' }]
        }
        legend={[
          ...(values.some((v) => v >= 0)
            ? [{ label: 'Positive cash flow', kind: 'bar' as const, color: entityColors.cashFlow }]
            : []),
          ...(values.some((v) => v < 0)
            ? [{ label: 'Negative cash flow', kind: 'bar' as const, color: entityColors.negative }]
            : []),
        ]}
        tooltip={(i) => {
          const r = visible[i];
          // Effective income (not gross rent) so every step of the equation adds up.
          return {
            title: `Year ${r.year}`,
            rows: [
              { label: 'Effective income', value: r.effectiveGrossIncome },
              { label: 'Operating costs', op: '−', value: r.operatingExpenses, tone: 'muted' },
              { label: 'NOI', op: '=', value: r.noi, total: true },
              { label: 'Debt service', op: '−', value: r.debtService, tone: 'muted' },
              { label: 'Capital reserves', op: '−', value: r.reserves, tone: 'muted' },
              { label: 'Cash flow', op: '=', value: r.cashFlow, tone: 'auto', total: true },
            ],
          };
        }}
      />
      <MoreDetail summary="View exact amounts">
        <ExactTable
          caption="Annual cash flow"
          headers={['Year', 'Cash flow', 'Cumulative']}
          rows={rows.map((r) => [r.year, dollars(r.cashFlow), dollars(r.cumulativeCashFlow)])}
        />
      </MoreDetail>
    </ChartCard>
  );
}

function quality(label: string, value: string, tone?: 'good' | 'bad') {
  return { label, value, tone };
}

/** C2 · Wealth created by a year, as a ring of its three sources, with deal quality beside it. */
export function OutcomeCard({ result }: { result: ProjectionResult }) {
  const length = result.annualCashflows.length;
  const [shown, horizon] = useHorizon(length, 'Outcome year', 1);
  const w = wealthAt(result, shown);
  const m = result.summaryMetrics;
  if (!w) return null;
  const parts = [
    { label: 'Cash flow', value: w.cashFlow, color: entityColors.cashFlow },
    { label: 'Principal', value: w.principal, color: entityColors.principal },
    { label: 'Appreciation', value: w.appreciation, color: entityColors.appreciation },
  ];
  const negative = parts.filter((p) => p.value < 0);
  // The public result reports undefined ratios (e.g. DSCR with no debt) as null.
  const finite = (v: number | null | undefined): v is number => v != null && Number.isFinite(v);
  const deal = [
    m.loanAmount <= 0
      ? quality('DSCR', 'No debt')
      : finite(m.dscr)
        ? quality(
            'DSCR',
            m.dscr.toFixed(2),
            m.dscr < 1 ? 'bad' : m.dscr >= 1.25 ? 'good' : undefined,
          )
        : quality('DSCR', 'Unavailable'),
    quality('GRM', finite(m.grm) && m.grm > 0 ? m.grm.toFixed(1) : 'Unavailable'),
    quality('Rent to price', finite(m.rentToPrice) ? pct(m.rentToPrice) : 'Unavailable'),
    finite(m.profitabilityIndex)
      ? quality(
          'Profit index',
          m.profitabilityIndex.toFixed(2),
          m.profitabilityIndex >= 1 ? 'good' : 'bad',
        )
      : quality('Profit index', 'Unavailable'),
  ];
  return (
    <ChartCard
      title="Wealth created"
      subtitle={
        <>
          By year {w.year}{' '}
          <InfoTip label="wealth created">
            Included: cumulative operating cash flow, loan principal repaid and property value
            change (appreciation and after-repair value). Excluded: selling costs, taxes and sale
            proceeds.
          </InfoTip>
        </>
      }
      controls={horizon}
    >
      <div className={s.outcomeRow}>
        <Donut label={`Wealth created by year ${w.year}`} parts={parts} />
        <div className={s.outcomeTotal}>
          <p className={s.big} data-negative={w.total < 0 || undefined}>
            {wholeDollars(w.total)}
          </p>
          <ul className={s.parts} aria-label="Wealth created by source">
            {parts.map((p) => (
              <li key={p.label}>
                <i style={{ background: p.color }} aria-hidden="true" />
                {p.label}
                <b data-negative={p.value < 0 || undefined}>{wholeDollars(p.value)}</b>
              </li>
            ))}
          </ul>
        </div>
        <div className={s.qualityBox}>
          <p className={s.qualityTitle}>Deal quality</p>
          <dl className={s.quality} aria-label="Deal quality">
            {deal.map((d) => (
              <div key={d.label}>
                <dt>{d.label}</dt>
                <dd data-tone={d.tone}>{d.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
      {negative.length > 0 && (
        <p className={s.note}>
          {negative.map((p) => `${p.label} ${wholeDollars(p.value)}`).join(' and ')} reduces the
          total and is not drawn in the ring.
        </p>
      )}
    </ChartCard>
  );
}

type Line = {
  label: string;
  values: (number | null)[];
  format?: 'money' | 'signed' | 'rate';
  strong?: boolean;
  bar?: boolean;
  tone?: 'auto' | 'gain' | 'loss';
  info?: string;
};
type Section = { id: string; title: string; lines: Line[] };

/** C5 · Cash flow and equity at milestone years, with inline rate bars. */
export function ProjectionMilestones({ result }: { result: ProjectionResult }) {
  const rows = projectionRows(result);
  const equity = equityYears(result);
  const years = milestoneYears(rows.length);
  const [full, setFull] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const m = result.summaryMetrics;
  const at = (y: number) => rows.find((r) => r.year === y)!;
  const eq = (y: number) => equity.find((r) => r.year === y)!;
  const col = (pick: (y: number) => number | null) => years.map(pick);
  const sections: Section[] = [
    {
      id: 'income',
      title: 'Income',
      lines: [
        { label: 'Scheduled rent', values: col((y) => at(y).grossRent) },
        { label: 'Other income', values: col((y) => at(y).otherIncome) },
        {
          label: 'Vacancy',
          values: col((y) => -at(y).vacancyLoss),
          format: 'signed',
          tone: 'loss',
        },
        {
          label: 'Effective income',
          values: col((y) => at(y).effectiveGrossIncome),
          strong: true,
          info: 'Rent + other income − vacancy',
        },
      ],
    },
    {
      id: 'expenses',
      title: 'Operating expenses',
      lines: [
        { label: 'Operating expenses', values: col((y) => at(y).operatingExpenses) },
        { label: 'Net operating income', values: col((y) => at(y).noi), strong: true },
        {
          label: 'Capital reserves',
          values: col((y) => at(y).reserves),
          info: 'Set aside below NOI; reduces spendable cash',
        },
      ],
    },
    {
      id: 'cash',
      title: 'Cash flow',
      lines: [
        {
          label: 'Debt service',
          values: col((y) => at(y).debtService),
          info: 'Annual principal and interest',
        },
        {
          label: 'Annual cash flow',
          values: col((y) => at(y).cashFlow),
          strong: true,
          tone: 'auto',
          info: 'After operating costs, debt service and reserves',
        },
        {
          label: 'Cash-on-cash',
          values: col((y) =>
            m.totalCashRequired > 0 ? at(y).cashFlow / m.totalCashRequired : null,
          ),
          format: 'rate',
          bar: true,
          tone: 'auto',
          info: 'Annual cash flow ÷ initial cash required',
        },
      ],
    },
    {
      id: 'equity',
      title: 'Equity',
      lines: [
        {
          label: 'Property value',
          values: col((y) => eq(y).propertyValue),
          info: 'Projected year-end value',
        },
        {
          label: 'Appreciation',
          values: col((y) => eq(y).propertyValue - m.purchasePrice),
          format: 'signed',
          tone: 'gain',
          info: 'Property value − purchase price',
        },
        {
          label: 'Mortgage balance',
          values: col((y) => -eq(y).loanBalance),
          format: 'signed',
          tone: 'loss',
        },
        { label: 'Equity', values: col((y) => eq(y).equity), strong: true, tone: 'auto' },
        {
          label: 'Equity %',
          values: col((y) => (eq(y).propertyValue > 0 ? eq(y).equity / eq(y).propertyValue : null)),
          format: 'rate',
          bar: true,
          tone: 'auto',
          info: 'Equity ÷ property value',
        },
      ],
    },
  ];
  const isOpen = (id: string) => open[id] ?? (full || id === 'cash' || id === 'equity');
  const cell = (line: Line, v: number | null) => {
    if (v == null || !Number.isFinite(v)) return 'Unavailable';
    if (line.format === 'rate') return pct(v);
    if (line.format === 'signed') return v === 0 ? wholeDollars(0) : signed(v);
    return wholeDollars(v);
  };
  // Only losses are coloured; gains read from their sign.
  const tone = (line: Line, v: number | null) =>
    v == null || v === 0
      ? undefined
      : (line.tone === 'gain' || line.tone === 'auto') && v < 0
        ? 'loss'
        : undefined;
  return (
    <ChartCard
      title="Milestone years"
      controls={
        <Segmented
          label="Projection rows"
          options={[
            { value: 'key', label: 'Key rows' },
            { value: 'full', label: 'All rows' },
          ]}
          value={full ? 'full' : 'key'}
          onChange={(value) => {
            setFull(value === 'full');
            setOpen({});
          }}
        />
      }
    >
      <div className={s.scroll} role="region" tabIndex={0} aria-label="Milestone projections">
        <table className={s.table}>
          <caption className={s.srOnly}>Cash flow and equity at milestone years</caption>
          <thead>
            <tr>
              <th scope="col">Metric</th>
              {years.map((y) => (
                <th scope="col" key={y}>
                  {`Year ${y}`}
                  {calendarYear(result, y) != null && <small>{calendarYear(result, y)}</small>}
                </th>
              ))}
            </tr>
          </thead>
          {sections.map((section) => (
            <tbody key={section.id}>
              <tr className={s.section}>
                <th scope="colgroup" colSpan={years.length + 1}>
                  <button
                    type="button"
                    aria-expanded={isOpen(section.id)}
                    onClick={() => setOpen({ ...open, [section.id]: !isOpen(section.id) })}
                  >
                    {section.title}
                    <span className={s.chevron} aria-hidden="true" />
                  </button>
                </th>
              </tr>
              {isOpen(section.id) &&
                section.lines.map((line) => (
                  <tr key={line.label} data-strong={line.strong || undefined}>
                    <th scope="row">
                      {line.label}
                      {line.info && <InfoTip label={line.label}>{line.info}</InfoTip>}
                    </th>
                    {line.values.map((v, i) => (
                      <td key={years[i]} data-tone={tone(line, v)}>
                        {line.bar && <MiniBar value={v} />}
                        {cell(line, v)}
                      </td>
                    ))}
                  </tr>
                ))}
            </tbody>
          ))}
        </table>
      </div>
    </ChartCard>
  );
}

/** Summary keeps the decision rows; the full statement remains in Charts. */
export function SummaryMilestones({ result }: { result: ProjectionResult }) {
  const rows = projectionRows(result);
  const years = [...new Set([1, Math.min(5, rows.length), Math.min(10, rows.length)])];
  const metrics = [
    ['Effective income', (y: number) => rows[y - 1].effectiveGrossIncome],
    ['Operating expenses', (y: number) => rows[y - 1].operatingExpenses],
    ['Net operating income', (y: number) => rows[y - 1].noi],
    ['Debt service', (y: number) => rows[y - 1].debtService],
    ['Cash flow', (y: number) => rows[y - 1].cashFlow],
  ] as const;
  const id = useId();
  return (
    <section className={`card ${s.plainCard}`} aria-labelledby={`${id}-title`}>
      <div className={s.plainHead}>
        <h2 id={`${id}-title`}>Milestones</h2>
        <span className="badge info">Projected</span>
      </div>
      <div className="table-region" role="region" tabIndex={0} aria-label="Milestones">
        <table className={`table ${s.plainTable}`}>
          <thead>
            <tr>
              <th scope="col">Metric</th>
              {years.map((y) => (
                <th scope="col" key={y} className="num">
                  Year {y}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {metrics.map(([label, value]) => (
              <tr key={label}>
                <th scope="row">{label}</th>
                {years.map((y) => (
                  <td key={y} className="num" data-tone={value(y) < 0 ? 'loss' : undefined}>
                    {wholeDollars(value(y))}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/**
 * Net cash flow for the first five projected years as an exact table (Designs/redisgn), with
 * every year of the hold one click away. The bar chart of the same series stays in Charts.
 */
export function NetCashFlowYears({ result }: { result: ProjectionResult }) {
  const rows = projectionRows(result);
  const shown = rows.slice(0, 5);
  const turn = firstPositiveAfterNegative(rows.map((r) => r.cashFlow));
  const id = useId();
  const badge = !rows.length
    ? null
    : rows[0].cashFlow >= 0
      ? { text: 'Positive from Y1', tone: 'success' }
      : turn != null
        ? { text: `Break-even Y${rows[turn].year}`, tone: 'info' }
        : { text: `Below $0 through Y${rows.length}`, tone: 'danger' };
  return (
    <section className={`card ${s.plainCard}`} aria-labelledby={`${id}-title`}>
      <div className={s.plainHead}>
        <h2 id={`${id}-title`}>Net cash flow by year</h2>
        {badge && <span className={`badge ${badge.tone}`}>{badge.text}</span>}
      </div>
      <div
        className="table-region"
        role="region"
        tabIndex={0}
        aria-label={`Net cash flow, years 1 to ${shown.length}`}
      >
        <table className={`table ${s.plainTable}`}>
          <thead>
            <tr>
              <th scope="col">Year</th>
              <th scope="col" className="num">
                Net cash flow
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.year}>
                <th scope="row">Year {r.year}</th>
                <td className="num" data-tone={Math.round(r.cashFlow) < 0 ? 'loss' : undefined}>
                  {signed(r.cashFlow)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <MoreDetail summary={`View all ${rows.length} years`}>
        <ExactTable
          caption="Annual cash flow"
          headers={[
            'Year',
            'Effective income',
            'Operating expenses',
            'NOI',
            'Debt service',
            'Capital reserves',
            'Cash flow',
            'Cumulative',
          ]}
          rows={rows.map((r) => [
            r.year,
            dollars(r.effectiveGrossIncome),
            dollars(r.operatingExpenses),
            dollars(r.noi),
            dollars(r.debtService),
            dollars(r.reserves),
            dollars(r.cashFlow),
            dollars(r.cumulativeCashFlow),
          ])}
        />
      </MoreDetail>
    </section>
  );
}
