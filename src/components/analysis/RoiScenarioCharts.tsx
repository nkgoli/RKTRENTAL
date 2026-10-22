'use client';

import { Fragment, useState } from 'react';
import type { ProjectionResult } from '@/lib/analysis/projections';
import { scenarioSeries, wholeDollars, type ChartValue } from '@/lib/analysis/chart-data';
import { scenarioColors, scenarioDifferences, type ScenarioDraft } from '@/lib/analysis/scenarios';
import type { AnalysisPayload } from '@/lib/analysis/contract';
import {
  Basis,
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
  impact: 1 | 2 | 3;
  value: (r: ProjectionResult, h: number) => number | null;
  format: (v: number) => string;
};

/**
 * C18 Scenario comparison visuals: preset-coloured chips (Base fixed, others
 * shown or hidden), Key Differences vs Base, focusable KPI tiles, the Key
 * Metrics table with a horizon, and Equity Growth by Scenario with breakeven
 * pills. Years past a case's hold stay gaps, never $0.
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
  const base = visible[0];
  const focused = focus && visible.some((c) => c.id === focus) ? focus : null;

  const metrics: { group: string; rows: Metric[] }[] = [
    {
      group: 'Year 1 Stability',
      rows: [
        {
          key: 'coc',
          label: 'Cash-on-Cash',
          impact: 3,
          value: (r) =>
            r.summaryMetrics.cashOnCash == null ? null : r.summaryMetrics.cashOnCash * 100,
          format: (v) => `${v.toFixed(2)}%`,
        },
        {
          key: 'dscr',
          label: 'DSCR',
          impact: 3,
          value: (r) => (r.summaryMetrics.loanAmount > 0 ? r.summaryMetrics.dscr : null),
          format: (v) => v.toFixed(2),
        },
        {
          key: 'noi',
          label: 'NOI',
          impact: 2,
          value: (r) => r.summaryMetrics.noi,
          format: wholeDollars,
        },
        {
          key: 'cap',
          label: 'Cap Rate',
          impact: 2,
          value: (r) => r.summaryMetrics.capRate * 100,
          format: (v) => `${v.toFixed(2)}%`,
        },
        {
          key: 'cf',
          label: 'Annual Cash Flow',
          impact: 3,
          value: (r) => r.summaryMetrics.annualCashFlow,
          format: wholeDollars,
        },
      ],
    },
    {
      group: `Hold Period Returns (${shown}Y)`,
      rows: [
        {
          key: 'equity',
          label: `Equity (Year ${shown})`,
          impact: 3,
          value: (r, h) => r.equityTimeline.find((e) => e.month === h * 12)?.equity ?? null,
          format: wholeDollars,
        },
        {
          key: 'cum',
          label: `Cumulative Cash Flow (Year ${shown})`,
          impact: 3,
          value: (r, h) => r.annualCashflows[h - 1]?.cumulativeCashFlow ?? null,
          format: wholeDollars,
        },
        {
          key: 'irr',
          label: 'Leveraged IRR (full hold)',
          impact: 3,
          value: (r) =>
            r.summaryMetrics.irrLeveraged == null ? null : r.summaryMetrics.irrLeveraged * 100,
          format: (v) => `${v.toFixed(2)}%`,
        },
        {
          key: 'em',
          label: 'Equity Multiple (full hold)',
          impact: 3,
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
  const tone = (v: number | null, good: number, ok: number) =>
    v == null ? 'muted' : v >= good ? 'teal' : v >= ok ? 'amber' : 'red';

  const series = (metric: 'equity' | 'cashFlow') =>
    visible.map((c) => ({
      label: c.name,
      color: c.color,
      values: scenarioSeries(c, shown, metric) as ChartValue[],
      width: focused === c.id ? 3 : 2,
      dot: 0,
      opacity: focused && focused !== c.id ? 0.3 : 1,
    }));

  return (
    <div className={s.wrap}>
      <section className={s.card} aria-label="Scenario selection">
        <div className={s.cardHead}>
          <div>
            <h3>Saved cases</h3>
            <p>
              Choose which cases to show. The Base Case is your saved assumptions; cases change only
              the assumptions they override.
            </p>
            <Basis items={['Projected', 'USD', 'Before tax']} />
          </div>
          <div className={s.view}>
            <span>View:</span>
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
        </div>
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
                  style={on ? { background: colors[i] } : undefined}
                  onClick={() =>
                    setHidden((list) =>
                      list.includes(c.id) ? list.filter((x) => x !== c.id) : [...list, c.id],
                    )
                  }
                >
                  {c.name}
                  {i > 0 && <span aria-hidden="true">{on ? '×' : '+'}</span>}
                </button>
              </li>
            );
          })}
        </ul>
        {onOpenWhatIf && (
          <div className={s.addRow}>
            <button type="button" onClick={onOpenWhatIf}>
              Create or edit cases in What if
            </button>
          </div>
        )}
        {visible.length > 1 && (
          <div className={s.diffs}>
            <p>Key Differences vs Base</p>
            {visible.slice(1).map((c) => {
              const draft = drafts.find((d) => d.id === c.id);
              const diffs = draft ? scenarioDifferences(draft, baseInput, label) : [];
              return (
                <div key={c.id} className={s.diffRow}>
                  <span className={s.diffName} style={{ background: c.color }}>
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
      </section>

      <p className={s.hint}>
        Year 1 figures and hold-period IRR for each case
        {view === 'delta' ? ', with the change from the Base Case below each value' : ''}. Select a
        case to highlight its lines in the charts below.
      </p>
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
              style={{
                borderColor: k.color,
                ...(isFocus ? { boxShadow: `0 0 0 2px white, 0 0 0 4px ${k.color}` } : {}),
              }}
              onClick={() => setFocus(isFocus ? null : k.id)}
            >
              <span className={s.kpiHead}>
                <b>{k.name}</b>
                {isFocus && (
                  <span style={{ color: k.color }}>
                    <Icon name="target" size={16} />
                  </span>
                )}
              </span>
              <dl>
                <div>
                  <dt>DSCR</dt>
                  <dd data-tone={k.dscr == null ? 'muted' : tone(k.dscr, 1.25, 1)}>
                    {k.dscr == null ? 'No debt' : `${k.dscr.toFixed(2)}x`}
                  </dd>
                  {delta && k.dscr != null && baseKpi.dscr != null && (
                    <small data-tone={k.dscr >= baseKpi.dscr ? 'teal' : 'red'}>
                      {signed(k.dscr - baseKpi.dscr, (n) => n.toFixed(2))}
                    </small>
                  )}
                </div>
                <div>
                  <dt>Year 1 CF</dt>
                  <dd data-tone={k.y1 == null ? 'muted' : k.y1 >= 0 ? 'teal' : 'red'}>
                    {wholeDollars(k.y1)}
                  </dd>
                  {delta && k.y1 != null && baseKpi.y1 != null && (
                    <small data-tone={k.y1 >= baseKpi.y1 ? 'teal' : 'red'}>
                      {signed(k.y1 - baseKpi.y1, (n) => wholeDollars(n))}
                    </small>
                  )}
                </div>
                <div>
                  <dt>IRR</dt>
                  <dd>{pct(k.irr)}</dd>
                  {delta && k.irr != null && baseKpi.irr != null && (
                    <small data-tone={k.irr >= baseKpi.irr ? 'teal' : 'red'}>
                      {signed((k.irr - baseKpi.irr) * 100, (n) => `${n.toFixed(2)}%`)}
                    </small>
                  )}
                </div>
                <div>
                  <dt>Worst Year</dt>
                  <dd data-tone={k.worst && k.worst.cashFlow >= 0 ? 'amber' : 'red'} data-size="sm">
                    {wholeDollars(k.worst?.cashFlow)}
                  </dd>
                  <small>Year {k.worst?.year}</small>
                </div>
              </dl>
            </button>
          );
        })}
      </div>

      <ChartCard
        title="Key Metrics Comparison"
        subtitle="Which case does best on each measure, for Year 1 and over the chosen horizon."
        basis={[
          'Projected',
          `Year 1 and ${shown}-year horizon`,
          'IRR over the full hold',
          'Before tax',
        ]}
        controls={
          <div className={s.view}>
            <span>Horizon:</span>
            {horizon}
          </div>
        }
      >
        <div className={s.tableWrap} role="region" tabIndex={0} aria-label="Key metrics comparison">
          <table className={`${s.table} ${s.metricsTable}`}>
            <thead>
              <tr>
                <th scope="col">
                  <span className={s.srOnly}>Impact</span>
                </th>
                <th scope="col">Metric</th>
                {visible.map((c) => (
                  <th scope="col" key={c.id} style={{ color: c.color }}>
                    {c.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {metrics.map((g) => (
                <Fragment key={g.group}>
                  <tr className={s.group}>
                    <th colSpan={2 + visible.length} scope="colgroup">
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
                        <td
                          className={s.impact}
                          data-level={m.impact}
                          aria-label={`Impact ${m.impact} of 3`}
                        >
                          {'●'.repeat(m.impact)}
                        </td>
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
                                <span data-tone={d > 0 ? 'teal' : 'red'}>
                                  {signed(d, m.format)}
                                </span>
                              ) : (
                                <>
                                  {m.format(v)}
                                  {i > 0 && d != null && (
                                    <span
                                      className={s.trend}
                                      data-tone={d > 0 ? 'teal' : d < 0 ? 'red' : 'muted'}
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
              <i data-kind="best" aria-hidden="true" /> Highest among shown cases
            </li>
            <li>
              <i data-kind="worst" aria-hidden="true" /> Lowest among shown cases
            </li>
            <li>
              <span aria-hidden="true">●●●</span> Impact rating (three dots highest)
            </li>
            {view === 'delta' && <li>Δ view: other cases show the change from the Base Case</li>}
          </ul>
        )}
      </ChartCard>

      <ChartCard
        title="Equity Growth by Scenario"
        subtitle="How much equity each case builds, year by year."
        basis={[
          'Projected',
          'USD, year-end',
          `${shown}-year horizon`,
          'Before selling costs',
          'Before tax',
        ]}
      >
        <div className={s.breakevens} role="group" aria-labelledby="scenario-recovery-label">
          <span className={s.label} id="scenario-recovery-label">
            Initial cash recovered:
          </span>
          {visible.map((c) => {
            const y = recoveryYear(c.result);
            return (
              <span key={c.id} style={{ background: `${c.color}1f`, color: c.color }}>
                <b>{c.name}:</b>{' '}
                <code>
                  {y ? `Year ${y}` : `Not within ${c.result.annualCashflows.length} years`}
                </code>
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
        <Insight>
          {visible.length < 2 ? (
            <>
              Only the Base Case is shown
              {bestIrr && (
                <>
                  {' '}
                  (leveraged IRR <Figure>{pct(bestIrr.irr)}</Figure>)
                </>
              )}
              . Save a case from What if, such as the Optimistic or Conservative preset, to compare
              outcomes.
            </>
          ) : bestIrr && worstIrr ? (
            <>
              IRR ranges from <Figure tone="red">{pct(worstIrr.irr)}</Figure> ({worstIrr.name}) to{' '}
              <Figure>{pct(bestIrr.irr)}</Figure> ({bestIrr.name}) — a{' '}
              <b>{((bestIrr.irr! - worstIrr.irr!) * 100).toFixed(1)} percentage-point</b> spread.
              {worstIrr.dscr != null && worstIrr.dscr < 1 && (
                <>
                  {' '}
                  <b className={s.warn}>Warning:</b> {worstIrr.name} has DSCR below 1.0.
                </>
              )}
            </>
          ) : (
            'Leveraged IRR is unavailable for these scenarios.'
          )}{' '}
          Initial cash is recovered in the first year that cumulative cash flow reaches the cash
          invested.
        </Insight>
        <p className={s.foot}>
          Holding period: {base.result.annualCashflows.length} years · Selling costs:{' '}
          {baseInput.appreciationExit?.sellingCostsPercent ?? 'Not set'}% · Years past a shorter
          hold are gaps, not $0
        </p>
      </ChartCard>

      <ChartCard
        title="Cash Flow by Scenario"
        subtitle="Each case's operating cash flow, year by year."
        basis={['Projected', 'USD per year', `Years 1–${shown}`, 'Before tax']}
      >
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
