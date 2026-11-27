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
  ComboChart,
  ExactTable,
  Figure,
  Icon,
  Insight,
  MoreDetail,
  Statement,
  Tiles,
  entityColors,
} from './RoiChart';
import styles from './analysis.module.css';
import chartStyles from './projections.module.css';
import d from './detail-charts.module.css';

const pct = (v: number | null, digits = 2) =>
  v == null || !Number.isFinite(v) ? 'Unavailable' : `${(v * 100).toFixed(digits)}%`;
/** Reference default: Year 10 is selected; otherwise the final compared year. */
const defaultYear = (rows: { year: number }[] | null) =>
  rows?.some((r) => r.year === 10) ? 10 : (rows?.at(-1)?.year ?? null);

function Comparison({
  data,
  probing,
  children,
}: {
  data: ExitRow[];
  /** The figures come from a temporary probe, not the saved exit. */
  probing: boolean;
  children: ReactNode;
}) {
  const [selected, setSelected] = useState<number | null>(() => defaultYear(data));
  const [hovered, setHovered] = useState<number | null>(null);
  const marks = exitLandmarks(data);
  const current = data.find((r) => r.year === selected) ?? null;
  const index = (year: number | null) => {
    const i = data.findIndex((r) => r.year === year);
    return i < 0 ? null : i;
  };
  const toggle = (year: number) => setSelected(selected === year ? null : year);
  const invested = data[0]?.invested ?? 0;
  const red = (v: number | null) => (v != null && v < 0 ? 'red' : undefined);
  const anyLoss = data.some((r) => r.netProceeds < 0 || r.cashFlow < 0);
  return (
    <ChartCard
      title="Exit comparison"
      tag={probing ? 'Probe' : undefined}
      controls={
        <div className={d.years}>
          <span id="exit-year-label">Exit year</span>
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
          </div>
          {selected != null && (
            <button type="button" className={d.clear} onClick={() => setSelected(null)}>
              Clear
            </button>
          )}
        </div>
      }
    >
      {current && (
        <section className={d.summary} aria-labelledby="exit-summary-title">
          <h3 id="exit-summary-title">Year {current.year} exit</h3>
          <Tiles
            items={[
              {
                label: 'Net proceeds',
                value: wholeDollars(current.netProceeds),
                negative: current.netProceeds < 0,
              },
              {
                label: 'Cash flow',
                value: wholeDollars(current.cashFlow),
                negative: current.cashFlow < 0,
              },
              { label: 'Total cash back', value: wholeDollars(current.totalCashBack) },
              {
                label: 'Profit',
                value: wholeDollars(current.profit),
                negative: current.profit < 0,
              },
              {
                label: 'IRR',
                value: pct(current.irr),
                negative: current.irr != null && current.irr < 0,
              },
            ]}
          />
        </section>
      )}
      <ComboChart
        label="Total cash back by exit year: net sale proceeds and cumulative cash flow"
        xLabel="Exit year"
        years={data.map((r) => r.year)}
        xFormat={(y) => `Year ${y}`}
        series={[
          {
            label: 'Net proceeds',
            kind: 'bar',
            stack: true,
            values: data.map((r) => r.netProceeds),
            color: entityColors.netProceeds,
            negativeColor: entityColors.negative,
          },
          {
            label: 'Cash flow',
            kind: 'bar',
            stack: true,
            values: data.map((r) => r.cashFlow),
            color: entityColors.cashFlow,
            negativeColor: entityColors.negative,
          },
        ]}
        refLines={[{ value: invested, label: `Initial: ${wholeDollars(invested)}` }]}
        emphasis={index(selected) ?? index(hovered)}
        emphasizeHover
        onSelect={(i) => toggle(data[i].year)}
        legend={[
          { label: 'Net proceeds', kind: 'bar', color: entityColors.netProceeds },
          { label: 'Cash flow', kind: 'bar', color: entityColors.cashFlow },
          ...(anyLoss
            ? [{ label: 'Loss', kind: 'bar' as const, color: entityColors.negative }]
            : []),
        ]}
        tooltip={(i) => {
          const r = data[i];
          return {
            title: `Year ${r.year}`,
            rows: [
              { label: 'Sale price', value: r.salePrice },
              { label: 'Selling costs', op: '−', value: r.sellingCosts, tone: 'muted' },
              { label: 'Loan payoff', op: '−', value: r.loanPayoff, tone: 'muted' },
              {
                label: 'Net proceeds',
                op: '=',
                value: r.netProceeds,
                total: true,
                tone: 'auto',
                swatch: { color: entityColors.netProceeds },
              },
              {
                label: 'Cash flow received',
                op: '+',
                value: r.cashFlow,
                tone: 'auto',
                swatch: { color: entityColors.cashFlow },
              },
              { label: 'Total cash back', op: '=', value: r.totalCashBack, total: true },
              { label: 'Initial cash', op: '−', value: r.invested, tone: 'muted' },
              { label: 'Profit', op: '=', value: r.profit, total: true, tone: 'auto' },
              { note: `ROI ${pct(r.roi, 1)} · IRR (leveraged) ${pct(r.irr)}` },
            ],
          };
        }}
      />
      <div className={d.exitTable} role="region" tabIndex={0} aria-label="Exit years compared">
        <table>
          <caption className={d.srOnly}>
            Exit years compared · whole dollars · leveraged IRR
          </caption>
          <thead>
            <tr>
              <th scope="col">Exit year</th>
              <th scope="col">Net proceeds</th>
              <th scope="col">Cash flow</th>
              <th scope="col">Total back</th>
              <th scope="col">Profit</th>
              <th scope="col">IRR</th>
              <th scope="col">
                <span className={d.srOnly}>View</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {data.map((r) => {
              const badge =
                marks.bestIrr?.year === r.year
                  ? 'Best IRR'
                  : marks.bestProfit?.year === r.year
                    ? 'Best profit'
                    : marks.breakeven?.year === r.year
                      ? 'Breakeven'
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
                    {badge && <span className={d.badge}>{badge}</span>}
                  </th>
                  <td data-tone={red(r.netProceeds)}>{wholeDollars(r.netProceeds)}</td>
                  <td data-tone={red(r.cashFlow)}>{wholeDollars(r.cashFlow)}</td>
                  <td>{wholeDollars(r.totalCashBack)}</td>
                  <td data-tone={red(r.profit)} data-strong>
                    {wholeDollars(r.profit)}
                  </td>
                  <td data-tone={red(r.irr)}>{pct(r.irr)}</td>
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
        <Insight>
          {marks.bestIrr.year === marks.bestProfit.year ? (
            <>
              Year {marks.bestIrr.year} has the highest IRR (
              <Figure tone={red(marks.bestIrr.irr)}>{pct(marks.bestIrr.irr)}</Figure>) and profit (
              <Figure tone={red(marks.bestProfit.profit)}>
                {wholeDollars(marks.bestProfit.profit)}
              </Figure>
              ).
            </>
          ) : (
            <>
              Year {marks.bestIrr.year} has the highest IRR (
              <Figure tone={red(marks.bestIrr.irr)}>{pct(marks.bestIrr.irr)}</Figure>); year{' '}
              {marks.bestProfit.year} the highest profit (
              <Figure tone={red(marks.bestProfit.profit)}>
                {wholeDollars(marks.bestProfit.profit)}
              </Figure>
              ).
            </>
          )}
          {marks.bestProfit.profit < 0 && (
            <> No compared exit year gets back the cash you put in.</>
          )}
        </Insight>
      )}
      {!marks.bestIrr && (
        <Insight>
          IRR is unavailable for every compared exit year.
          {marks.bestProfit && marks.bestProfit.profit < 0 && (
            <> No compared exit year gets back the cash you put in.</>
          )}
        </Insight>
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
  // New assumptions (an edit, a what-if, its reset or exit) replace the results and any probe:
  // a probe run against earlier assumptions never stays on screen under the current ones.
  const [source, setSource] = useState(payload);
  if (source !== payload) {
    setSource(payload);
    setControls(saved);
    setApplied(saved);
    setCalculation(initial);
    setChanged(false);
    setVersion((v) => v + 1);
  }
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
    ['years', 'Probe exit year', 'Whole years, 1–50'],
    ['sellingCosts', 'Probe selling costs (%)', '0–30% of sale price'],
    ['salePrice', 'Probe sale price override ($)', 'Blank uses the appreciated value'],
  ];
  const paused = stale
    ? 'Exit comparison is paused until the assumptions flagged above are corrected.'
    : changed
      ? 'Not applied yet. Press Update exit comparison to see these probe values.'
      : 'No exit comparison for these values. Correct the probe and update again.';
  return (
    <div className={chartStyles.stack}>
      {data && rows ? (
        <Comparison key={version} data={data} probing={probing}>
          {result && sale && selected && (
            <MoreDetail summary={`View sale statement, year ${selected.year}`}>
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
          <MoreDetail summary="View exact amounts">
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
          </MoreDetail>
        </Comparison>
      ) : (
        <ChartCard title="Exit comparison">
          <p className={d.paused}>{paused}</p>
        </ChartCard>
      )}
      <details className="disclosure">
        <summary>Try another exit</summary>
        <ChartCard title="Exit probe" subtitle="Temporary; not saved" label="Exit probe">
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
      </details>
    </div>
  );
}
