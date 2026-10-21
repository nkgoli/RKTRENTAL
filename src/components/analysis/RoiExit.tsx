'use client';

import { useMemo, useState, type ReactNode } from 'react';
import type { AnalysisPayload } from '@/lib/analysis/contract';
import {
  calculateExits,
  dollars,
  exitControls,
  rate,
  type ExitControls,
} from '@/lib/analysis/projections';
import { exitLandmarks, exitRows, wholeDollars, type ExitRow } from '@/lib/analysis/chart-data';
import {
  ChartCard,
  Chips,
  ComboChart,
  ExactTable,
  Icon,
  InfoTip,
  MoreDetail,
  Segmented,
  Statement,
  chartColors,
} from './RoiChart';
import styles from './analysis.module.css';
import chartStyles from './projections.module.css';
import d from './detail-charts.module.css';

const pct = (v: number | null, digits = 2) =>
  v == null || !Number.isFinite(v) ? 'Unavailable' : `${(v * 100).toFixed(digits)}%`;
const exitColors = {
  proceeds: chartColors.accent,
  proceedsActive: chartColors.accentDark,
  cash: chartColors.primary,
  cashActive: chartColors.primaryDark,
  initial: chartColors.plum,
};
/** Reference default: Year 10 is selected; otherwise the final compared year. */
const defaultYear = (rows: { year: number }[] | null) =>
  rows?.some((r) => r.year === 10) ? 10 : (rows?.at(-1)?.year ?? null);

