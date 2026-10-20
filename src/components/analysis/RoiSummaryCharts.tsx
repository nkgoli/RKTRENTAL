'use client';

import { useState, type ReactNode } from 'react';
import {
  calendarYear,
  equityYears,
  firstPositiveAfterNegative,
  milestoneYears,
  wealthAt,
  wholeDollars,
} from '@/lib/analysis/chart-data';
import { projectionRows, type ProjectionResult } from '@/lib/analysis/projections';
import {
  ChartCard,
  ComboChart,
  Donut,
  InfoTip,
  MiniBar,
  Segmented,
  chartColors,
  useHorizon,
} from './RoiChart';
import s from './summary-charts.module.css';

const pct = (value: number | null, digits = 2) =>
  value == null || !Number.isFinite(value) ? 'Unavailable' : `${(value * 100).toFixed(digits)}%`;
const signed = (value: number) => `${value > 0 ? '+' : ''}${wholeDollars(value)}`;

/** C1 · Net Cash Flow by Year (reference CashFlowProjectionChart). */
export function NetCashFlowCard({ result }: { result: ProjectionResult }) {
  const rows = projectionRows(result);
  const [shown, horizon] = useHorizon(rows.length, 'Net cash flow horizon', 5);
  const visible = rows.slice(0, shown);
  const values = visible.map((r) => r.cashFlow);
  const turn = firstPositiveAfterNegative(values);
  return (
    <ChartCard
      title="Net Cash Flow by Year"
      subtitle="After debt service · Positive = you keep cash, Negative = you contribute · projected · before tax and sale proceeds"
      controls={horizon}
    >
      <ComboChart
        label={`Net cash flow, years 1 to ${visible.length}`}
        height={256}
        barRadius="all"
        xFormat={(y) => `Y${y}`}
        years={visible.map((r) => r.year)}
        series={[
          {
            label: 'Net cash flow',
            kind: 'bar',
            values,
            color: chartColors.primary,
            negativeColor: chartColors.bad,
          },
        ]}
        markers={
          turn == null
            ? []
            : [
                {
                  index: turn,
                  label: `Positive Y${visible[turn].year}`,
                  color: chartColors.primaryDark,
                  align: 'center',
                },
              ]
        }
        legend={[
          ...(values.some((v) => v >= 0)
            ? [{ label: 'Positive Cash Flow', kind: 'bar' as const, color: chartColors.primary }]
            : []),
          ...(values.some((v) => v < 0)
            ? [{ label: 'Negative Cash Flow', kind: 'bar' as const, color: chartColors.bad }]
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
              { label: 'Cash Flow', op: '=', value: r.cashFlow, tone: 'auto', total: true },
            ],
          };
        }}
      />
    </ChartCard>
  );
}

function quality(label: string, value: string, tone?: 'good' | 'bad') {
  return { label, value, tone };
}

