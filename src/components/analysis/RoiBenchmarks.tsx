'use client';
import { Fragment, useMemo, useState, type ReactNode } from 'react';
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
  Basis,
  ChartCard,
  chartColors,
  ComboChart,
  ExactTable,
  InfoTip,
  MoreDetail,
  Segmented,
  Tiles,
} from './RoiChart';
import { RadarChart, ScatterChart } from './RoiCompareCharts';
import styles from './analysis.module.css';
import s from './scenario-charts.module.css';
import b from './benchmark-charts.module.css';

const presets = getAllBenchmarks();
const PROPERTY_COLOR = chartColors.indigo;
/** Reference assets in the chart palette; each asset keeps its colour on every chart. */
const ASSET_COLORS: Record<string, string> = {
  sp500: chartColors.teal,
  nasdaq100: chartColors.orange,
  bonds: chartColors.violet,
  reits: '#9d174d',
  savings: '#4b5567',
  custom: '#8a6d00',
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

/**
 * Growth of the same starting cash in each asset, in USD or indexed to 100. With `onFocus`
 * the legend is a row of toggles that highlight one line.
 */
function GrowthChart({
  assets,
  initial,
  indexed,
  focus,
  onFocus,
  label,
}: {
  assets: Asset[];
  initial: number;
  indexed: boolean;
  focus: string | null;
  onFocus?: (id: string | null) => void;
  label: string;
}) {
  const years = assets[0].projections.map((p) => p.year);
  return (
    <div className={b.growth}>
      {onFocus && (
        <div className={b.focus} role="group" aria-label="Highlight an investment">
          {assets.map((a) => (
            <button
              key={a.id}
              type="button"
              aria-pressed={focus === a.id}
              onClick={() => onFocus(focus === a.id ? null : a.id)}
            >
              <i style={{ background: a.color }} aria-hidden="true" />
              {a.name}
            </button>
          ))}
        </div>
      )}
      <ComboChart
        label={label}
        unit={indexed ? 'Index' : 'USD'}
        years={years}
        xFormat={(y) => `Y${y}`}
        refLines={indexed ? [{ value: 100, label: '100 = start' }] : []}
        format={indexed ? (v) => v.toFixed(4) : undefined}
        series={assets.map((a) => ({
          label: a.name,
          color: a.color,
          values: a.projections.map((p) => (indexed ? (100 * p.value) / initial : p.value)),
          width: focus === a.id ? 2.5 : 2,
          opacity: focus && focus !== a.id ? 0.25 : 1,
        }))}
        legend={onFocus ? [] : assets.map((a) => ({ label: a.name, kind: 'line', color: a.color }))}
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
    </div>
  );
}

/** Missing-comparison card: says what is missing, never a blank panel. */
function Empty({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={`${styles.card} ${b.empty}`} role="status">
      <h3>{title}</h3>
      <p>{children}</p>
    </section>
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
  const noProjection = snapshot
    ? 'The current assumptions have issues. Fix them above and this updates automatically.'
    : 'No projection yet. Complete the missing assumptions (Edit assumptions above).';
  const limit = 'Selection limit: remove a reference asset before choosing another. Maximum two.';

  const picker = (
    <fieldset disabled={saving} className={b.picker}>
      <legend>
        Reference assets <span>{selected.length} of 2 selected</span>
      </legend>
      <span className={b.propertyChip}>
        <i aria-hidden="true" />
        {propertyName}
      </span>
      {[...presets, ...selected.filter((x) => x.type === 'custom')].map((x) => {
        const on = selected.some((y) => y.type === x.type);
        return (
          <label className={b.assetChip} key={x.type} data-on={on || undefined}>
            <input
              type="checkbox"
              checked={on}
              onChange={(e) => {
                if (e.target.checked && selected.length === 2) {
                  setFeedback(limit);
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
            {on && <i style={{ background: assetColor(x.type, x.color) }} aria-hidden="true" />}
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
              setFeedback(limit);
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
                color: '#8a6d00',
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
      <section className={`${styles.card} ${b.intro}`}>
        <div className={b.introHead}>
          <h2>{compare ? 'Asset comparison' : 'Benchmarks'}</h2>
          <Basis items={['Hypothetical markets']} />
        </div>
        <p className={b.caveat}>Historical averages, not live or verified data.</p>
        {compare && picker}
        {compare && selected.some((x) => x.type === 'custom') && (
          <fieldset disabled={saving} className={b.custom}>
            <legend>Custom reference</legend>
            <p>Total return includes reinvested distributions.</p>
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
        <p role="status" aria-live="polite" className={b.feedback}>
          {feedback}
        </p>
        <MoreDetail summary="Sources and method">
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
          <p className={b.method}>
            Each market starts with the property&apos;s initial cash and grows at its annual total
            return for the same hold, before tax and fees. Property wealth is equity plus cash flow
            received; the final year deducts selling costs and the loan payoff.
          </p>
        </MoreDetail>
      </section>

      {!compare &&
        (!market || !baseResult ? (
          <Empty title="No projection to compare">{noProjection}</Empty>
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
        (stale || !snapshot ? (
          <Empty title="No projection to compare">{noProjection}</Empty>
        ) : !snapshot.benchmarks.length ? (
          <Empty title="No reference selected">
            Choose at least one reference asset to compare with {propertyName}.
          </Empty>
        ) : !comparison ? (
          <Empty title="Comparison unavailable">{error}</Empty>
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
  const top = Math.max(...assets.map((x) => x.finalValue));
  return (
    <>
      <section className={`${styles.card} ${b.summary}`} aria-label="Benchmark summary">
        <div className={b.summaryHead}>
          <h3>
            {propertyBest ? 'Property outperforms the markets' : 'Markets outperform this deal'}
          </h3>
          <span>{hold}-year hold</span>
        </div>
        <Tiles
          items={[
            {
              label: 'Property',
              value: wholeDollars(property.finalValue),
              note: `${pct(property.annualizedReturn)} a year · not IRR`,
            },
            {
              label: best.name,
              value: wholeDollars(best.finalValue),
              note: `${pct(best.annualizedReturn)} a year`,
            },
            { label: 'Difference', value: signedMoney(diff), negative: diff < 0 },
          ]}
        />
        <Tiles
          items={[
            {
              label: 'DSCR · Y1',
              value: financed ? (dscr == null ? 'Unavailable' : `${dscr.toFixed(2)}x`) : 'No debt',
              note: !financed
                ? undefined
                : dscr == null
                  ? undefined
                  : dscr >= 1.25
                    ? 'Safe'
                    : dscr >= 1
                      ? 'Tight'
                      : 'At risk',
              negative: dscr != null && dscr < 1,
              info: 'Debt Service Coverage Ratio. Above 1.25 is safe; below 1.0 NOI does not cover the loan.',
            },
            {
              label: 'Worst year',
              value: wholeDollars(worst.cashFlow),
              note: `Year ${worst.year}`,
              negative: worst.cashFlow < 0,
            },
            {
              label: 'Cash recovered',
              value: recovery ? `Year ${recovery}` : `>${hold}y`,
              info: 'Year when cumulative cash flow equals the initial cash invested.',
            },
            {
              label: 'Negative years',
              value: `${negatives} / ${rows.length}`,
              negative: negatives > 0,
            },
          ]}
        />
      </section>

      <ChartCard
        title="Investment comparison"
        subtitle={`${wholeDollars(initial)} invested for ${hold} years`}
      >
        <div className={s.tableWrap} role="region" tabIndex={0} aria-label="Investment comparison">
          <table className={s.table}>
            <thead>
              <tr>
                <th scope="col">Investment</th>
                <th scope="col">Final value</th>
                <th scope="col">Growth</th>
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
                      {a.finalValue === top && (
                        <span className={b.trophy} aria-label="Best performer">
                          ★
                        </span>
                      )}
                    </th>
                    <td>{wholeDollars(a.finalValue)}</td>
                    <td data-tone={a.finalValue < initial ? 'red' : undefined}>
                      {signedMoney(a.finalValue - initial)}
                    </td>
                    <td data-tone={a.id !== 'property' && vs < 0 ? 'red' : undefined}>
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
        title="Growth over time"
        subtitle={indexed ? 'Indexed, start = 100' : undefined}
        controls={
          <Segmented
            label="Growth scale"
            value={indexed ? 'index' : 'dollars'}
            onChange={(v) => setIndexed(v === 'index')}
            options={[
              { value: 'index', label: 'Index' },
              { value: 'dollars', label: 'Dollars' },
            ]}
          />
        }
      >
        <GrowthChart
          assets={assets}
          initial={initial}
          indexed={indexed}
          focus={focus}
          onFocus={setFocus}
          label={
            indexed ? 'Investment growth indexed to 100 at start' : 'Investment growth in dollars'
          }
        />
        <MoreDetail summary="View exact amounts">
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
        </MoreDetail>
      </ChartCard>

      <ChartCard title="Risk vs return" subtitle="Property volatility is not measured">
        <ScatterChart
          label="Reference volatility against annualized return"
          points={refs
            .filter((a) => a.volatility != null && a.annualizedReturn != null)
            .map((a) => ({
              label: a.name,
              x: a.volatility!,
              y: a.annualizedReturn!,
              color: a.color,
            }))}
          refLines={
            property.annualizedReturn == null
              ? []
              : [
                  {
                    value: property.annualizedReturn,
                    label: `Property ${property.annualizedReturn.toFixed(1)}%`,
                    color: PROPERTY_COLOR,
                  },
                ]
          }
        />
      </ChartCard>
    </>
  );
}

const compareMetrics = [
  {
    group: 'Returns',
    key: 'annualized',
    label: 'Annualized return',
    info: 'Average yearly growth (CAGR). For the property: annualized wealth growth, not IRR.',
    higher: true,
    get: (a: Asset) => a.annualizedReturn,
    fmt: (v: number) => pct(v),
  },
  {
    group: 'Returns',
    key: 'total',
    label: 'Total return',
    info: 'Percentage gain over the hold.',
    higher: true,
    get: (a: Asset) => a.totalReturn,
    fmt: (v: number) => pct(v),
  },
  {
    group: 'Growth',
    key: 'final',
    label: 'Final value',
    info: 'Value at the end of the hold (property: net sale proceeds plus cumulative cash flow).',
    higher: true,
    get: (a: Asset) => a.finalValue,
    fmt: wholeDollars,
  },
  {
    group: 'Growth',
    key: 'growth',
    label: 'Total growth',
    info: 'Dollars gained over the hold.',
    higher: true,
    get: (a: Asset, initial: number) => a.finalValue - initial,
    fmt: wholeDollars,
  },
  {
    group: 'Risk',
    key: 'vol',
    label: 'Volatility',
    info: 'Reference standard deviation of returns; not measured for the property.',
    higher: false,
    get: (a: Asset) => a.volatility,
    fmt: (v: number) => pct(v, 1),
  },
  {
    group: 'Risk',
    key: 'riskAdj',
    label: 'Risk-adjusted',
    info: 'Return above a 4% risk-free rate per point of volatility; not measured for the property.',
    higher: true,
    get: (a: Asset) => riskAdjusted(a),
    fmt: (v: number) => v.toFixed(2),
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
      <ChartCard
        title="Side by side"
        subtitle={`${wholeDollars(initial)} invested for ${hold} years`}
        controls={
          <Segmented
            label="Comparison view"
            value={delta ? 'delta' : 'absolute'}
            onChange={(v) => setDelta(v === 'delta')}
            options={[
              { value: 'absolute', label: 'Absolute' },
              { value: 'delta', label: 'vs Property' },
            ]}
          />
        }
      >
        <Tiles
          items={[
            { label: 'Best total return', value: bestTotal?.name ?? 'Unavailable' },
            { label: 'Best CAGR', value: bestCagr?.name ?? 'Unavailable' },
            {
              label: 'Most stable',
              value: stable?.name ?? 'Unavailable',
              info: 'Among assets with a measured volatility.',
            },
          ]}
        />
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
                  <th scope="col" key={a.id}>
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
                    <th colSpan={assets.length + 1} scope="colgroup">
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
                                    {m.fmt(v)}
                                  </span>
                                )}
                                {delta && i > 0 && d != null && d !== 0 && (
                                  <small className={b.delta} data-tone={better ? undefined : 'red'}>
                                    {d > 0 ? '+' : '−'}
                                    {m.key === 'final' || m.key === 'growth'
                                      ? wholeDollars(Math.abs(d))
                                      : m.key === 'riskAdj'
                                        ? Math.abs(d).toFixed(2)
                                        : `${Math.abs(d).toFixed(1)} pp`}
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
        <MoreDetail summary="View exact amounts">
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
        </MoreDetail>
      </ChartCard>

      <ChartCard title="Growth over time">
        <GrowthChart
          assets={assets}
          initial={initial}
          indexed={false}
          focus={null}
          label="Projected value by asset"
        />
      </ChartCard>

      <ChartCard title="Annualized return" subtitle="Property: wealth growth, not IRR">
        <ComboChart
          label="Annualized return by asset"
          unit="Percent"
          xLabel="Asset"
          height={240}
          years={assets.map((a) => a.name)}
          tickFormat={(v) => `${v.toFixed(1)}%`}
          format={(v) => `${v.toFixed(4)}%`}
          series={[
            {
              label: 'Annualized return',
              kind: 'bar',
              color: PROPERTY_COLOR,
              colors: assets.map((a) => a.color),
              values: assets.map((a) => a.annualizedReturn),
            },
          ]}
          legend={[]}
          tooltip={(i) => ({
            title: assets[i].name,
            rows: [{ label: 'Annualized return', text: pct(assets[i].annualizedReturn) }],
          })}
        />
      </ChartCard>

      <ChartCard title="Relative scores" subtitle="0–100 against the best asset">
        <RadarChart
          label="Normalized comparison scores"
          axes={radar.map((r) => r.metric)}
          series={assets.map((a, i) => ({
            label: a.name,
            color: a.color,
            values: radar.map((r) => r.values[i]),
          }))}
        />
        <MoreDetail summary="View scores">
          <p className={s.foot}>
            Risk-adjusted uses a 4% risk-free rate; the property&apos;s yield is its Year 1
            cash-on-cash.
          </p>
          <ExactTable
            caption="Radar scores (0–100)"
            headers={['Dimension', ...assets.map((a) => a.name)]}
            rows={radar.map((r) => [
              r.metric,
              ...r.values.map((v) => (v == null ? 'Not measured' : v.toFixed(1))),
            ])}
          />
        </MoreDetail>
      </ChartCard>
    </>
  );
}
