'use client';
import { Fragment, useMemo, useState } from 'react';
import { getAllBenchmarks, type BenchmarkData } from '@/lib/roi';
import {
  calculatePayload,
  type AnalysisPayload,
  type ValidationIssue,
} from '@/lib/analysis/contract';
import {
  customFields,
  type CustomBenchmarkDraft,
  benchmarkComparison,
  marketComparison,
  MARKET_TYPES,
  radarScores,
  riskAdjusted,
  type ComparedAsset,
} from '@/lib/analysis/benchmarks';
import { dollars, rate } from '@/lib/analysis/projections';
import { wholeDollars } from '@/lib/analysis/chart-data';
import {
  ChartCard,
  chartColors,
  ComboChart,
  ExactTable,
  Figure,
  Icon,
  InfoTip,
  Insight,
  Segmented,
  Tiles,
} from './RoiChart';
import { RadarChart, ScatterChart } from './RoiCompareCharts';
import styles from './analysis.module.css';
import s from './scenario-charts.module.css';
import b from './benchmark-charts.module.css';

const presets = getAllBenchmarks();
const PROPERTY_COLOR = chartColors.accent;
/** Reference assets drawn in app-palette hues (each 4.5:1 on white, so labels stay legible). */
const ASSET_COLORS: Record<string, string> = {
  sp500: chartColors.primary,
  nasdaq100: chartColors.plum,
  bonds: '#4f7a2b',
  reits: '#b04a1c',
  savings: chartColors.muted,
  custom: '#8a4526',
};
const assetColor = (type: string, fallback: string) => ASSET_COLORS[type] ?? fallback;
const markets = MARKET_TYPES.map((t) => presets.find((p) => p.type === t)!).filter(Boolean);
const pct = (v: number | null | undefined, d = 2) =>
  v == null || !Number.isFinite(v) ? 'Unavailable' : `${v.toFixed(d)}%`;
const signedMoney = (v: number) => `${v >= 0 ? '+' : '−'}${wholeDollars(Math.abs(v))}`;

type Asset = {
  id: string;
  name: string;
  color: string;
  description: string;
  finalValue: number;
  totalReturn: number;
  annualizedReturn: number | null;
  volatility: number | null;
  yield: number | null;
  projections: { year: number; value: number }[];
};

function assetsOf(
  comparison: NonNullable<ReturnType<typeof benchmarkComparison>['comparison']>,
  references: BenchmarkData[],
  propertyName: string,
  propertyYield: number | null,
): Asset[] {
  return comparison.assets.map((a) => {
    if (a.id === 'property')
      return {
        ...a,
        name: propertyName,
        color: PROPERTY_COLOR,
        description: 'Your rental property with leverage: equity plus cash received',
        volatility: null,
        yield: propertyYield,
      };
    const ref = references.find((r) => r.type === a.id);
    return {
      ...a,
      name: ref?.name ?? a.id,
      color: assetColor(a.id, ref?.color ?? chartColors.muted),
      description: ref?.description ?? '',
      volatility: ref && Number.isFinite(ref.volatility) ? ref.volatility : null,
      yield: ref && Number.isFinite(ref.averageYield) ? ref.averageYield : null,
    };
  });
}

/** Growth lines (property solid w3, references dashed `5 5`), USD or indexed to 100. */
function GrowthChart({
  assets,
  initial,
  indexed,
  focus,
  label,
}: {
  assets: Asset[];
  initial: number;
  indexed: boolean;
  focus: string | null;
  label: string;
}) {
  const years = assets[0].projections.map((p) => p.year);
  const milestones = years.flatMap((y, i) => (y % 5 === 0 ? [i] : []));
  return (
    <ComboChart
      label={label}
      unit={indexed ? 'Index' : 'USD'}
      years={years}
      xFormat={(y) => `Y${y}`}
      xTicks={milestones.length ? milestones : undefined}
      refLines={
        indexed
          ? [{ value: 100, label: '100 = start', color: chartColors.mutedLight, dash: '3 3' }]
          : []
      }
      format={indexed ? (v) => v.toFixed(4) : undefined}
      series={assets.map((a) => ({
        label: a.name,
        color: a.color,
        values: a.projections.map((p) => (indexed ? (100 * p.value) / initial : p.value)),
        width:
          a.id === 'property' ? (focus && focus !== a.id ? 1 : 3) : focus && focus !== a.id ? 1 : 2,
        dash: a.id === 'property' ? undefined : '5 5',
        dot: 0,
        opacity: focus && focus !== a.id ? 0.3 : 1,
      }))}
      legend={assets.map((a) => ({
        label: a.name,
        kind: a.id === 'property' ? 'line' : 'dashed',
        color: a.color,
      }))}
      tooltip={(i) => ({
        title: `Year ${years[i]}`,
        rows: assets.map((a) => {
          const v = a.projections[i]?.value;
          return indexed
            ? {
                label: a.name,
                text:
                  v == null
                    ? 'Unavailable'
                    : `${((100 * v) / initial).toFixed(1)} (${((100 * v) / initial - 100).toFixed(1)}%)`,
                swatch: { color: a.color, kind: 'line' as const },
              }
            : {
                label: a.name,
                value: v ?? null,
                swatch: { color: a.color, kind: 'line' as const },
              };
        }),
      })}
    />
  );
}

