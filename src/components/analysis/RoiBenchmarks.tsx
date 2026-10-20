'use client';
import { useState } from 'react';
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
} from '@/lib/analysis/benchmarks';
import { dollars, rate } from '@/lib/analysis/projections';
import { LineChart } from './RoiProjections';
import styles from './analysis.module.css';

const presets = getAllBenchmarks();
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
  const { comparison, error } = benchmarkComparison(stale ? null : snapshot);
  let base: ReturnType<typeof calculatePayload>['base'] | null = null;
  try {
    if (snapshot && !stale) base = calculatePayload({ ...snapshot, benchmarks: [] }).base;
  } catch {}
  const references = [
    ...presets.map((p) => selected.find((b) => b.type === p.type) ?? p),
    ...(stale
      ? []
      : (snapshot?.benchmarks ?? []).filter((b) => !presets.some((p) => p.type === b.type))),
  ];
  const maxVolatility = Math.max(25, ...references.map((b) => b.volatility));
  const minReturn = Math.min(0, ...references.map((b) => b.historicalCAGR));
  const maxReturn = Math.max(15, ...references.map((b) => b.historicalCAGR));
  const riskX = (v: number) => 60 + (v / maxVolatility) * 480;
  const riskY = (v: number) => 220 - ((v - minReturn) / (maxReturn - minReturn)) * 180;
  const name = (id: string) =>
    id === 'property'
      ? propertyName
      : (snapshot?.benchmarks.find((b) => b.type === id)?.name ?? id);
  const assets = comparison?.assets ?? [];
  const property = assets[0];
  return (
    <div>
      <section className={styles.card}>
        <h2>{compare ? 'Asset comparison' : 'Benchmarks'}</h2>
        <p>
          Reference assumptions, not live market data. Imported historical preset periods and rates
          have not been refreshed. Source claims are supplied by RealROI and have not been
          independently verified.
        </p>
        <p>
          {propertyName} is always included. Choose up to two distinct reference assets. Remove one
          before selecting a third. No selection produces no comparison.
        </p>
        <fieldset disabled={saving}>
          <legend>Reference assets - {selected.length} selected</legend>
          {[...presets, ...selected.filter((b) => b.type === 'custom')].map((b) => (
            <label className={styles.check} key={b.type}>
              <input
                type="checkbox"
                checked={selected.some((s) => s.type === b.type)}
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
                      ? [...selected, { ...b }]
                      : selected.filter((s) => s.type !== b.type),
                  );
                }}
              />
              {b.name}
            </label>
          ))}
          {!selected.some((b) => b.type === 'custom') && (
            <button
              type="button"
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
                    color: '#a4603d',
                  },
                ]);
              }}
            >
              Add custom reference
            </button>
          )}
        </fieldset>
        {selected.some((b) => b.type === 'custom') && (
          <fieldset disabled={saving}>
            <legend>Custom reference assumptions</legend>
            <p>
              Explicit assumptions only. CAGR already includes reinvested distributions. Enter
              source and period; a volatility assumption is not measured property risk.
            </p>
            {customFields.map((field) => {
              const path = `benchmarks.${selected.findIndex((b) => b.type === 'custom')}.${field}`;
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
                    id={compare ? path : undefined}
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
        <div className={styles.table} role="region" tabIndex={0} aria-label="Benchmark provenance">
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
              {references.map((b) => (
                <tr key={b.type}>
                  <th scope="row">{b.name}</th>
                  <td>{b.historicalCAGR}%</td>
                  <td>{b.averageYield}%</td>
                  <td>{b.volatility}%</td>
                  <td>{b.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <details>
          <summary>Method & data provenance</summary>
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
            property. Property volatility and risk-adjusted return remain unavailable.
          </p>
        </details>
      </section>
      {!comparison || stale ? (
        <p role="status">{stale ? 'Comparison needs recalculation.' : error}</p>
      ) : (
        <>
          <section className={styles.card}>
            <h2>Side-by-side comparison</h2>
            <p>
              Same {dollars(comparison.initialInvestment)} initial cash -{' '}
              {comparison.holdingPeriodYears}-year horizon - before tax
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
                      <th key={a.id}>{name(a.id)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['Initial cash', ...assets.map(() => dollars(comparison.initialInvestment))],
                    ['Final net liquidation + cash', ...assets.map((a) => dollars(a.finalValue))],
                    [
                      'Total growth',
                      ...assets.map((a) => dollars(a.finalValue - comparison.initialInvestment)),
                    ],
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
                        String(1 + assets.filter((b) => b.finalValue > a.finalValue).length),
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
              Interim property values are equity + accumulated cash; final wealth deducts selling
              costs and debt payoff. Annualized wealth growth differs from timing-aware Summary IRR.
              Negative final wealth has no annualized growth rate.
            </p>
          </section>
          <section className={styles.card}>
            <h2>Investment growth over time</h2>{' '}
            {!compare && (
              <LineChart
                label="Reference investment growth indexed to 100 at start"
                unit="Index"
                years={[0, ...assets[0].projections.map((p) => p.year)]}
                series={assets.slice(1).map((a, i) => ({
                  label: name(a.id),
                  color: ['#a4603d', '#64748b'][i],
                  values: [
                    100,
                    ...a.projections.map((p) => (100 * p.value) / comparison.initialInvestment),
                  ],
                }))}
              />
            )}
            <LineChart
              label="Interim equity + cash; final net liquidation + cash"
              years={assets[0].projections.map((p) => p.year)}
              series={assets.map((a, i) => ({
                label: name(a.id),
                values: a.projections.map((p) => p.value),
                color: ['#1e3a8a', '#a4603d', '#64748b'][i],
                dashed: i === 2,
              }))}
            />
            <div
              className={styles.table}
              role="region"
              tabIndex={0}
              aria-label="Exact investment growth"
            >
              <table>
                <thead>
                  <tr>
                    <th>Year</th>
                    {assets.map((a) => (
                      <th key={a.id}>{name(a.id)} - USD / index</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th>Start</th>
                    {assets.map((a) => (
                      <td key={a.id}>{dollars(comparison.initialInvestment)} / 100</td>
                    ))}
                  </tr>
                  {assets[0].projections.map((p, i) => (
                    <tr key={p.year}>
                      <th scope="row">{p.year}</th>
                      {assets.map((a) => (
                        <td key={a.id}>
                          {dollars(a.projections[i].value)} /{' '}
                          {((100 * a.projections[i].value) / comparison.initialInvestment).toFixed(
                            4,
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>
              Index starts at 100. Rates are constant hypothetical growth, not a historical price
              series.
            </p>
          </section>
        </>
      )}
      {base && (
        <section className={styles.card}>
          <h2>Property risk context</h2>
          <dl className={styles.statement}>
            <div>
              <dt>Year 1 DSCR</dt>
              <dd>{base.summaryMetrics.dscr?.toFixed(4) ?? 'Unavailable'}</dd>
            </div>
            <div>
              <dt>Worst annual cash flow</dt>
              <dd>{dollars(Math.min(...base.annualCashflows.map((y) => y.cashFlow)))}</dd>
            </div>
            <div>
              <dt>Negative cash-flow years</dt>
              <dd>
                {base.annualCashflows.filter((y) => y.cashFlow < 0).length} of{' '}
                {base.annualCashflows.length}
              </dd>
            </div>
            <div>
              <dt>Cash-only payback</dt>
              <dd>{base.summaryMetrics.paybackPeriodYears ?? 'Beyond hold'}</dd>
            </div>
            <div>
              <dt>Observed volatility</dt>
              <dd>Not measured</dd>
            </div>
          </dl>
          <p>
            These describe the base model, not historical risk measurements. Risk-adjusted return is
            unavailable without comparable property risk data.
          </p>
        </section>
      )}
      <section className={styles.card}>
        <h2>Risk vs return reference</h2>
        <svg
          viewBox="0 0 700 280"
          style={{ width: '100%', height: 'auto' }}
          role="img"
          aria-label="Reference risk and return: horizontal volatility percent, vertical annual return percent. Exact values in provenance table."
        >
          <path d="M60 20V230H680" fill="none" stroke="#64748b" />
          <text x="60" y="265">
            Volatility reference (%)
          </text>
          <text x="60" y="16">
            Annual return (%)
          </text>
          {references.map((b) => (
            <g key={b.type}>
              <circle cx={riskX(b.volatility)} cy={riskY(b.historicalCAGR)} r="5" fill={b.color} />
              <text x={riskX(b.volatility) + 8} y={riskY(b.historicalCAGR) - 6} fontSize="12">
                {b.name}
              </text>
            </g>
          ))}
        </svg>
        <p>
          The provenance table pairs reference annual return and volatility. Property is omitted
          because its observed volatility is unavailable. Reference volatility is source metadata,
          not a measured forecast or a risk score.
        </p>
      </section>
    </div>
  );
}
