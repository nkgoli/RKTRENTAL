'use client';

import { Fragment, useState } from 'react';
import type { ProjectionResult } from '@/lib/analysis/projections';
import { scenarioSeries, wholeDollars, type ChartValue } from '@/lib/analysis/chart-data';
import { scenarioColors, scenarioDifferences, type ScenarioDraft } from '@/lib/analysis/scenarios';
import type { AnalysisPayload } from '@/lib/analysis/contract';
import {
  ChartCard,
  ComboChart,
  Figure,
  Icon,
  Insight,
  Segmented,
  useHorizon,
} from './RoiChart';
import s from './scenario-charts.module.css';

type Case = { id: string; name: string; result: ProjectionResult };

const pct = (v: number | null | undefined, d = 1) =>
  v == null || !Number.isFinite(v) ? 'Unavailable' : `${(v * 100).toFixed(d)}%`;

/** First year cumulative cash flow recovers the initial cash (reference "breakeven"). */
function recoveryYear(r: ProjectionResult) {
  const initial = r.summaryMetrics.totalCashRequired;
  return r.annualCashflows.find((y) => y.cumulativeCashFlow >= initial)?.year ?? null;
}

type Metric = {
  key: string;
  label: string;
  value: (r: ProjectionResult, h: number) => number | null;
  format: (v: number) => string;
};

/**
 * C18 Scenario comparison: preset-coloured chips (Base fixed, others shown or hidden),
 * differences from Base, focusable case tiles, the key metrics table with a horizon,
 * and equity and cash flow by case. Years past a case's hold stay gaps, never $0.
 */
