'use client';
import { useMemo, useState } from 'react';
import { calculatePayload, type AnalysisPayload, type ValidationIssue } from '@/lib/analysis';
import { scenarioExamples, type ScenarioDraft } from '@/lib/analysis/scenarios';
import { dollars, rate } from '@/lib/analysis/projections';
import { groups, readPath, taxFields } from './fields';
import { ScenarioCharts } from './RoiScenarioCharts';
import styles from './analysis.module.css';
import scenarioStyles from './scenarios.module.css';

function CalculationAssumptions({ options }: { options: AnalysisPayload['options'] }) {
  return (
    <dl>
      <dt>Projection start date</dt>
      <dd>{options.startDate ?? 'Not set'}</dd>
      <dt>Discount rate</dt>
      <dd>{options.discountRate == null ? 'Not set' : rate(options.discountRate)}</dd>
      <dt>Tax estimate</dt>
      <dd>{options.tax ? 'Explicit tax assumptions' : 'Before tax'}</dd>
      {options.tax &&
        taxFields.map((f) => {
          const value = readPath({ options }, f.path);
          return (
            <div key={f.path}>
              <dt>{f.label}</dt>
              <dd>{typeof value === 'boolean' ? (value ? 'Yes' : 'No') : String(value)}</dd>
            </div>
          );
        })}
    </dl>
  );
}

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
  const [exampleName, setExampleName] = useState('');
  const example = scenarioExamples.find((candidate) => candidate.name === exampleName);
  const calculated = useMemo(() => {
    try {
      return snapshot ? calculatePayload({ ...snapshot, benchmarks: [] }) : null;
    } catch {
      return null;
    }
  }, [snapshot]);
  const cases = calculated
    ? [{ name: 'Base Case', result: calculated.base }, ...calculated.scenarios]
    : [];
  // Exact tables run to the longest hold; shorter holds read "Unavailable".
  const years = Math.max(
    1,
    Math.min(50, Math.max(...cases.map((c) => c.result.annualCashflows.length))),
  );
  const fields = groups.flatMap((g) => g.fields).filter((f) => f.path.startsWith('input.'));
  function update(index: number, change: Partial<ScenarioDraft>) {
    onChange(drafts.map((d, i) => (i === index ? { ...d, ...change } : d)));
  }
  function add(name: string, values: Record<string, string>) {
    const index = drafts.length;
    onChange([...drafts, { id: crypto.randomUUID(), name, values: { ...values } }]);
    setTimeout(() => document.getElementById(`scenarios.${index}.name`)?.focus(), 0);
  }
  return (
    <section className={scenarioStyles.scenarios}>
      <h2>Scenario comparison</h2>
      <p>
        Custom cases inherit unspecified base assumptions. Clearing an override restores
        inheritance. Fixed dollar amounts take precedence over percentages. The saved base stays
        separate.
      </p>
      <section className={styles.card} aria-label="Scenario examples">
        <h3>Explore an example</h3>
        <p>
          Illustrative assumptions, not promised outcomes. Choose an example to review its exact
          overrides before adding an editable scenario. Save draft or Save ready to keep it for this
          property.
        </p>
        <label className={styles.field}>
          Example scenario
          <select
            value={exampleName}
            disabled={saving}
            onChange={(event) => setExampleName(event.target.value)}
          >
            <option value="">Choose an example</option>
            {scenarioExamples.map((candidate) => (
              <option key={candidate.name}>{candidate.name}</option>
            ))}
          </select>
        </label>
        {example && (
          <>
            <h4>{example.name} overrides</h4>
            <dl>
              {Object.entries(example.values).map(([path, value]) => (
                <div key={path}>
                  <dt>{fields.find((f) => f.path === `input.${path}`)?.label}</dt>
                  <dd>
                    {value}% (base: {String(readPath(base.input, path) ?? 'Not set')}%)
                  </dd>
                </div>
              ))}
            </dl>
            <p>
              Every other assumption inherits the current base, including purchase, financing,
              holding period, fixed dollar amounts and calculation options. The base stays
              unchanged.
            </p>
            {base.input.expenses?.maintenance !== undefined &&
              'expenses.maintenancePercent' in example.values && (
                <p className={styles.notice}>
                  Inherited fixed maintenance of {dollars(base.input.expenses.maintenance)} per year
                  takes precedence. This example&apos;s maintenance percentage will not change that
                  amount, including when the fixed amount is zero.
                </p>
              )}
            <details>
              <summary>Review inherited assumptions</summary>
              <dl>
                {fields
                  .filter((f) => !(f.path.slice(6) in example.values))
                  .map((f) => (
                    <div key={f.path}>
                      <dt>{f.label}</dt>
                      <dd>{String(readPath(base, f.path) ?? 'Not set')}</dd>
                    </div>
                  ))}
              </dl>
              <CalculationAssumptions options={base.options} />
            </details>
            <button
              type="button"
              disabled={saving || drafts.length >= 20}
              onClick={() => add(example.name, example.values)}
            >
              Add {example.name} scenario
            </button>
          </>
        )}
      </section>
      <button
        type="button"
        disabled={saving || drafts.length >= 20}
        onClick={() => add(`Custom case ${drafts.length + 1}`, {})}
      >
        Create scenario
      </button>
      <p>{drafts.length} of 20 scenarios</p>
      {drafts.map((d, index) => (
        <details open key={d.id} className={styles.card}>
          <summary>{d.name || 'Unnamed scenario'}</summary>
          <div
            id={`scenarios.${index}`}
            tabIndex={-1}
            role="region"
            aria-label={`${d.name || 'Unnamed scenario'}: review scenario assumptions`}
          >
            {errors
              .filter(
                (e) => e.path === `scenarios.${index}` || e.path.startsWith(`scenarios.${index}.`),
              )
              .map((e, errorIndex) => (
                <p role="alert" id={`${e.path}-error`} key={errorIndex}>
                  {e.message}
                </p>
              ))}
            {errors.some((e) => e.path === `scenarios.${index}`) && (
              <p>
                Review this scenario&apos;s growth rates, holding period and amounts below,
                including inherited values. Correct the assumptions and recalculate. Your entries
                are kept.
              </p>
            )}
          </div>
          <fieldset disabled={saving}>
            <label className={styles.field}>
              Scenario name
              <input
                id={`scenarios.${index}.name`}
                value={d.name}
                maxLength={200}
                aria-invalid={errors.some((e) => e.path === `scenarios.${index}.name`)}
                aria-describedby={
                  errors.some((e) => e.path === `scenarios.${index}.name`)
                    ? `scenarios.${index}.name-error`
                    : undefined
                }
                onChange={(e) => update(index, { name: e.target.value })}
              />
            </label>
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
                const invalid = errors.some((e) => e.path === id);
                return (
                  <label className={styles.field} key={path}>
                    {f.label} - Base: {String(readPath(base, f.path) ?? 'Not set')}
                    {f.kind === 'select' ? (
                      <select
                        id={id}
                        aria-invalid={invalid}
                        aria-describedby={invalid ? `${id}-error` : undefined}
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
                        aria-invalid={invalid}
                        aria-describedby={invalid ? `${id}-error` : undefined}
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
                <CalculationAssumptions options={d.options} />
                <p>
                  These saved assumptions apply only to this scenario. Use base calculation options
                  to inherit the dates, discount rate and tax assumptions from Summary.
                </p>
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
          <ScenarioCharts
            cases={cases.map((c, i) => ({
              id: i === 0 ? 'base' : (drafts[i - 1]?.id ?? String(i)),
              name: c.name,
              result: c.result,
            }))}
            drafts={drafts}
            baseInput={base.input}
            label={(path) => fields.find((f) => f.path === `input.${path}`)?.label ?? path}
            onAddExample={add}
            disabled={saving}
          />
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
            <details key={metric} className={styles.card}>
              <summary>
                Exact {metric === 'equity' ? 'equity' : 'cash flow'} by scenario · years 1–{years}
              </summary>
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
            </details>
          ))}
        </>
      )}
    </section>
  );
}