export function RoiBenchmarks({
  selected,
  custom,
  onCustomChange,
  errors,
  onChange,
  snapshot,
  stale,
  saving,
  compare,
  propertyName,
}: {
  selected: BenchmarkData[];
  custom: CustomBenchmarkDraft;
  onCustomChange: (draft: CustomBenchmarkDraft) => void;
  errors: ValidationIssue[];
  onChange: (b: BenchmarkData[]) => void;
  snapshot: AnalysisPayload | null;
  stale: boolean;
  saving: boolean;
  compare: boolean;
  propertyName: string;
}) {
  const [feedback, setFeedback] = useState('');
  const [indexed, setIndexed] = useState(true);
  const [focus, setFocus] = useState<string | null>(null);
  const [delta, setDelta] = useState(false);
  const { comparison, error } = benchmarkComparison(stale || !compare ? null : snapshot);
  const market = useMemo(
    () => (stale || compare ? null : marketComparison(snapshot, markets)),
    [stale, compare, snapshot],
  );
  const references = [
    ...presets.map((p) => selected.find((x) => x.type === p.type) ?? p),
    ...(stale
      ? []
      : (snapshot?.benchmarks ?? []).filter((x) => !presets.some((p) => p.type === x.type))),
  ];
  const baseResult = market?.base;
  const compareBase = useMemo(() => {
    if (!compare || stale || !snapshot) return null;
    try {
      return calculatePayload({ ...snapshot, scenarios: [], benchmarks: [] }).base;
    } catch {
      return null;
    }
  }, [compare, stale, snapshot]);
  const cocYield = (r: { summaryMetrics: { cashOnCash: number | null } } | undefined) =>
    r?.summaryMetrics.cashOnCash == null ? null : r.summaryMetrics.cashOnCash * 100;

  const picker = (
    <fieldset disabled={saving} className={b.picker}>
      <legend>Reference assets - {selected.length} selected (up to two)</legend>
      <span className={b.propertyChip}>
        <i aria-hidden="true" />
        {propertyName}
      </span>
      {[...presets, ...selected.filter((x) => x.type === 'custom')].map((x) => {
        const on = selected.some((y) => y.type === x.type);
        return (
          <label
            className={b.assetChip}
            key={x.type}
            data-on={on || undefined}
            style={
              on
                ? {
                    background: assetColor(x.type, x.color),
                    borderColor: assetColor(x.type, x.color),
                  }
                : undefined
            }
          >
            <input
              type="checkbox"
              checked={on}
              onChange={(e) => {
                if (e.target.checked && selected.length === 2) {
                  setFeedback(
                    'Selection limit: remove a reference asset before choosing another. Maximum two.',
                  );
                  return;
                }
                setFeedback('');
                onChange(
                  e.target.checked
                    ? [...selected, { ...x }]
                    : selected.filter((y) => y.type !== x.type),
                );
              }}
            />
            {x.name}
            <span aria-hidden="true">{on ? '×' : '+'}</span>
          </label>
        );
      })}
      {!selected.some((x) => x.type === 'custom') && (
        <button
          type="button"
          className={b.addCustom}
          onClick={() => {
            if (selected.length === 2) {
              setFeedback(
                'Selection limit: remove a reference asset before choosing another. Maximum two.',
              );
              return;
            }
            onChange([
              ...selected,
              {
                type: 'custom',
                name: 'Custom reference',
                description: 'Manager-entered custom assumption, not historical market data',
                historicalCAGR: 0,
                averageYield: 0,
                volatility: 0,
                source: 'Manager-entered; period required',
                color: '#8a4526',
              },
            ]);
          }}
        >
          Add custom reference
        </button>
      )}
    </fieldset>
  );

  return (
    <div className={s.wrap}>
      <section className={styles.card}>
        <h2>{compare ? 'Asset Comparison' : 'Benchmarks'}</h2>
        <p>
          {compare
            ? `Compare ${propertyName} against market references (select up to 2). `
            : `${propertyName} against the S&P 500, Nasdaq 100 and US Bonds on the same capital and hold, like the RealROI Benchmarks tab. This set is read-only; your saved selection is on Compare. `}
          Reference assumptions, not live market data. Imported historical preset periods and rates
          have not been refreshed. Source claims are supplied by RealROI and have not been
          independently verified.
        </p>
        {compare && (
          <>
            <p>
              {propertyName} is always included. Choose up to two distinct reference assets. Remove
              one before selecting a third. No selection produces no comparison.
            </p>
            {picker}
          </>
        )}
        {compare && selected.some((x) => x.type === 'custom') && (
          <fieldset disabled={saving}>
            <legend>Custom reference assumptions</legend>
            <p>
              Explicit assumptions only. CAGR already includes reinvested distributions. Enter
              source and period; a volatility assumption is not measured property risk.
            </p>
            {customFields.map((field) => {
              const path = `benchmarks.${selected.findIndex((x) => x.type === 'custom')}.${field}`;
              const label = {
                name: 'Custom name',
                historicalCAGR: 'Custom total return (% / year, -100 to 100)',
                averageYield: 'Custom yield (%, 0 to 100; not added)',
                volatility: 'Custom volatility reference (%, 0 to 100)',
                source: 'Custom source and period',
              }[field];
              return (
                <label className={styles.field} key={field}>
                  {label}
                  <input
                    id={path}
                    aria-label={label}
                    value={custom[field]}
                    aria-invalid={errors.some((e) => e.path === path)}
                    onChange={(e) => onCustomChange({ ...custom, [field]: e.target.value })}
                  />
                  {errors
                    .filter((e) => e.path === path)
                    .map((e) => (
                      <span role="alert" key={e.path}>
                        {e.message}
                      </span>
                    ))}
                </label>
              );
            })}
          </fieldset>
        )}
        <p role="status" aria-live="polite">
          {feedback}
        </p>
        <details>
          <summary>Reference provenance & method</summary>
          <div
            className={styles.table}
            role="region"
            tabIndex={0}
            aria-label="Benchmark provenance"
          >
            <table>
              <caption>Historical reference metadata - percentage units</caption>
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Annual total return</th>
                  <th>Yield (not added)</th>
                  <th>Volatility reference</th>
                  <th>Source claim / period</th>
                </tr>
              </thead>
              <tbody>
                {references.map((x) => (
                  <tr key={x.type}>
                    <th scope="row">{x.name}</th>
                    <td>{x.historicalCAGR}%</td>
                    <td>{x.averageYield}%</td>
                    <td>{x.volatility}%</td>
                    <td>{x.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            Lump sum, same starting capital and modeled hold, before tax. Benchmark total-return
            assumptions reinvest distributions; yield is not added again. Property cash is held
            without reinvestment. Liquidity, leverage and tax treatment differ.
          </p>
          <button disabled>Match cash flows - unavailable</button>
          <p>
            Saved custom assumptions keep their supplied source. Open Compare and use Add custom
            reference, or edit the existing custom name, return, yield, volatility and source.
            Recalculate to review the results, then Save draft or Save ready to keep them for this
            property. Property volatility and risk-adjusted return remain unavailable: the
            property&apos;s volatility is not measured, so it is never placed on a volatility axis.
          </p>
        </details>
      </section>

      {!compare &&
        (!market || !baseResult ? (
          <p role="status">
            {stale ? 'Comparison needs recalculation.' : 'Complete assumptions and recalculate.'}
          </p>
        ) : (
          <BenchmarksView
            market={market}
            baseResult={baseResult}
            propertyName={propertyName}
            indexed={indexed}
            setIndexed={setIndexed}
            focus={focus}
            setFocus={setFocus}
            propertyYield={cocYield(baseResult)}
          />
        ))}

      {compare &&
        (!comparison || stale ? (
          <p role="status">{stale ? 'Comparison needs recalculation.' : error}</p>
        ) : (
          <CompareView
            comparison={comparison}
            references={references}
            propertyName={propertyName}
            propertyYield={cocYield(compareBase ?? undefined)}
            delta={delta}
            setDelta={setDelta}
          />
        ))}
    </div>
  );
}

function BenchmarksView({
  market,
  baseResult,
  propertyName,
  indexed,
  setIndexed,
  focus,
  setFocus,
  propertyYield,
}: {
  market: NonNullable<ReturnType<typeof marketComparison>>;
  baseResult: NonNullable<ReturnType<typeof marketComparison>>['base'];
  propertyName: string;
  indexed: boolean;
  setIndexed: (v: boolean) => void;
  focus: string | null;
  setFocus: (v: string | null) => void;
  propertyYield: number | null;
}) {
  const assets = assetsOf(market, markets, propertyName, propertyYield);
  const property = assets[0];
  const refs = assets.slice(1);
  const best = refs.reduce((x, y) => (y.finalValue > x.finalValue ? y : x), refs[0]);
  const initial = market.initialInvestment;
  const hold = market.holdingPeriodYears;
  const propertyBest = property.finalValue >= best.finalValue;
  const diff = property.finalValue - best.finalValue;
  const rows = baseResult.annualCashflows;
  const worst = rows.reduce((w, y) => (y.cashFlow < w.cashFlow ? y : w), rows[0]);
  const recovery = rows.find((y) => y.cumulativeCashFlow >= initial)?.year ?? null;
  const negatives = rows.filter((y) => y.cashFlow < 0).length;
  const m = baseResult.summaryMetrics;
  const financed = m.loanAmount > 0;
  const dscr = financed ? m.dscr : null;
  const milestones = [5, 10, 15, 20, 25, 30].filter((y) => y <= hold);
  return (
    <>
      <section
        className={b.banner}
        data-tone={propertyBest ? 'good' : 'warn'}
        aria-label="Benchmark summary"
      >
        <div>
          <h3>
            <Icon name={propertyBest ? 'sparkles' : 'target'} size={22} />
            {propertyBest
              ? `Property outperforms markets (${hold}-year hold)`
              : `Markets outperform this deal (${hold}-year hold)`}
          </h3>
          <dl className={b.bannerRows}>
            <div>
              <dt>Property final value:</dt>
              <dd>{wholeDollars(property.finalValue)}</dd>
            </div>
            <div>
              <dt>{best.name}:</dt>
              <dd>{wholeDollars(best.finalValue)}</dd>
            </div>
            <div data-total>
              <dt>Difference:</dt>
              <dd data-tone={diff >= 0 ? 'good' : 'bad'}>
                {signedMoney(diff)} <Icon name={diff >= 0 ? 'up' : 'down'} size={16} />
              </dd>
            </div>
          </dl>
          <p className={b.disclaimer}>
            Assumes lump-sum investment, leverage included, property cash flows not reinvested,
            taxes excluded. Final property value is net of selling costs and loan payoff. Market
            returns use historical CAGR (not guaranteed).
          </p>
        </div>
        <dl className={b.bannerKpis}>
          <div>
            <dt>Property growth</dt>
            <dd>{pct(property.annualizedReturn)}</dd>
            <small>annualized wealth growth, not IRR</small>
          </div>
          <div>
            <dt>Best Market</dt>
            <dd>{pct(best.annualizedReturn)}</dd>
            <small>{best.name}</small>
          </div>
        </dl>
      </section>

      <Tiles
        size="sm"
        items={[
          {
            label: 'DSCR (Y1)',
            value: financed ? (dscr == null ? 'Unavailable' : `${dscr.toFixed(2)}x`) : 'No debt',
            note: !financed
              ? 'No loan modeled'
              : dscr == null
                ? ''
                : dscr >= 1.25
                  ? 'Safe'
                  : dscr >= 1
                    ? 'Tight'
                    : 'At risk',
            tone:
              !financed || (dscr != null && dscr >= 1.25)
                ? 'teal'
                : dscr != null && dscr >= 1
                  ? 'amber'
                  : 'red',
            info: 'Debt Service Coverage Ratio. Above 1.25 is safe; below 1.0 NOI does not cover the loan.',
          },
          {
            label: 'Worst Year CF',
            value: wholeDollars(worst.cashFlow),
            note: `Year ${worst.year}`,
            tone: worst.cashFlow >= 0 ? 'teal' : 'red',
            info: 'The lowest annual cash flow across the holding period.',
          },
          {
            label: 'Breakeven',
            value: recovery ? `Year ${recovery}` : `>${hold}y`,
            note: 'Cash flow recovery',
            tone: 'teal',
            info: 'Year when cumulative cash flow equals the initial cash invested.',
          },
          {
            label: 'Negative CF Years',
            value: `${negatives} / ${rows.length}`,
            note: negatives === 0 ? 'Always positive' : 'Capital calls needed',
            tone: negatives === 0 ? 'teal' : 'amber',
            info: 'Years with negative cash flow, which need added capital.',
          },
        ]}
      />

      <ChartCard
        title={`Investment Comparison (${hold}-Year Hold)`}
        subtitle="Same initial cash · before tax"
      >
        <div className={s.tableWrap} role="region" tabIndex={0} aria-label="Investment comparison">
          <table className={s.table}>
            <thead>
              <tr>
                <th scope="col">Investment</th>
                <th scope="col">Initial</th>
                <th scope="col">Final Value</th>
                <th scope="col">Total Growth</th>
                <th scope="col">vs Property</th>
                <th scope="col">Annualized</th>
                <th scope="col">Volatility</th>
              </tr>
            </thead>
            <tbody>
              {assets.map((a) => {
                const vs = property.finalValue - a.finalValue;
                return (
                  <tr key={a.id} className={a.id === 'property' ? b.propertyRow : undefined}>
                    <th scope="row">
                      <span className={b.dot} style={{ background: a.color }} />
                      {a.name}
                      {a.finalValue === Math.max(...assets.map((x) => x.finalValue)) && (
                        <span className={b.trophy} aria-label="Best performer">
                          ★
                        </span>
                      )}
                    </th>
                    <td>{wholeDollars(initial)}</td>
                    <td>{wholeDollars(a.finalValue)}</td>
                    <td data-tone={a.finalValue >= initial ? 'teal' : 'red'}>
                      {signedMoney(a.finalValue - initial)}
                    </td>
                    <td
                      data-tone={
                        a.id === 'property'
                          ? undefined
                          : vs > 0
                            ? 'teal'
                            : vs < 0
                              ? 'red'
                              : undefined
                      }
                    >
                      {a.id === 'property' ? '—' : signedMoney(vs)}
                    </td>
                    <td>{pct(a.annualizedReturn)}</td>
                    <td>{a.volatility == null ? 'Not measured' : `${a.volatility}%`}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </ChartCard>

      <ChartCard
        title="Investment Growth Over Time"
        subtitle={indexed ? 'Indexed to 100 at start' : 'Dollar values'}
        controls={
          <div>
            <span className={s.label}>Scale:</span>
            <Segmented
              label="Growth scale"
              size="md"
              value={indexed ? 'index' : 'dollars'}
              onChange={(v) => setIndexed(v === 'index')}
              options={[
                { value: 'index', label: 'Index (100)' },
                { value: 'dollars', label: 'Dollars' },
              ]}
            />
          </div>
        }
      >
        <GrowthChart
          assets={assets}
          initial={initial}
          indexed={indexed}
          focus={focus}
          label={
            indexed ? 'Investment growth indexed to 100 at start' : 'Investment growth in dollars'
          }
        />
        <div
          className={b.milestones}
          role="region"
          tabIndex={0}
          aria-label="Growth at milestone years"
        >
          <table>
            <thead>
              <tr>
                <th scope="col">Investment</th>
                {milestones.map((y) => (
                  <th scope="col" key={y}>
                    Y{y}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {assets.map((a) => (
                <tr key={a.id}>
                  <th
                    scope="row"
                    style={{ color: a.id === 'property' ? chartColors.accent : a.color }}
                  >
                    {a.name}
                  </th>
                  {milestones.map((y) => {
                    const v = a.projections.find((p) => p.year === y)?.value;
                    return (
                      <td key={y}>
                        {v == null
                          ? '—'
                          : indexed
                            ? ((100 * v) / initial).toFixed(0)
                            : wholeDollars(v)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ChartCard>

      <ChartCard
        title="Risk vs Return"
        subtitle="Higher return with lower volatility is better (top-left)"
      >
        <ScatterChart
          label="Reference volatility against annualized return"
          points={refs
            .filter((a) => a.volatility != null && a.annualizedReturn != null)
            .map((a) => ({
              label: a.name,
              x: a.volatility!,
              y: a.annualizedReturn!,
              color: a.color,
              r: 9,
            }))}
          refLines={
            property.annualizedReturn == null
              ? []
              : [
                  {
                    value: property.annualizedReturn,
                    label: `${propertyName} ${property.annualizedReturn.toFixed(2)}% · volatility not measured`,
                    color: chartColors.accent,
                  },
                ]
          }
        />
        <ul className={b.scatterKey}>
          {assets.map((a) => (
            <li key={a.id}>
              <i style={{ background: a.color }} data-line={a.id === 'property' || undefined} />
              {a.name} <b>{pct(a.annualizedReturn, 1)}</b>
            </li>
          ))}
        </ul>
        <p className={s.foot}>
          The property has a projected return but no measured volatility, so it is drawn as a return
          line instead of a point. Reference volatility is source metadata, not a forecast.
        </p>
      </ChartCard>

      <div className={b.cards}>
        {refs.map((a) => {
          const on = focus === a.id;
          const vs = property.finalValue - a.finalValue;
          const ref = markets.find((x) => x.type === a.id);
          return (
            <button
              key={a.id}
              type="button"
              className={b.assetCard}
              aria-pressed={on}
              style={{
                borderTopColor: a.color,
                ...(on ? { boxShadow: `0 0 0 2px white, 0 0 0 4px ${a.color}` } : {}),
              }}
              onClick={() => setFocus(on ? null : a.id)}
            >
              <b>{a.name}</b>
              <small>{a.description}</small>
              <dl>
                <div>
                  <dt>CAGR (used):</dt>
                  <dd>{ref?.historicalCAGR}%</dd>
                </div>
                <div>
                  <dt>Volatility:</dt>
                  <dd>{a.volatility}%</dd>
                </div>
                <div>
                  <dt>vs Property:</dt>
                  <dd data-tone={vs > 0 ? 'good' : 'bad'}>{signedMoney(vs)}</dd>
                </div>
              </dl>
              <span className={s.srOnly}>
                {on ? 'Focused in the growth chart' : 'Focus in the growth chart'}
              </span>
            </button>
          );
        })}
      </div>

      <Insight>
        {propertyBest ? (
          <>
            Property beats {best.name} by <Figure>{wholeDollars(diff)}</Figure> over {hold} years.
            {negatives > 0 && (
              <>
                {' '}
                However, you&apos;ll need to fund <b>{negatives}</b> negative cash flow years.
              </>
            )}
          </>
        ) : (
          <>
            {best.name} would outperform by{' '}
            <Figure tone="red">{wholeDollars(Math.abs(diff))}</Figure>.
            {dscr != null && dscr >= 1.25 && (
              <>
                {' '}
                But the property has stable cash flow (DSCR {dscr.toFixed(2)}x) vs market
                volatility.
              </>
            )}
          </>
        )}
      </Insight>
      <p className={b.footer}>
        <span>Hold: {hold}y</span>
        <span aria-hidden="true">•</span>
        <span>Method: Lump sum</span>
        <span aria-hidden="true">•</span>
        <span>Taxes: Excluded</span>
        <span className={b.footerRight}>
          Market returns based on historical CAGR, not guaranteed
        </span>
      </p>
      <details className={styles.card}>
        <summary>Exact growth by year (USD / index)</summary>
        <ExactTable
          caption="Exact growth - interim equity + cash; final net liquidation + cash"
          headers={['Year', ...assets.map((a) => `${a.name} (USD / index)`)]}
          rows={assets[0].projections.map((p, i) => [
            p.year,
            ...assets.map(
              (a) =>
                `${dollars(a.projections[i]?.value)} / ${a.projections[i] ? ((100 * a.projections[i].value) / initial).toFixed(4) : '—'}`,
            ),
          ])}
        />
      </details>
    </>
  );
}

const compareMetrics = [
  {
    group: 'Returns',
    key: 'annualized',
    label: 'Annualized Return',
    info: 'Average yearly growth (CAGR). For the property: annualized wealth growth, not IRR.',
    impact: 3,
    higher: true,
    get: (a: Asset) => a.annualizedReturn,
    fmt: (v: number) => pct(v),
  },
  {
    group: 'Returns',
    key: 'total',
    label: 'Total Return',
    info: 'Percentage gain over the hold.',
    impact: 3,
    higher: true,
    get: (a: Asset) => a.totalReturn,
    fmt: (v: number) => pct(v),
  },
  {
    group: 'Growth',
    key: 'final',
    label: 'Final Value',
    info: 'Value at the end of the hold (property: net sale proceeds plus cash received).',
    impact: 3,
    higher: true,
    get: (a: Asset) => a.finalValue,
    fmt: wholeDollars,
  },
  {
    group: 'Growth',
    key: 'growth',
    label: 'Total Growth',
    info: 'Dollars gained over the hold.',
    impact: 2,
    higher: true,
    get: (a: Asset, initial: number) => a.finalValue - initial,
    fmt: wholeDollars,
  },
  {
    group: 'Risk',
    key: 'vol',
    label: 'Volatility',
    info: 'Reference standard deviation of returns; not measured for the property.',
    impact: 2,
    higher: false,
    get: (a: Asset) => a.volatility,
    fmt: (v: number) => pct(v, 1),
  },
] as const;

function CompareView({
  comparison,
  references,
  propertyName,
  propertyYield,
  delta,
  setDelta,
}: {
  comparison: NonNullable<ReturnType<typeof benchmarkComparison>['comparison']>;
  references: BenchmarkData[];
  propertyName: string;
  propertyYield: number | null;
  delta: boolean;
  setDelta: (v: boolean) => void;
}) {
  const assets = assetsOf(comparison, references, propertyName, propertyYield);
  const initial = comparison.initialInvestment;
  const hold = comparison.holdingPeriodYears;
  const property = assets[0];
  const bestBy = (get: (a: Asset) => number | null) =>
    assets.reduce<Asset | null>((x, a) => {
      const v = get(a);
      return v == null ? x : !x || v > (get(x) ?? -Infinity) ? a : x;
    }, null);
  const bestTotal = bestBy((a) => a.totalReturn);
  const bestCagr = bestBy((a) => a.annualizedReturn);
  const stable = assets
    .filter((a) => a.volatility != null)
    .reduce<Asset | null>((x, a) => (!x || a.volatility! < x.volatility! ? a : x), null);
  const radarAssets: ComparedAsset[] = assets.map((a) => ({
    id: a.id,
    name: a.name,
    color: a.color,
    annualizedReturn: a.annualizedReturn,
    yield: a.yield,
    volatility: a.volatility,
  }));
  const radar = radarScores(radarAssets);
  return (
    <>
      <div className={b.winners}>
        {[
          { title: 'Best Total Return', icon: 'sparkles' as const, winner: bestTotal },
          { title: 'Best CAGR', icon: 'up' as const, winner: bestCagr },
          {
            title: 'Most Stable',
            icon: 'target' as const,
            winner: stable,
            note: 'Among assets with a measured volatility',
          },
        ].map((w) => (
          <section
            key={w.title}
            className={b.winner}
            data-property={w.winner?.id === 'property' || undefined}
          >
            <p>
              <Icon name={w.icon} size={18} /> {w.title}
            </p>
            <b>{w.winner?.name ?? 'Unavailable'}</b>
            {w.note && <small>{w.note}</small>}
          </section>
        ))}
      </div>

      <ChartCard
        title="Side-by-Side Comparison"
        subtitle={`${hold}-year holding period · same ${wholeDollars(initial)} initial cash · before tax`}
        controls={
          <div>
            <span className={s.label}>View:</span>
            <Segmented
              label="Comparison view"
              value={delta ? 'delta' : 'absolute'}
              onChange={(v) => setDelta(v === 'delta')}
              options={[
                { value: 'absolute', label: 'Absolute' },
                { value: 'delta', label: 'vs Property' },
              ]}
            />
          </div>
        }
      >
        <div
          className={s.tableWrap}
          role="region"
          tabIndex={0}
          aria-label="Side-by-side comparison"
        >
          <table className={s.table}>
            <thead>
              <tr>
                <th scope="col">Metric</th>
                {assets.map((a) => (
                  <th
                    scope="col"
                    key={a.id}
                    style={{ color: a.id === 'property' ? chartColors.accent : a.color }}
                  >
                    <span className={b.dot} style={{ background: a.color }} />
                    {a.name}
                    {a.id === bestTotal?.id && (
                      <span className={b.trophy} aria-label="Best total return">
                        ★
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {['Returns', 'Growth', 'Risk'].map((group) => (
                <Fragment key={group}>
                  <tr className={s.group}>
                    <th colSpan={assets.length + 1} scope="colgroup" className={b.groupTitle}>
                      {group}
                    </th>
                  </tr>
                  {compareMetrics
                    .filter((m) => m.group === group)
                    .map((m) => {
                      const values = assets.map((a) => m.get(a, initial));
                      const known = values.filter((v): v is number => v != null);
                      const best =
                        known.length > 1
                          ? m.higher
                            ? Math.max(...known)
                            : Math.min(...known)
                          : null;
                      const worst =
                        known.length > 1
                          ? m.higher
                            ? Math.min(...known)
                            : Math.max(...known)
                          : null;
                      const pv = values[0];
                      return (
                        <tr key={m.key}>
                          <th scope="row">
                            {m.label} <InfoTip label={m.label}>{m.info}</InfoTip>
                            <span className={b.impact} aria-label={`Impact ${m.impact} of 3`}>
                              {'●'.repeat(m.impact)}
                              {'○'.repeat(3 - m.impact)}
                            </span>
                          </th>
                          {values.map((v, i) => {
                            const d = v != null && pv != null ? v - pv : null;
                            const better = d != null && (m.higher ? d > 0 : d < 0);
                            return (
                              <td key={assets[i].id}>
                                {v == null ? (
                                  <span className={s.na}>Not measured</span>
                                ) : (
                                  <span className={b.cell}>
                                    {v === best && (
                                      <em className={b.badge} data-tone="best">
                                        Best
                                      </em>
                                    )}
                                    {v === worst && v !== best && (
                                      <em className={b.badge} data-tone="worst">
                                        Worst
                                      </em>
                                    )}
                                    <span
                                      data-tone={
                                        v === best ? 'teal' : v === worst ? 'red' : undefined
                                      }
                                    >
                                      {m.fmt(v)}
                                    </span>
                                  </span>
                                )}
                                {delta && i > 0 && d != null && d !== 0 && (
                                  <small className={b.delta} data-tone={better ? 'teal' : 'red'}>
                                    <Icon name={better ? 'up' : 'down'} size={12} />
                                    {d > 0 ? '+' : '−'}
                                    {m.key === 'final' || m.key === 'growth'
                                      ? wholeDollars(Math.abs(d))
                                      : `${Math.abs(d).toFixed(1)}%`}
                                  </small>
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
        <p className={b.tableFoot}>
          <span>
            <i data-tone="best" /> Best in category
          </span>
          <span>
            <i data-tone="worst" /> Worst in category
          </span>
          <span>●●● = High impact metric</span>
        </p>
      </ChartCard>

      <ChartCard
        title="Investment Growth Over Time"
        subtitle="Projected portfolio value comparison · USD"
      >
        <GrowthChart
          assets={assets}
          initial={initial}
          indexed={false}
          focus={null}
          label="Projected value by asset"
        />
      </ChartCard>

      <ChartCard
        title="Annualized Returns Comparison"
        subtitle="Year-over-year return rates by asset class"
      >
        <ComboChart
          label="Annualized return by asset"
          unit="Index"
          xLabel="Asset"
          height={256}
          years={assets.map((a) => a.name)}
          tickFormat={(v) => `${v.toFixed(1)}%`}
          format={(v) => `${v.toFixed(4)}%`}
          series={[
            {
              label: 'Annualized Return',
              kind: 'bar',
              color: PROPERTY_COLOR,
              colors: assets.map((a) => a.color),
              values: assets.map((a) => a.annualizedReturn),
            },
          ]}
          legend={assets.map((a) => ({ label: a.name, kind: 'bar', color: a.color }))}
          tooltip={(i) => ({
            title: assets[i].name,
            rows: [{ label: 'Annualized Return', text: pct(assets[i].annualizedReturn) }],
          })}
        />
        <p className={s.foot}>
          The property figure is annualized wealth growth (final value ÷ initial cash), not IRR.
        </p>
      </ChartCard>

      <ChartCard
        title="Multi-Dimensional Comparison"
        subtitle="Normalized scores across Return, Yield, Stability, and Risk-Adjusted Return"
      >
        <RadarChart
          label="Normalized comparison scores"
          axes={radar.map((r) => r.metric)}
          series={assets.map((a, i) => ({
            label: a.name,
            color: a.color,
            values: radar.map((r) => r.values[i]),
          }))}
        />
        <p className={s.foot}>
          Scores are 0–100 relative to the best selected asset (RealROI method; risk-free rate 4%).
          Hypothetical inputs: reference CAGR, yield and volatility are unverified source metadata;
          the property&apos;s Yield is its Year-1 cash-on-cash. Its Stability and Risk-Adj are not
          measured, so its shape is open (dashed) there instead of an invented value.
        </p>
        <ExactTable
          caption="Radar scores (0–100)"
          headers={['Dimension', ...assets.map((a) => a.name)]}
          rows={radar.map((r) => [
            r.metric,
            ...r.values.map((v) => (v == null ? 'Not measured' : v.toFixed(1))),
          ])}
        />
      </ChartCard>

      <div className={b.cards}>
        {assets.map((a) => (
          <section key={a.id} className={b.assetCard} style={{ borderTopColor: a.color }}>
            <b>{a.name}</b>
            <small>{a.description}</small>
            <dl>
              <div>
                <dt>Final Value:</dt>
                <dd>{wholeDollars(a.finalValue)}</dd>
              </div>
              <div>
                <dt>Total Return:</dt>
                <dd data-tone={a.totalReturn >= 0 ? 'good' : 'bad'}>
                  {a.totalReturn >= 0 ? '+' : ''}
                  {pct(a.totalReturn)}
                </dd>
              </div>
              <div>
                <dt>Annualized:</dt>
                <dd>{pct(a.annualizedReturn)}</dd>
              </div>
              <div>
                <dt>Volatility:</dt>
                <dd>{a.volatility == null ? 'Not measured' : pct(a.volatility, 1)}</dd>
              </div>
              <div>
                <dt>Risk-Adj:</dt>
                <dd>{riskAdjusted(a)?.toFixed(2) ?? 'Not measured'}</dd>
              </div>
            </dl>
          </section>
        ))}
      </div>

      <section className={styles.card}>
        <h2>Exact comparison</h2>
        <p>
          Same {dollars(initial)} initial cash - {hold}-year horizon - before tax
        </p>
        <div
          className={styles.table}
          role="region"
          tabIndex={0}
          aria-label="Same-capital asset comparison"
        >
          <table>
            <thead>
              <tr>
                <th>Metric</th>
                {assets.map((a) => (
                  <th key={a.id}>{a.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                ['Initial cash', ...assets.map(() => dollars(initial))],
                ['Final net liquidation + cash', ...assets.map((a) => dollars(a.finalValue))],
                ['Total growth', ...assets.map((a) => dollars(a.finalValue - initial))],
                [
                  'Annualized wealth growth',
                  ...assets.map((a) =>
                    rate(a.annualizedReturn === null ? null : a.annualizedReturn / 100),
                  ),
                ],
                ['Total growth (%)', ...assets.map((a) => rate(a.totalReturn / 100))],
                [
                  'Rank by final value',
                  ...assets.map((a) =>
                    String(1 + assets.filter((x) => x.finalValue > a.finalValue).length),
                  ),
                ],
                [
                  'Final value delta from property',
                  ...assets.map((a) => dollars(a.finalValue - property.finalValue)),
                ],
                [
                  'Annualized growth delta (pp)',
                  ...assets.map((a) =>
                    a.annualizedReturn === null || property.annualizedReturn === null
                      ? 'Unavailable'
                      : `${(a.annualizedReturn - property.annualizedReturn).toFixed(4)} pp`,
                  ),
                ],
              ].map((row) => (
                <tr key={row[0]}>
                  <th scope="row">{row[0]}</th>
                  {row.slice(1).map((v, i) => (
                    <td key={i}>{v}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>
          Interim property values are equity + accumulated cash; final wealth deducts selling costs
          and debt payoff. Annualized wealth growth differs from timing-aware Summary IRR. Negative
          final wealth has no annualized growth rate.
        </p>
      </section>
    </>
  );
}
