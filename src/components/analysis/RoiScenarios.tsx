'use client';
import { useMemo } from 'react';
import { calculatePayload, type AnalysisPayload, type ValidationIssue } from '@/lib/analysis';
import { applyScenarios, type ScenarioDraft } from '@/lib/analysis/scenarios';
import { dollars, rate } from '@/lib/analysis/projections';
import { groups, readPath, taxFields } from './fields';
import { MoreDetail } from './RoiChart';
import { ScenarioCharts } from './RoiScenarioCharts';
import styles from './analysis.module.css';
import scenarioStyles from './scenarios.module.css';

export function CalculationAssumptions({ options }: { options: AnalysisPayload['options'] }) {
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

export const inputFields = groups
  .flatMap((g) => g.fields)
  .filter((f) => f.path.startsWith('input.'));
export const overrideLabel = (path: string) =>
  inputFields.find((f) => f.path === `input.${path}`)?.label ?? path;

/**
 * Saved cases compared on Compare: charts first, exact figures one click away, then the
 * overrides side by side. Cases are created and edited in the shared What if panel; a
 * temporary what-if joins the comparison as an unsaved column while it is active.
 */
export function CaseComparison({
  drafts,
  snapshot,
  stale,
  errors,
  base,
  temporary,
  onOpenWhatIf,
}: {
  drafts: ScenarioDraft[];
  snapshot: AnalysisPayload | null;
  stale: boolean;
  errors: ValidationIssue[];
  base: AnalysisPayload;
  /** The active temporary what-if, compared but never saved. */
  temporary?: ScenarioDraft | null;
  onOpenWhatIf: () => void;
}) {
  const shownDrafts = useMemo(
    () => (temporary ? [...drafts, temporary] : drafts),
    [drafts, temporary],
  );
  const calculated = useMemo(() => {
    try {
      if (!snapshot) return null;
      const withTemporary = temporary
        ? {
            ...snapshot,
            scenarios: [...snapshot.scenarios, ...applyScenarios(snapshot, [temporary]).scenarios],
          }
        : snapshot;
      return calculatePayload({ ...withTemporary, benchmarks: [] });
    } catch {
      // An invalid temporary case never hides the saved comparison.
      try {
        return snapshot ? calculatePayload({ ...snapshot, benchmarks: [] }) : null;
      } catch {
        return null;
      }
    }
  }, [snapshot, temporary]);
  const cases = calculated
    ? [{ name: 'Base Case', result: calculated.base }, ...calculated.scenarios]
    : [];
  // Exact tables run to the longest hold; shorter holds read "Unavailable".
  const years = Math.max(
    1,
    Math.min(50, Math.max(...cases.map((c) => c.result.annualCashflows.length))),
  );
  const scenarioError = errors.some((e) => e.path.startsWith('scenarios.'));
  return (
    <section
      id="roi-saved-cases"
      className={scenarioStyles.scenarios}
      aria-label="Saved cases comparison"
      tabIndex={-1}
    >
      {stale || !calculated ? (
        <section
          className={`${styles.card} ${scenarioStyles.paused}`}
          aria-label="Scenario results"
        >
          <h3>{scenarioError ? 'Case comparison paused' : 'No case comparison yet'}</h3>
          <p role="status">
            {scenarioError
              ? 'A saved case has an invalid assumption. Correct the highlighted field in What if; your entries are kept and results return automatically.'
              : snapshot
                ? 'Case results are out of date. Correct the assumptions flagged above to compare your current edits.'
                : 'No projection yet. Complete or correct the base assumptions flagged above to compare cases.'}
          </p>
        </section>
      ) : (
        <>
          <ScenarioCharts
            cases={cases.map((c, i) => ({
              id: i === 0 ? 'base' : (shownDrafts[i - 1]?.id ?? String(i)),
              name: c.name,
              result: c.result,
            }))}
            drafts={shownDrafts}
            baseInput={base.input}
            label={overrideLabel}
            onOpenWhatIf={onOpenWhatIf}
          />
          <section
            className={`${styles.card} ${scenarioStyles.exact}`}
            aria-label="Exact scenario figures"
          >
            <h3>Exact figures</h3>
            <MoreDetail summary="Year 1 cash flow and IRR by case, to the cent">
              <div
                className={styles.table}
                tabIndex={0}
                role="region"
                aria-label="Scenario metrics"
              >
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
            </MoreDetail>
            {(['equity', 'cashFlow'] as const).map((metric) => (
              <MoreDetail
                key={metric}
                summary={`Exact ${metric === 'equity' ? 'equity' : 'cash flow'} by case · years 1–${years}`}
              >
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
              </MoreDetail>
            ))}
            {shownDrafts.length > 0 && (
              <MoreDetail summary="Overrides side by side">
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
                        {shownDrafts.map((d) => (
                          <th key={d.id}>{d.name || 'Unnamed case'}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {inputFields
                        .filter((f) => shownDrafts.some((d) => d.values[f.path.slice(6)]?.trim()))
                        .map((f) => (
                          <tr key={f.path}>
                            <th scope="row">{f.label}</th>
                            <td>{String(readPath(base, f.path) ?? 'Not set')}</td>
                            {shownDrafts.map((d) => (
                              <td key={d.id}>
                                {d.values[f.path.slice(6)]?.trim() || 'Inherit base'}
                              </td>
                            ))}
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </MoreDetail>
            )}
          </section>
        </>
      )}
    </section>
  );
}