function Comparison({
  data,
  basis,
  children,
}: {
  data: ExitRow[];
  basis: string[];
  children: ReactNode;
}) {
  const [selected, setSelected] = useState<number | null>(() => defaultYear(data));
  const [hovered, setHovered] = useState<number | null>(null);
  const [view, setView] = useState<'profit' | 'cashBack'>('profit');
  const marks = exitLandmarks(data);
  const current = data.find((r) => r.year === selected) ?? null;
  const index = (year: number | null) => {
    const i = data.findIndex((r) => r.year === year);
    return i < 0 ? null : i;
  };
  const toggle = (year: number) => setSelected(selected === year ? null : year);
  const invested = data[0]?.invested ?? 0;
  const tone = (v: number | null) => (v != null && v < 0 ? 'red' : 'teal');
  return (
    <ChartCard
      title="Exit Analysis & Comparison"
      subtitle="What you would get back if you sold at the end of each compared year."
      basis={basis}
      controls={
        <div className={d.view}>
          <span>View:</span>
          <Segmented
            label="Exit summary view"
            options={[
              { value: 'profit', label: 'Profit' },
              { value: 'cashBack', label: 'Total Cash Back' },
            ]}
            value={view}
            onChange={setView}
          />
          <InfoTip label="this view">
            {view === 'profit'
              ? 'Shows how much you made (Total Cash Back − Initial Investment)'
              : 'Shows total cash received at exit (Net Proceeds + Cash Flow)'}
          </InfoTip>
        </div>
      }
    >
      <Chips
        label="Best exit landmarks"
        items={[
          ...(marks.bestIrr
            ? [
                {
                  icon: 'up' as const,
                  tone: 'teal' as const,
                  text: `Best IRR: Year ${marks.bestIrr.year} (${pct(marks.bestIrr.irr)})`,
                  pressed: selected === marks.bestIrr.year,
                  onClick: () => toggle(marks.bestIrr!.year),
                },
              ]
            : []),
          ...(marks.bestProfit
            ? [
                {
                  icon: 'dollar' as const,
                  text: `Best Profit: Year ${marks.bestProfit.year} (${wholeDollars(marks.bestProfit.profit)})`,
                  pressed: selected === marks.bestProfit.year,
                  onClick: () => toggle(marks.bestProfit!.year),
                },
              ]
            : []),
          ...(marks.breakeven
            ? [
                {
                  icon: 'clock' as const,
                  tone: 'amber' as const,
                  text: `Breakeven: Year ${marks.breakeven.year}`,
                  pressed: selected === marks.breakeven.year,
                  onClick: () => toggle(marks.breakeven!.year),
                },
              ]
            : []),
        ]}
      />
      <p className={d.initial}>
        <i aria-hidden="true" />
        <span>
          Initial Cash Invested: <b>{wholeDollars(invested)}</b>
        </span>
        <InfoTip label="initial cash invested">
          Your total cash required at closing: down payment, closing costs, financing fees and
          improvements.
        </InfoTip>
      </p>
      <div className={d.years}>
        <p id="exit-year-label">Select Exit Year</p>
        <div role="group" aria-labelledby="exit-year-label">
          {data.map((r) => (
            <button
              key={r.year}
              type="button"
              aria-pressed={selected === r.year}
              data-hover={hovered === r.year || undefined}
              onClick={() => toggle(r.year)}
              onPointerEnter={() => setHovered(r.year)}
              onPointerLeave={() => setHovered(null)}
            >
              {r.year}y
            </button>
          ))}
          {selected != null && (
            <button type="button" className={d.clear} onClick={() => setSelected(null)}>
              Clear
            </button>
          )}
        </div>
      </div>
      {current && (
        <section className={d.summary} aria-labelledby="exit-summary-title">
          <header>
            <h3 id="exit-summary-title">
              <span aria-hidden="true">
                <Icon name="zap" size={12} />
              </span>
              Year {current.year} Exit Summary
            </h3>
            <p>
              <small>{view === 'profit' ? 'Profit' : 'Total Cash Back'}</small>
              <b data-tone={view === 'profit' ? tone(current.profit) : 'slate'}>
                {wholeDollars(view === 'profit' ? current.profit : current.totalCashBack)}
              </b>
            </p>
          </header>
          <dl>
            {(
              [
                ['Net Proceeds', wholeDollars(current.netProceeds), tone(current.netProceeds)],
                [
                  'Cash Flow',
                  wholeDollars(current.cashFlow),
                  current.cashFlow < 0 ? 'red' : 'slate',
                ],
                ['Total Cash Back', wholeDollars(current.totalCashBack), 'dark'],
                ['Profit', wholeDollars(current.profit), tone(current.profit)],
                ['IRR', pct(current.irr), tone(current.irr)],
              ] as const
            ).map(([label, value, t]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd data-tone={t}>{value}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}
      <ComboChart
        label="Total cash back by exit year: net sale proceeds and cumulative cash flow"
        xLabel="Exit year"
        years={data.map((r) => r.year)}
        xFormat={(y) => `Year ${y}`}
        series={[
          {
            label: 'Net Proceeds',
            kind: 'bar',
            stack: true,
            values: data.map((r) => r.netProceeds),
            color: exitColors.proceeds,
            activeColor: exitColors.proceedsActive,
            activeStroke: '#044b57',
          },
          {
            label: 'Cash Flow',
            kind: 'bar',
            stack: true,
            values: data.map((r) => r.cashFlow),
            color: exitColors.cash,
            activeColor: exitColors.cashActive,
            activeStroke: chartColors.navy,
          },
        ]}
        refLines={[
          {
            value: invested,
            label: `Initial: ${wholeDollars(invested)}`,
            color: exitColors.initial,
          },
        ]}
        markers={
          index(selected) == null
            ? []
            : [{ index: index(selected)!, label: '', color: exitColors.initial }]
        }
        emphasis={index(selected) ?? index(hovered)}
        emphasizeHover
        onSelect={(i) => toggle(data[i].year)}
        legend={[
          { label: 'Net Proceeds (Sale − Costs − Loan)', kind: 'bar', color: exitColors.proceeds },
          { label: 'Cumulative Cash Flow', kind: 'bar', color: exitColors.cash },
        ]}
        tooltip={(i) => {
          const r = data[i];
          return {
            title: `Year ${r.year} Exit`,
            rows: [
              { label: 'Sale Price', value: r.salePrice },
              { label: 'Selling Costs', op: '−', value: r.sellingCosts, color: chartColors.warn },
              { label: 'Loan Payoff', op: '−', value: r.loanPayoff, color: chartColors.bad },
              {
                label: 'Net Proceeds',
                op: '=',
                value: r.netProceeds,
                total: true,
                color: chartColors.accentDark,
              },
              {
                label: 'Cash Flow Received',
                op: '+',
                value: r.cashFlow,
                color: exitColors.cashActive,
              },
              {
                label: 'Total Cash Back',
                op: '=',
                value: r.totalCashBack,
                total: true,
                color: chartColors.plum,
              },
              { label: 'Initial Cash Invested', op: '−', value: r.invested, tone: 'muted' },
              { label: 'Profit', op: '=', value: r.profit, total: true, tone: 'auto' },
              { note: `ROI ${pct(r.roi, 1)} · IRR (leveraged) ${pct(r.irr)}` },
              {
                note:
                  r.invested > 0
                    ? `Profit vs Initial: ${r.profit >= 0 ? '+' : ''}${((r.profit / r.invested) * 100).toFixed(0)}% of your cash invested`
                    : 'No initial cash is recorded',
              },
            ],
          };
        }}
      />
      <p className={chartStyles.footnote}>
        <i>Bar height = Total Cash Back (Net Proceeds + Cash Flow)</i>
      </p>
      <div className={d.exitTable} role="region" tabIndex={0} aria-label="Exit years compared">
        <table>
          <caption className={d.srOnly}>
            Exit years compared · whole dollars · leveraged IRR
          </caption>
          <thead>
            <tr>
              <th scope="col">Exit Year</th>
              <th scope="col">Net Proceeds</th>
              <th scope="col">Cash Flow</th>
              <th scope="col">Total Back</th>
              <th scope="col">Profit</th>
              <th scope="col">IRR</th>
              <th scope="col">View</th>
            </tr>
          </thead>
          <tbody>
            {data.map((r) => {
              const badge =
                marks.bestIrr?.year === r.year
                  ? ['Best IRR', 'teal']
                  : marks.bestProfit?.year === r.year
                    ? ['Best Profit', 'slate']
                    : marks.breakeven?.year === r.year
                      ? ['Breakeven', 'amber']
                      : null;
              return (
                <tr
                  key={r.year}
                  data-selected={selected === r.year || undefined}
                  data-hover={hovered === r.year || undefined}
                  onClick={() => toggle(r.year)}
                  onPointerEnter={() => setHovered(r.year)}
                  onPointerLeave={() => setHovered(null)}
                >
                  <th scope="row">
                    Year {r.year}
                    {badge && (
                      <span className={d.badge} data-tone={badge[1]}>
                        {badge[0]}
                      </span>
                    )}
                  </th>
                  <td data-tone={tone(r.netProceeds)}>{wholeDollars(r.netProceeds)}</td>
                  <td>{wholeDollars(r.cashFlow)}</td>
                  <td data-tone="dark">{wholeDollars(r.totalCashBack)}</td>
                  <td data-tone={tone(r.profit)} data-strong>
                    {wholeDollars(r.profit)}
                  </td>
                  <td data-tone={tone(r.irr)}>{pct(r.irr)}</td>
                  <td>
                    <button
                      type="button"
                      className={d.eye}
                      aria-pressed={selected === r.year}
                      aria-label={`View year ${r.year} exit`}
                      onClick={(event) => {
                        event.stopPropagation();
                        toggle(r.year);
                      }}
                    >
                      <Icon name="eye" size={12} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {marks.bestIrr && marks.bestProfit && (
        <p className={d.exitInsight}>
          <strong>Insight:</strong>{' '}
          {marks.bestIrr.year === marks.bestProfit.year ? (
            <>
              Year {marks.bestIrr.year} has both the highest IRR{' '}
              <b data-tone={tone(marks.bestIrr.irr)}>({pct(marks.bestIrr.irr)})</b> and the highest
              profit{' '}
              <b data-tone={tone(marks.bestProfit.profit)}>
                ({wholeDollars(marks.bestProfit.profit)})
              </b>{' '}
              of the compared years.
            </>
          ) : (
            <>
              Trade-off: Year {marks.bestIrr.year} has the highest IRR{' '}
              <b data-tone={tone(marks.bestIrr.irr)}>({pct(marks.bestIrr.irr)})</b>, but Year{' '}
              {marks.bestProfit.year} has the highest profit{' '}
              <b data-tone={tone(marks.bestProfit.profit)}>
                ({wholeDollars(marks.bestProfit.profit)})
              </b>
              .
            </>
          )}
          {marks.bestProfit.profit < 0 && (
            <>
              {' '}
              No compared exit year gets back the cash you put in; these are the smallest losses.
            </>
          )}
          {marks.breakeven && marks.breakeven.year !== marks.bestIrr.year && (
            <> Breakeven at Year {marks.breakeven.year}.</>
          )}
        </p>
      )}
      {!marks.bestIrr && (
        <p className={d.exitInsight}>
          <strong>Insight:</strong> IRR is unavailable for every compared exit year, so no best IRR
          is shown.
          {marks.bestProfit && marks.bestProfit.profit < 0 && (
            <> No compared exit year gets back the cash you put in.</>
          )}
        </p>
      )}
      {children}
    </ChartCard>
  );
}

/** "year 10 · selling costs 6% · appreciated value" for saved or probe controls. */
function describeControls(c: ExitControls) {
  const price = c.salePrice.trim();
  return [
    `exit year ${c.years.trim() || 'not set'}`,
    `selling costs ${c.sellingCosts.trim() === '' ? 'not set' : `${c.sellingCosts.trim()}%`}`,
    price === '' || !Number.isFinite(Number(price))
      ? 'sale price from appreciated value'
      : `sale price ${wholeDollars(Number(price))}`,
  ].join(' · ');
}
const sameControls = (a: ExitControls, b: ExitControls) =>
  (['years', 'sellingCosts', 'salePrice'] as const).every(
    (k) => a[k].trim() === b[k].trim() || Number(a[k]) === Number(b[k]),
  );

export function Exit({
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
  const saved = useMemo(() => exitControls(payload), [payload]);
  const [controls, setControls] = useState(saved);
  const initial = useMemo(() => {
    try {
      return { rows: calculateExits(payload, saved), error: '' };
    } catch (error) {
      return {
        rows: null,
        error: error instanceof Error ? error.message : 'Calculation unavailable',
      };
    }
  }, [payload, saved]);
  const [calculation, setCalculation] = useState(initial);
  // The controls behind the results on screen; they differ from `saved` while a probe runs.
  const [applied, setApplied] = useState(saved);
  const [version, setVersion] = useState(0);
  const [changed, setChanged] = useState(false);
  const rows = stale || changed ? null : calculation.rows;
  const data = rows ? exitRows(rows) : null;
  const probing = !sameControls(applied, saved);
  // The exact statement is for the probe exit year (the last compared horizon).
  const selected = rows?.at(-1);
  const result = selected?.result;
  const sale = result?.saleProceeds;
  const run = (next: ExitControls) => {
    try {
      setCalculation({ rows: calculateExits(payload, next), error: '' });
      setApplied(next);
      setChanged(false);
      setVersion((v) => v + 1);
    } catch (error) {
      setCalculation({
        rows: null,
        error: error instanceof Error ? error.message : 'Calculation unavailable',
      });
    }
  };
  const fields: [keyof ExitControls, string, string][] = [
    ['years', 'Probe exit year', 'Whole years, 1–50.'],
    ['sellingCosts', 'Probe selling costs (%)', '0–30% of sale price.'],
    [
      'salePrice',
      'Probe sale price override ($)',
      'Optional; blank uses appreciated value. Applies to every compared horizon.',
    ],
  ];
  const paused = stale
    ? 'Exit comparison is paused until the assumptions flagged above are corrected.'
    : changed
      ? 'Not applied yet. Press Update exit comparison to see results for these probe values.'
      : 'No exit comparison for these values. Correct the probe and update again.';
  return (
    <div className={chartStyles.stack}>
      <ChartCard
        title="Exit probe"
        subtitle="Try another exit year, selling cost or sale price. Probes are temporary and never saved."
        basis={[probing ? 'Temporary probe' : 'Saved assumptions', 'Before tax']}
        label="Exit probe"
      >
        <div className={d.probeState} data-probe={probing || undefined} role="status">
          <p>
            <b>Saved:</b> {describeControls(saved)}
          </p>
          {probing && (
            <p>
              <b>Showing probe:</b> {describeControls(applied)}
            </p>
          )}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (stale || saving) return;
            run(controls);
          }}
        >
          <fieldset disabled={stale || saving} className={d.probeFields}>
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
            <div className={d.probeActions}>
              <button type="submit">Update exit comparison</button>
              {(probing || changed) && (
                <button
                  type="button"
                  onClick={() => {
                    setControls(saved);
                    run(saved);
                  }}
                >
                  Reset to saved
                </button>
              )}
              <button type="button" onClick={onEdit}>
                Edit saved exit assumptions
              </button>
            </div>
          </fieldset>
        </form>
        {calculation.error && (
          <p role="alert" className={styles.error}>
            Could not calculate exit comparison. {calculation.error} Correct the controls and try
            again.
          </p>
        )}
      </ChartCard>
      {data && rows ? (
        <Comparison
          key={version}
          data={data}
          basis={[
            probing ? 'Projected with probe' : 'Projected',
            'USD',
            'Each exit year recalculated',
            'Before tax',
          ]}
        >
          {result && sale && selected && (
            <MoreDetail summary={`Exact sale statement, year ${selected.year}`}>
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
                <p className={d.detailText}>IRR unavailable: {result.unavailable.irrLeveraged}</p>
              )}
            </MoreDetail>
          )}
          <MoreDetail summary={`Exact exit comparison, ${rows.length} exit years`}>
            <ExactTable
              caption="Exit horizon comparison · USD · before tax"
              headers={[
                'Sell at end of',
                'Net sale proceeds after debt',
                'Cash returned',
                'Profit',
                'Total ROI',
                'Leveraged IRR',
              ]}
              rows={rows.map(({ year, result: r }) => [
                `Year ${year}`,
                dollars(r.saleProceeds.netProceeds),
                dollars(r.summaryMetrics.totalReturn + r.summaryMetrics.totalCashRequired),
                dollars(r.summaryMetrics.totalReturn),
                rate(r.summaryMetrics.totalReturnPercent),
                rate(r.summaryMetrics.irrLeveraged),
              ])}
            />
            <p className={d.detailText}>
              Each horizon is recalculated with the public model. Cash returned includes operating
              cash flow and net sale proceeds; profit also deducts initial cash.
            </p>
          </MoreDetail>
        </Comparison>
      ) : (
        <ChartCard
          title="Exit Analysis & Comparison"
          subtitle="What you would get back if you sold at the end of each compared year."
          basis={['Not calculated']}
        >
          <p className={d.paused}>{paused}</p>
        </ChartCard>
      )}
    </div>
  );
}