/** C2 · Outcome: wealth created by a year, as a donut plus the Deal Quality list. */
export function OutcomeCard({ result }: { result: ProjectionResult }) {
  const length = result.annualCashflows.length;
  const [shown, horizon] = useHorizon(length, 'Outcome year', 1);
  const w = wealthAt(result, shown);
  const m = result.summaryMetrics;
  if (!w) return null;
  const parts = [
    { label: 'Cash Flow', value: w.cashFlow, color: chartColors.primary },
    { label: 'Principal', value: w.principal, color: chartColors.primaryLight },
    { label: 'Appreciation', value: w.appreciation, color: chartColors.primaryPale },
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
    quality('Rent/Price', finite(m.rentToPrice) ? pct(m.rentToPrice) : 'Unavailable'),
    finite(m.profitabilityIndex)
      ? quality(
          'Profit Index',
          m.profitabilityIndex.toFixed(2),
          m.profitabilityIndex >= 1 ? 'good' : 'bad',
        )
      : quality('Profit Index', 'Unavailable'),
  ];
  return (
    <ChartCard
      className={s.outcome}
      title="Outcome"
      subtitle={
        <>
          Wealth Created (Year {w.year}){' '}
          <InfoTip label="wealth created">
            Included: cumulative operating cash flow, loan principal repaid and property value
            change (appreciation and after-repair value). Excluded: selling costs, taxes and sale
            proceeds. Before sale, before tax.
          </InfoTip>
        </>
      }
    >
      <p className={s.big} data-negative={w.total < 0 || undefined}>
        {wholeDollars(w.total)}
      </p>
      <div className={s.outcomeRow}>
        <Donut label={`Wealth created by year ${w.year}`} parts={parts} />
        <div className={s.qualityBox}>
          <p className={s.qualityTitle} id={`${w.year}-deal-quality`}>
            Deal Quality
          </p>
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
      <ul className={s.parts} aria-label="Wealth created by source">
        {parts.map((p) => (
          <li key={p.label}>
            <i style={{ background: p.color }} aria-hidden="true" />
            {p.label}
            <b data-negative={p.value < 0 || undefined}>{wholeDollars(p.value)}</b>
          </li>
        ))}
      </ul>
      {negative.length > 0 && (
        <p className={s.note}>
          {negative.map((p) => `${p.label} ${wholeDollars(p.value)}`).join(' and ')} reduces the
          total and is not drawn in the ring.
        </p>
      )}
      <div className={s.centered}>{horizon}</div>
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
type Section = { id: string; title: string; icon: ReactNode; tone: string; lines: Line[] };

const glyph = (d: string) => (
  <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
    <path
      d={d}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/** C5 · Cash Flow & Equity Projections at milestone years, with inline rate bars. */
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
      title: 'Income Analysis',
      tone: chartColors.primary,
      icon: glyph('M22 7 13.5 15.5 8.5 10.5 2 17M16 7h6v6'),
      lines: [
        { label: 'Scheduled rent', values: col((y) => at(y).grossRent) },
        { label: 'Other income', values: col((y) => at(y).otherIncome) },
        {
          label: 'Less vacancy',
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
      title: 'Operating Expenses',
      tone: chartColors.mutedMid,
      icon: glyph('M22 17 13.5 8.5 8.5 13.5 2 7M16 17h6v-6'),
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
      title: 'Cash Flow',
      tone: chartColors.primaryDark,
      icon: glyph('M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6'),
      lines: [
        {
          label: 'Less Mortgage Expense',
          values: col((y) => at(y).debtService),
          info: 'Annual debt service (principal and interest)',
        },
        {
          label: 'Annual Cash Flow',
          values: col((y) => at(y).cashFlow),
          strong: true,
          tone: 'auto',
          info: 'After operating costs, debt service and reserves',
        },
        {
          label: 'Cash on Cash Return',
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
      title: 'Equity Analysis',
      tone: chartColors.ink,
      icon: glyph('M3 10.5 12 3l9 7.5V21H3zM9 21v-6h6v6'),
      lines: [
        {
          label: 'Property Value',
          values: col((y) => eq(y).propertyValue),
          info: 'Projected year-end value',
        },
        {
          label: 'Plus Appreciation',
          values: col((y) => eq(y).propertyValue - m.purchasePrice),
          format: 'signed',
          tone: 'gain',
          info: 'Property value − purchase price',
        },
        {
          label: 'Less Mortgage Balance',
          values: col((y) => -eq(y).loanBalance),
          format: 'signed',
          tone: 'loss',
        },
        { label: 'Total Equity', values: col((y) => eq(y).equity), strong: true, tone: 'auto' },
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
  const tone = (line: Line, v: number | null) =>
    v == null || v === 0
      ? undefined
      : line.tone === 'gain'
        ? v > 0
          ? 'gain'
          : 'loss'
        : line.tone === 'loss'
          ? 'loss'
          : line.tone === 'auto' && v < 0
            ? 'loss'
            : undefined;
  return (
    <ChartCard
      title="Cash Flow & Equity Projections"
      subtitle="Milestone years analysis · projected · whole dollars (exact cents in the annual tables) · before tax"
      controls={
        <div className={s.tableControls}>
          <Segmented
            size="md"
            label="Projection rows"
            options={[
              { value: 'key', label: 'Key Rows' },
              { value: 'full', label: 'Full Table' },
            ]}
            value={full ? 'full' : 'key'}
            onChange={(value) => {
              setFull(value === 'full');
              setOpen({});
            }}
          />
          <span className={s.key}>
            <i data-tone="gain" /> Positive <i data-tone="loss" /> Negative
          </span>
        </div>
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
                    <span className={s.icon} style={{ background: section.tone }}>
                      {section.icon}
                    </span>
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
      <p className={s.foot}>Showing milestone years: {years.map((y) => `Y${y}`).join(', ')}</p>
    </ChartCard>
  );
}
