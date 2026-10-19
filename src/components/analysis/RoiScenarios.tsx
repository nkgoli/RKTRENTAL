'use client';
import { useMemo, useState } from 'react';
import { calculatePayload, type AnalysisPayload, type ValidationIssue } from '@/lib/analysis';
import type { ScenarioDraft } from '@/lib/analysis/scenarios';
import { dollars, rate } from '@/lib/analysis/projections';
import { groups, readPath } from './fields';
import { LineChart } from './RoiProjections';
import styles from './analysis.module.css';
import scenarioStyles from './scenarios.module.css';
export function RoiScenarios({
  drafts,
  onChange,
  snapshot,
  stale,
  errors,
  base,
  saving,
}: {
  drafts: ScenarioDraft[];
  onChange: (d: ScenarioDraft[]) => void;
  snapshot: AnalysisPayload | null;
  stale: boolean;
  errors: ValidationIssue[];
  base: AnalysisPayload;
  saving: boolean;
}) {
  const [horizon, setHorizon] = useState(10);
  const calculated = useMemo(() => {
    try {
      return snapshot ? calculatePayload(snapshot) : null;
    } catch {
      return null;
    }
  }, [snapshot]);
  const cases = calculated
    ? [{ name: 'Base Case', result: calculated.base }, ...calculated.scenarios]
    : [];
  const max = Math.max(1, Math.min(50, ...cases.map((c) => c.result.annualCashflows.length)));
  const years = Math.min(horizon, max);
  const fields = groups.flatMap((g) => g.fields).filter((f) => f.path.startsWith('input.'));
  function update(index: number, change: Partial<ScenarioDraft>) {
    onChange(drafts.map((d, i) => (i === index ? { ...d, ...change } : d)));
  }
  return (
    <section className={scenarioStyles.scenarios}>
      <h2>Scenario comparison</h2>
      <p>
        Custom cases inherit unspecified base assumptions. Clearing an override restores
        inheritance. Fixed dollar amounts take precedence over percentages. The saved base stays
        separate.
      </p>
      <button
        type="button"
        disabled={saving || drafts.length >= 20}
        onClick={() => {
          const index = drafts.length;
          onChange([
            ...drafts,
            { id: crypto.randomUUID(), name: `Custom case ${index + 1}`, values: {} },
          ]);
          setTimeout(() => document.getElementById(`scenarios.${index}.name`)?.focus(), 0);
        }}
      >
        Create scenario
      </button>
      <p>{drafts.length} of 20 scenarios</p>
      {drafts.map((d, index) => (
        <details open key={d.id} className={styles.card}>
          <summary>{d.name || 'Unnamed scenario'}</summary>
          <fieldset disabled={saving}>
            <label className={styles.field}>
              Scenario name
              <input
                id={`scenarios.${index}.name`}
                value={d.name}
                maxLength={200}
                onChange={(e) => update(index, { name: e.target.value })}
              />
            </label>
            {errors
              .filter((e) => e.path.startsWith(`scenarios.${index}`))
              .map((e) => (
                <p role="alert" key={e.path}>
                  {e.message}
                </p>
              ))}
            <button
              type="button"
              onClick={() => {
                onChange(drafts.filter((_, i) => i !== index));
                setTimeout(() => document.getElementById('roi-section-tab-scenarios')?.focus(), 0);
              }}
            >
              Remove {d.name || 'scenario'}
            </button>
            <details>
              <summary>Assumptions and overrides</summary>
              {fields.map((f) => {
                const path = f.path.slice(6);
                const id = `scenarios.${index}.overrides.${path}`;
                return (
                  <label className={styles.field} key={path}>
                    {f.label} - Base: {String(readPath(base, f.path) ?? 'Not set')}
                    {f.kind === 'select' ? (
                      <select
                        id={id}
                        value={d.values[path] ?? ''}
                        onChange={(e) =>
                          update(index, { values: { ...d.values, [path]: e.target.value } })
                        }
                      >
                        <option value="">Inherit base</option>
                        {f.choices?.map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        id={id}
                        value={d.values[path] ?? ''}
                        placeholder="Inherit base"
                        onChange={(e) =>
                          update(index, { values: { ...d.values, [path]: e.target.value } })
                        }
                      />
                    )}
                  </label>
                );
              })}
            </details>
            {d.options && (
              <details>
                <summary>Explicit scenario calculation options</summary>
                <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                  {JSON.stringify(d.options, null, 2)}
                </pre>
                <button type="button" onClick={() => update(index, { options: undefined })}>
                  Use base calculation options
                </button>
              </details>
            )}
          </fieldset>
        </details>
      ))}
      {drafts.length > 0 && (
        <div
          className={styles.table}
          role="region"
          tabIndex={0}
          aria-label="Scenario assumption comparison"
        >
          <table>
            <caption>Overridden assumptions - blank fields inherit base</caption>
            <thead>
              <tr>
                <th>Assumption</th>
                <th>Base Case</th>
                {drafts.map((d) => (
                  <th key={d.id}>{d.name || 'Unnamed scenario'}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {fields
                .filter((f) => drafts.some((d) => d.values[f.path.slice(6)]?.trim()))
                .map((f) => (
                  <tr key={f.path}>
                    <th scope="row">{f.label}</th>
                    <td>{String(readPath(base, f.path) ?? 'Not set')}</td>
                    {drafts.map((d) => (
                      <td key={d.id}>{d.values[f.path.slice(6)]?.trim() || 'Inherit base'}</td>
                    ))}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
      {stale || !calculated ? (
        <p role="status">
          Scenario results are out of date or unavailable. Recalculate to compare current edits.
        </p>
      ) : (
        <>
          <label className={styles.field}>
            Chart horizon
            <select value={years} onChange={(e) => setHorizon(Number(e.target.value))}>
              {Array.from({ length: max }, (_, i) => (
                <option key={i} value={i + 1}>
                  {i + 1} years
                </option>
              ))}
            </select>
          </label>
          <div className={styles.properties}>
            {cases.map((c, i) => (
              <section className={styles.card} key={i}>
                <h3>{c.name}</h3>
                <p>Year 1 cash flow</p>
                <strong>{dollars(c.result.annualCashflows[0].cashFlow / 12)} / month</strong>
                <p>Cash-on-cash: {rate(c.result.summaryMetrics.cashOnCash)}</p>
                <p>Hold-period leveraged IRR: {rate(c.result.summaryMetrics.irrLeveraged)}</p>
                <p>
                  Year {years} equity before selling costs:{' '}
                  {dollars(c.result.equityTimeline.find((r) => r.month === years * 12)?.equity)}
                </p>
              </section>
            ))}
          </div>
          <div className={styles.table} tabIndex={0} role="region" aria-label="Scenario metrics">
            <table>
              <caption>Key metrics - amounts and deltas</caption>
              <thead>
                <tr>
                  <th>Metric</th>
                  {cases.map((c, i) => (
                    <th key={i}>{c.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  'Year 1 cash flow',
                  'Cash-flow delta',
                  'Hold-period leveraged IRR',
                  'IRR delta (percentage points)',
                ].map((label, row) => (
                  <tr key={label}>
                    <th scope="row">{label}</th>
                    {cases.map((c, i) => {
                      const cf = c.result.annualCashflows[0]?.cashFlow;
                      const irr = c.result.summaryMetrics.irrLeveraged;
                      const baseIrr = calculated.base.summaryMetrics.irrLeveraged;
                      return (
                        <td key={i}>
                          {row === 0
                            ? dollars(cf)
                            : row === 1
                              ? dollars(cf - calculated.base.annualCashflows[0].cashFlow)
                              : row === 2
                                ? rate(irr)
                                : irr == null || baseIrr == null
                                  ? 'Unavailable'
                                  : `${((irr - baseIrr) * 100).toFixed(4)} pp`}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {(['equity', 'cashFlow'] as const).map((metric) => (
            <section key={metric}>
              <h3>{metric === 'equity' ? 'Equity growth by scenario' : 'Cash flow by scenario'}</h3>
              <LineChart
                label={
                  metric === 'equity'
                    ? 'Year-end equity before selling costs'
                    : 'Annual operating cash flow'
                }
                years={Array.from({ length: years }, (_, i) => i + 1)}
                series={cases.map((c, i) => ({
                  label: c.name,
                  color: ['#1e3a8a', '#a4603d', '#64748b'][i % 3],
                  values: Array.from({ length: years }, (_, j) =>
                    metric === 'equity'
                      ? (c.result.equityTimeline.find((r) => r.month === (j + 1) * 12)?.equity ?? 0)
                      : (c.result.annualCashflows[j]?.cashFlow ?? 0),
                  ),
                }))}
              />
              <div
                className={styles.table}
                role="region"
                tabIndex={0}
                aria-label={`${metric} exact values`}
              >
                <table>
                  <caption>
                    Exact annual {metric === 'equity' ? 'equity' : 'cash flow'} - shorter holds
                    remain unavailable
                  </caption>
                  <thead>
                    <tr>
                      <th>Year</th>
                      {cases.map((c, i) => (
                        <th key={i}>{c.name}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: years }, (_, j) => (
                      <tr key={j}>
                        <th scope="row">{j + 1}</th>
                        {cases.map((c, i) => (
                          <td key={i}>
                            {dollars(
                              metric === 'equity'
                                ? c.result.equityTimeline.find((r) => r.month === (j + 1) * 12)
                                    ?.equity
                                : c.result.annualCashflows[j]?.cashFlow,
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}
        </>
      )}
    </section>
  );
}