export function ScenarioCharts({
  cases,
  drafts,
  baseInput,
  label,
  onOpenWhatIf,
}: {
  cases: Case[];
  drafts: ScenarioDraft[];
  baseInput: AnalysisPayload['input'];
  label: (path: string) => string;
  /** Cases are created and edited in the shared What if panel. */
  onOpenWhatIf?: () => void;
}) {
  const [hidden, setHidden] = useState<string[]>([]);
  const [focus, setFocus] = useState<string | null>(null);
  const [view, setView] = useState<'absolute' | 'delta'>('absolute');
  const colors = scenarioColors(cases.map((c) => c.name));
  const visible = cases
    .map((c, i) => ({ ...c, color: colors[i] }))
    .filter((c, i) => i === 0 || !hidden.includes(c.id));
  const longest = Math.max(1, ...cases.map((c) => c.result.annualCashflows.length));
  const [years, horizon] = useHorizon(Math.min(50, longest), 'Scenario horizon', 30);
  const shown = Math.max(1, years);
  const focused = focus && visible.some((c) => c.id === focus) ? focus : null;

  const metrics: { group: string; rows: Metric[] }[] = [
    {
      group: 'Year 1',
      rows: [
        {
          key: 'coc',
          label: 'Cash-on-cash',
          value: (r) =>
            r.summaryMetrics.cashOnCash == null ? null : r.summaryMetrics.cashOnCash * 100,
          format: (v) => `${v.toFixed(2)}%`,
        },
        {
          key: 'dscr',
          label: 'DSCR',
          value: (r) => (r.summaryMetrics.loanAmount > 0 ? r.summaryMetrics.dscr : null),
          format: (v) => v.toFixed(2),
        },
        {
          key: 'noi',
          label: 'NOI',
          value: (r) => r.summaryMetrics.noi,
          format: wholeDollars,
        },
        {
          key: 'cap',
          label: 'Cap rate',
          value: (r) => r.summaryMetrics.capRate * 100,
          format: (v) => `${v.toFixed(2)}%`,
        },
        {
          key: 'cf',
          label: 'Cash flow',
          value: (r) => r.summaryMetrics.annualCashFlow,
          format: wholeDollars,
        },
      ],
    },
    {
      group: `Through year ${shown}`,
      rows: [
        {
          key: 'equity',
          label: `Equity, year ${shown}`,
          value: (r, h) => r.equityTimeline.find((e) => e.month === h * 12)?.equity ?? null,
          format: wholeDollars,
        },
        {
          key: 'cum',
          label: 'Cumulative cash flow',
          value: (r, h) => r.annualCashflows[h - 1]?.cumulativeCashFlow ?? null,
          format: wholeDollars,
        },
        {
          key: 'irr',
          label: 'Leveraged IRR (full hold)',
          value: (r) =>
            r.summaryMetrics.irrLeveraged == null ? null : r.summaryMetrics.irrLeveraged * 100,
          format: (v) => `${v.toFixed(2)}%`,
        },
        {
          key: 'em',
          label: 'Equity multiple (full hold)',
          value: (r) => r.summaryMetrics.equityMultiple,
          format: (v) => `${v.toFixed(2)}x`,
        },
      ],
    },
  ];

  const kpis = visible.map((c) => {
    const rows = c.result.annualCashflows;
    const worst = rows.reduce((w, y) => (y.cashFlow < w.cashFlow ? y : w), rows[0]);
    return {
      ...c,
      dscr: c.result.summaryMetrics.loanAmount > 0 ? c.result.summaryMetrics.dscr : null,
      y1: rows[0]?.cashFlow ?? null,
      irr: c.result.summaryMetrics.irrLeveraged,
      worst,
    };
  });
  const baseKpi = kpis[0];
  const withIrr = kpis.filter((k) => k.irr != null);
  const bestIrr = withIrr.reduce<(typeof kpis)[number] | null>(
    (b, k) => (!b || k.irr! > b.irr! ? k : b),
    null,
  );
  const worstIrr = withIrr.reduce<(typeof kpis)[number] | null>(
    (b, k) => (!b || k.irr! < b.irr! ? k : b),
    null,
  );
  const signed = (v: number, f: (n: number) => string) =>
    `${v > 0 ? '+' : v < 0 ? '−' : ''}${f(Math.abs(v))}`;
  const red = (v: number | null | undefined) => (v != null && v < 0 ? 'red' : undefined);

  const series = (metric: 'equity' | 'cashFlow') =>
    visible.map((c) => ({
      label: c.name,
      color: c.color,
      values: scenarioSeries(c, shown, metric) as ChartValue[],
      width: focused === c.id ? 2.5 : 2,
      opacity: focused && focused !== c.id ? 0.25 : 1,
    }));

  return (
    <div className={s.wrap}>
      <section className={s.card} aria-label="Scenario selection">
        <div className={s.cardHead}>
          <h3>Compare cases</h3>
          <Segmented
            label="Scenario view"
            value={view}
            onChange={setView}
            options={[
              { value: 'absolute', label: 'Absolute' },
              { value: 'delta', label: 'Δ vs Base' },
            ]}
          />
        </div>
        <div className={s.addRow}>
          <ul className={s.chips} aria-label="Scenarios shown">
            {cases.map((c, i) => {
              const on = i === 0 || !hidden.includes(c.id);
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    aria-pressed={on}
                    disabled={i === 0}
                    title={
                      i === 0 ? 'Base Case is always shown' : on ? `Hide ${c.name}` : `Show ${c.name}`
                    }
                    onClick={() =>
                      setHidden((list) =>
                        list.includes(c.id) ? list.filter((x) => x !== c.id) : [...list, c.id],
                      )
                    }
                  >
                    <i style={{ background: colors[i] }} aria-hidden="true" />
                    {c.name}
                    {i > 0 && <span aria-hidden="true">{on ? '×' : '+'}</span>}
                  </button>
                </li>
              );
            })}
          </ul>
          {onOpenWhatIf && (
            <button type="button" className={s.whatIf} onClick={onOpenWhatIf}>
              Try changes in What if
            </button>
          )}
        </div>
        {visible.length > 1 && (
          <div className={s.diffs}>
            <p>Differences from Base</p>
            {visible.slice(1).map((c) => {
              const draft = drafts.find((d) => d.id === c.id);
              const diffs = draft ? scenarioDifferences(draft, baseInput, label) : [];
              return (
                <div key={c.id} className={s.diffRow}>
                  <span className={s.diffName}>
                    <i style={{ background: c.color }} aria-hidden="true" />
                    {c.name}
                  </span>
                  {diffs.some((d) => d.delta !== 0) ? (
                    diffs
                      .filter((d) => d.delta !== 0)
                      .map((d) => {
                        const percent = /\(%/.test(d.label);
                        const name = d.label.replace(/\s*\(.*\)\s*$/, '').toLowerCase();
                        const amount = (v: number) =>
                          percent ? `${+v.toFixed(4)}%` : wholeDollars(v);
                        return (
                          <span
                            key={d.path}
                            className={s.diff}
                            data-tone={d.tone}
                            title={`${d.label}: ${d.raw}`}
                          >
                            {d.delta == null
                              ? `${d.raw}${percent ? '%' : ''} ${name}`
                              : `${d.delta > 0 ? '+' : '−'}${amount(Math.abs(d.delta))} ${name}`}
                          </span>
                        );
                      })
                  ) : (
                    <span className={s.diff} data-tone="neutral">
                      Inherits every base assumption
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <div className={s.kpis}>
          {kpis.map((k, i) => {
            const isFocus = focused === k.id;
            const delta = view === 'delta' && i > 0;
            return (
              <button
                key={k.id}
                type="button"
                className={s.kpi}
                aria-pressed={isFocus}
                data-base={i === 0 || undefined}
                onClick={() => setFocus(isFocus ? null : k.id)}
              >
                <span className={s.kpiHead}>
                  <i style={{ background: k.color }} aria-hidden="true" />
                  <b>{k.name}</b>
                </span>
                <dl>
                  <div>
                    <dt>DSCR</dt>
                    <dd data-tone={k.dscr != null && k.dscr < 1 ? 'red' : undefined}>
                      {k.dscr == null ? 'No debt' : `${k.dscr.toFixed(2)}x`}
                    </dd>
                    {delta && k.dscr != null && baseKpi.dscr != null && (
                      <small data-tone={k.dscr < baseKpi.dscr ? 'red' : undefined}>
                        {signed(k.dscr - baseKpi.dscr, (n) => n.toFixed(2))}
                      </small>
                    )}
                  </div>
                  <div>
                    <dt>Year 1 cash flow</dt>
                    <dd data-tone={red(k.y1)}>{wholeDollars(k.y1)}</dd>
                    {delta && k.y1 != null && baseKpi.y1 != null && (
                      <small data-tone={k.y1 < baseKpi.y1 ? 'red' : undefined}>
                        {signed(k.y1 - baseKpi.y1, (n) => wholeDollars(n))}
                      </small>
                    )}
                  </div>
                  <div>
                    <dt>IRR</dt>
                    <dd data-tone={red(k.irr)}>{pct(k.irr)}</dd>
                    {delta && k.irr != null && baseKpi.irr != null && (
                      <small data-tone={k.irr < baseKpi.irr ? 'red' : undefined}>
                        {signed((k.irr - baseKpi.irr) * 100, (n) => `${n.toFixed(2)}%`)}
                      </small>
                    )}
                  </div>
                  <div>
                    <dt>Worst year</dt>
                    <dd data-tone={red(k.worst?.cashFlow)}>{wholeDollars(k.worst?.cashFlow)}</dd>
                    <small>Year {k.worst?.year}</small>
                  </div>
                </dl>
              </button>
            );
          })}
        </div>
      </section>

      <ChartCard title="Key metrics" controls={horizon}>
        <div className={s.tableWrap} role="region" tabIndex={0} aria-label="Key metrics comparison">
          <table className={`${s.table} ${s.metricsTable}`}>
            <thead>
              <tr>
                <th scope="col">Metric</th>
                {visible.map((c) => (
                  <th scope="col" key={c.id}>
                    <i className={s.swatch} style={{ background: c.color }} aria-hidden="true" />
                    {c.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {metrics.map((g) => (
                <Fragment key={g.group}>
                  <tr className={s.group}>
                    <th colSpan={1 + visible.length} scope="colgroup">
                      {g.group}
                    </th>
                  </tr>
                  {g.rows.map((m) => {
                    const values = visible.map((c) => m.value(c.result, shown));
                    const known = values.filter((v): v is number => v != null);
                    const max = Math.max(...known);
                    const min = Math.min(...known);
                    const unique = (v: number) => known.filter((x) => x === v).length === 1;
                    return (
                      <tr key={m.key}>
                        <th scope="row">{m.label}</th>
                        {values.map((v, i) => {
                          const b = values[0];
                          const d = v != null && b != null ? v - b : null;
                          const best = v != null && known.length > 1 && v === max && unique(v);
                          const worst = v != null && known.length > 1 && v === min && unique(v);
                          return (
                            <td
                              key={visible[i].id}
                              data-best={best || undefined}
                              data-worst={worst || undefined}
                            >
                              {v == null ? (
                                <span className={s.na}>Unavailable</span>
                              ) : view === 'delta' && i > 0 && d ? (
                                <span data-tone={d < 0 ? 'red' : undefined}>
                                  {signed(d, m.format)}
                                </span>
                              ) : (
                                <>
                                  {m.format(v)}
                                  {i > 0 && d != null && (
                                    <span
                                      className={s.trend}
                                      data-tone={d < 0 ? 'red' : d > 0 ? 'up' : undefined}
                                    >
                                      <Icon
                                        name={d > 0 ? 'up' : d < 0 ? 'down' : 'chevronRight'}
                                        size={12}
                                      />
                                    </span>
                                  )}
                                </>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        {visible.length > 1 && (
          <ul className={s.key} aria-label="Table key">
            <li>
              <i data-kind="best" aria-hidden="true" /> Highest
            </li>
            <li>
              <i data-kind="worst" aria-hidden="true" /> Lowest
            </li>
          </ul>
        )}
      </ChartCard>

      <ChartCard title="Equity by case">
        <div className={s.breakevens} role="group" aria-labelledby="scenario-recovery-label">
          <span className={s.label} id="scenario-recovery-label">
            Initial cash recovered:
          </span>
          {visible.map((c) => {
            const y = recoveryYear(c.result);
            return (
              <span key={c.id}>
                <i style={{ background: c.color }} aria-hidden="true" />
                <b>{c.name}:</b>{' '}
                {y ? `Year ${y}` : `Not within ${c.result.annualCashflows.length} years`}
              </span>
            );
          })}
        </div>
        <ComboChart
          label="Year-end equity before selling costs by scenario"
          years={Array.from({ length: shown }, (_, i) => i + 1)}
          xFormat={(y) => `Y${y}`}
          series={series('equity')}
        />
        {visible.length > 1 && (
          <Insight>
            {bestIrr && worstIrr ? (
              <>
                IRR ranges from <Figure tone={red(worstIrr.irr)}>{pct(worstIrr.irr)}</Figure> (
                {worstIrr.name}) to <Figure tone={red(bestIrr.irr)}>{pct(bestIrr.irr)}</Figure> (
                {bestIrr.name}).
                {worstIrr.dscr != null && worstIrr.dscr < 1 && (
                  <>
                    {' '}
                    <b className={s.warn}>{worstIrr.name} has DSCR below 1.0.</b>
                  </>
                )}
              </>
            ) : (
              'Leveraged IRR is unavailable for these scenarios.'
            )}
          </Insight>
        )}
      </ChartCard>

      <ChartCard title="Cash flow by case">
        <ComboChart
          label="Annual operating cash flow by scenario"
          years={Array.from({ length: shown }, (_, i) => i + 1)}
          xFormat={(y) => `Y${y}`}
          series={series('cashFlow')}
        />
      </ChartCard>
    </div>
  );
}
