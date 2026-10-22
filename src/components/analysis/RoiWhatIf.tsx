'use client';
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AnalysisPayload, ValidationIssue } from '@/lib/analysis';
import type { ProjectionResult } from '@/lib/analysis/projections';
import { levers as leverRows, targetFixes } from '@/lib/analysis/deal-insights';
import { scenarioExamples, type ScenarioDraft } from '@/lib/analysis/scenarios';
import {
  activeOverrides,
  deltaTone,
  formatDelta,
  formatMetric,
  metricDeltas,
  presetValues,
  withLever,
  type MetricDelta,
  type MetricKind,
  type Simulation,
  type WhatIfMetricKey,
  type WhatIfState,
} from '@/lib/analysis/what-if';
import { wholeDollars } from '@/lib/analysis/chart-data';
import { dollars } from '@/lib/analysis/projections';
import { readPath } from './fields';
import { CalculationAssumptions, inputFields, overrideLabel } from './RoiScenarios';
import { ComboChart } from './RoiChart';
import w from './what-if.module.css';

/** The assumptions most what-ifs change; every other input sits under "More assumptions". */
const KEY_PATHS = [
  'income.monthlyRent',
  'income.vacancyRate',
  'income.annualRentGrowth',
  'financing.interestRate',
  'financing.downPaymentPercent',
  'purchase.purchasePrice',
  'expenses.maintenancePercent',
  'expenses.propertyManagementPercent',
  'expenses.annualExpenseGrowth',
  'appreciationExit.annualAppreciation',
  'appreciationExit.holdingPeriodYears',
];
const PANEL_METRICS: WhatIfMetricKey[] = [
  'monthlyCashFlow',
  'cashOnCash',
  'dscr',
  'irr',
  'finalEquity',
];
export const TRIGGER_ID = 'roi-whatif-trigger';
const MAX_CASES = 20;

const baseText = (base: AnalysisPayload, path: string) => {
  const v = readPath(base.input, path);
  return v === undefined || v === '' ? 'Not set' : String(v);
};

/** Signed change beside a metric: "+$83 vs baseline −$213". Screen readers hear both values. */
export function DeltaNote({
  kind,
  baseline,
  simulated,
  className,
}: {
  kind: MetricKind;
  baseline: number | null;
  simulated: number | null;
  className?: string;
}) {
  const delta = baseline == null || simulated == null ? null : simulated - baseline;
  return (
    <span className={`${w.delta} ${className ?? ''}`} data-tone={deltaTone(kind, delta)}>
      <b>{formatDelta(kind, delta)}</b> <span>vs baseline {formatMetric(kind, baseline)}</span>
    </span>
  );
}

/** The changed assumptions of the active case, as "Label: baseline → value" chips. */
export function ChangedAssumptions({
  values,
  base,
}: {
  values: Record<string, string>;
  base: AnalysisPayload;
}) {
  const changed = Object.entries(activeOverrides(values));
  if (!changed.length)
    return <p className={w.none}>No assumption changed · every value follows the baseline.</p>;
  return (
    <ul className={w.chips} aria-label="Changed assumptions">
      {changed.map(([path, raw]) => (
        <li key={path}>
          {overrideLabel(path).replace(/\s*\(.*\)\s*$/, '')}: {baseText(base, path)} → <b>{raw}</b>
        </li>
      ))}
    </ul>
  );
}

/**
 * Shown at the top of every analysis view while a what-if is active: the case, its changed
 * assumptions, and baseline, simulated value and signed change for the metrics this view
 * shows. `note` names the data in this view that the simulation does not touch.
 */
export function WhatIfStrip({
  name,
  saved,
  values,
  base,
  baseline,
  simulation,
  metrics,
  note,
  series,
  onEdit,
  onReset,
}: {
  name: string;
  saved: boolean;
  values: Record<string, string>;
  base: AnalysisPayload;
  baseline: ProjectionResult;
  simulation: Simulation;
  metrics: WhatIfMetricKey[];
  note?: ReactNode;
  /** Baseline and simulated lines for the active chart. */
  series?: 'equity' | 'cashFlow';
  onEdit: () => void;
  onReset: () => void;
}) {
  const rows = simulation.ok ? metricDeltas(baseline, simulation.result, metrics) : [];
  return (
    <section className={w.strip} aria-label="What if comparison">
      <div className={w.stripHead}>
        <div>
          <p className={w.eyebrow}>
            <span className={w.simBadge}>Simulated</span> What if
            {name === 'What if' ? '' : ` · ${name}`}
            {saved ? ' · saved case' : ' · temporary, not saved'}
          </p>
          <ChangedAssumptions values={values} base={base} />
        </div>
        <div className={w.stripActions}>
          <button type="button" onClick={onEdit}>
            Edit what if
          </button>
          <button type="button" onClick={onReset}>
            {saved ? 'Show baseline' : 'Reset to baseline'}
          </button>
        </div>
      </div>
      {simulation.ok ? (
        <>
          <DeltaTable rows={rows} />
          {series && (
            <SeriesChart baseline={baseline} simulated={simulation.result} metric={series} />
          )}
        </>
      ) : (
        <p className={w.paused} role="status">
          Simulation paused:{' '}
          {(simulation.errors[0]?.message ?? 'check the changed assumptions').replace(/\.$/, '')}.
          Figures below show the baseline.
        </p>
      )}
      {note && <p className={w.note}>{note}</p>}
    </section>
  );
}

function DeltaTable({ rows }: { rows: MetricDelta[] }) {
  return (
    <div
      className={w.tableWrap}
      role="region"
      tabIndex={0}
      aria-label="Baseline and simulated values"
    >
      <table className={w.table}>
        <thead>
          <tr>
            <th scope="col">Metric</th>
            <th scope="col">Baseline</th>
            <th scope="col">What if</th>
            <th scope="col">Change</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} data-changed={row.changed || undefined}>
              <th scope="row">{row.label}</th>
              <td>{formatMetric(row.kind, row.baseline)}</td>
              <td>
                <b>{formatMetric(row.kind, row.simulated)}</b>
              </td>
              <td data-tone={row.tone}>{formatDelta(row.kind, row.delta)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SeriesChart({
  baseline,
  simulated,
  metric,
}: {
  baseline: ProjectionResult;
  simulated: ProjectionResult;
  metric: 'equity' | 'cashFlow';
}) {
  const years = Math.max(baseline.annualCashflows.length, simulated.annualCashflows.length);
  const values = (r: ProjectionResult) =>
    Array.from({ length: years }, (_, i) =>
      metric === 'equity'
        ? (r.equityTimeline.find((e) => e.month === (i + 1) * 12)?.equity ?? null)
        : (r.annualCashflows[i]?.cashFlow ?? null),
    );
  return (
    <ComboChart
      label={`${metric === 'equity' ? 'Year-end equity' : 'Annual cash flow'}: baseline and what if`}
      years={Array.from({ length: years }, (_, i) => i + 1)}
      xFormat={(y) => `Y${y}`}
      height={180}
      series={[
        {
          label: 'Baseline',
          color: '#58677d',
          values: values(baseline),
          dashed: true,
          width: 2,
          dot: 0,
        },
        { label: 'What if', color: '#3e4fe5', values: values(simulated), width: 2.5, dot: 0 },
      ]}
    />
  );
}

/**
 * The one What if panel: case choice, presets and suggested changes, editable assumptions with
 * their baseline, the effect on key metrics, and Save as case / Reset / Exit. A side panel on
 * wide screens (the analysis stays visible beside it); a modal sheet on narrower screens.
 */
export function WhatIfPanel({
  open,
  modal,
  onClose,
  scopeLabel,
  state,
  onState,
  base,
  baselinePayload,
  baselineResult,
  simulation,
  drafts,
  onDrafts,
  errors,
  saving,
  busy = false,
  dirty,
  saveLabel,
  onSave,
  onExit,
}: {
  open: boolean;
  /** True on narrow screens: the panel is a modal sheet that traps focus. */
  modal: boolean;
  onClose: () => void;
  scopeLabel: string;
  state: WhatIfState;
  onState: (next: WhatIfState) => void;
  /** Baseline assumptions as entered (shown as each field's baseline). */
  base: AnalysisPayload;
  baselinePayload: AnalysisPayload | null;
  baselineResult: ProjectionResult | null;
  simulation: Simulation | null;
  drafts: ScenarioDraft[];
  onDrafts: (next: ScenarioDraft[]) => void;
  errors: ValidationIssue[];
  saving: boolean;
  /** True while a save request is in flight: saved-case edits wait so the reply cannot drop them. */
  busy?: boolean;
  dirty: boolean;
  saveLabel: string;
  onSave: () => void;
  onExit: () => void;
}) {
  const box = useRef<HTMLElement>(null);
  const titleId = useId();
  const savedIndex =
    state.source.kind === 'saved'
      ? drafts.findIndex((d) => d.id === (state.source as { id: string }).id)
      : -1;
  const saved = savedIndex >= 0 ? drafts[savedIndex] : null;
  const values = saved ? saved.values : state.values;
  const [more, setMore] = useState(false);

  useEffect(() => {
    if (!open) return;
    const panel = box.current;
    if (panel && !panel.contains(document.activeElement))
      panel.querySelector<HTMLElement>('h2')?.focus();
  }, [open]);
  useEffect(() => {
    if (!open || !modal) return;
    const contain = () => {
      if (box.current && !box.current.contains(document.activeElement))
        box.current.querySelector<HTMLElement>('h2')?.focus();
    };
    // A button that disables itself (Saving...) drops focus to the page; Escape still closes
    // the sheet and focus returns inside it.
    const escape = (event: KeyboardEvent) => {
      if (
        event.key !== 'Escape' ||
        box.current?.contains(document.activeElement) ||
        document.querySelector('[role="alertdialog"]')
      )
        return;
      onClose();
    };
    document.addEventListener('focusin', contain);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('focusin', contain);
      document.removeEventListener('keydown', escape);
    };
  }, [open, modal, onClose]);
  useEffect(() => {
    if (open && modal && !saving && box.current && !box.current.contains(document.activeElement))
      box.current.querySelector<HTMLElement>('h2')?.focus();
  }, [open, modal, saving]);

  const suggestions = useMemo(() => {
    if (!baselinePayload || !baselineResult) return { levers: [], targets: [] };
    try {
      return {
        levers: leverRows(baselinePayload, baselineResult),
        targets: targetFixes(baselinePayload, baselineResult),
      };
    } catch {
      return { levers: [], targets: [] };
    }
  }, [baselinePayload, baselineResult]);

  if (!open) return null;

  const pathError = (path: string) =>
    saved
      ? errors.find((e) => e.path === `scenarios.${savedIndex}.overrides.${path}`)
      : simulation && !simulation.ok
        ? simulation.errors.find((e) => e.path === path)
        : undefined;
  const caseErrors = saved
    ? errors.filter(
        (e) =>
          e.path === `scenarios.${savedIndex}` ||
          e.path === `scenarios.${savedIndex}.name` ||
          (e.path.startsWith(`scenarios.${savedIndex}.`) && !e.path.includes('.overrides.')),
      )
    : simulation && !simulation.ok
      ? simulation.errors.filter((e) => !e.path)
      : [];
  // Saved-case entries are part of the analysis being saved; they are locked until the reply.
  const caseLocked = !!saved && busy;
  const setValues = (next: Record<string, string>, name?: string) => {
    if (caseLocked) return;
    if (saved) onDrafts(drafts.map((d, i) => (i === savedIndex ? { ...d, values: next } : d)));
    else onState({ ...state, values: next, ...(name ? { name } : {}) });
  };
  const fieldId = (path: string) =>
    saved ? `scenarios.${savedIndex}.overrides.${path}` : `whatif.${path}`;
  const moreFields = inputFields.filter((f) => !KEY_PATHS.includes(f.path.slice(6)));
  const moreOpen =
    more || moreFields.some((f) => values[f.path.slice(6)]?.trim() || pathError(f.path.slice(6)));
  // A percentage override cannot move an inherited fixed annual amount; say so plainly.
  const precedence = (
    [
      ['maintenancePercent', 'maintenance', 'maintenance'],
      ['capexPercent', 'capex', 'capital reserve'],
      ['propertyManagementPercent', 'propertyManagement', 'management'],
    ] as const
  ).flatMap(([percent, fixed, name]) => {
    const amount = base.input.expenses?.[fixed];
    return values[`expenses.${percent}`]?.trim() &&
      !values[`expenses.${fixed}`]?.trim() &&
      amount !== undefined
      ? [[percent, amount, name] as const]
      : [];
  });
  const rows =
    simulation?.ok && baselineResult
      ? metricDeltas(baselineResult, simulation.result, PANEL_METRICS)
      : [];

  function field(path: string) {
    const spec = inputFields.find((f) => f.path === `input.${path}`);
    if (!spec) return null;
    const id = fieldId(path);
    const error = pathError(path);
    const set = !!values[path]?.trim();
    return (
      <label key={path} className={w.field} data-overridden={set || undefined}>
        <span>
          {spec.label}
          <small> · Baseline {baseText(base, path)}</small>
        </span>
        {spec.kind === 'select' ? (
          <select
            id={id}
            value={values[path] ?? ''}
            disabled={caseLocked}
            aria-invalid={!!error}
            aria-describedby={error ? `${id}-error` : undefined}
            onChange={(e) => setValues({ ...values, [path]: e.target.value })}
          >
            <option value="">Baseline</option>
            {spec.choices?.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        ) : (
          <input
            id={id}
            type={spec.kind === 'date' ? 'date' : 'text'}
            inputMode={spec.kind === 'date' ? undefined : 'decimal'}
            value={values[path] ?? ''}
            disabled={caseLocked}
            placeholder={`Baseline ${baseText(base, path)}`}
            aria-invalid={!!error}
            aria-describedby={error ? `${id}-error` : undefined}
            onChange={(e) => setValues({ ...values, [path]: e.target.value })}
          />
        )}
        {error && (
          <small id={`${id}-error`} className={w.error}>
            {error.message}
          </small>
        )}
      </label>
    );
  }

  function saveAsCase() {
    const index = drafts.length;
    const id = crypto.randomUUID();
    const name = state.name === 'What if' ? `Case ${index + 1}` : state.name;
    onDrafts([...drafts, { id, name, values: { ...activeOverrides(state.values) } }]);
    onState({ ...state, source: { kind: 'saved', id }, values: {}, name: 'What if' });
    setTimeout(() => {
      const input = document.getElementById(`scenarios.${index}.name`) as HTMLInputElement | null;
      input?.focus();
      input?.select();
    }, 0);
  }

  const panel = (
    <aside
      ref={box}
      className={`${w.panel} ${modal ? w.sheet : ''}`}
      role="dialog"
      aria-modal={modal || undefined}
      aria-labelledby={titleId}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          onClose();
        }
        if (modal && event.key === 'Tab' && box.current) {
          const items = Array.from(
            box.current.querySelectorAll<HTMLElement>(
              'button:not(:disabled), input:not(:disabled), select:not(:disabled), summary, [tabindex="0"]',
            ),
          ).filter((el) => !el.closest('details:not([open]) > :not(summary)'));
          const i = items.indexOf(document.activeElement as HTMLElement);
          if (event.shiftKey && i <= 0) {
            event.preventDefault();
            items.at(-1)?.focus();
          } else if (!event.shiftKey && i === items.length - 1) {
            event.preventDefault();
            items[0]?.focus();
          }
        }
      }}
    >
      <header className={w.head}>
        <div>
          <h2 id={titleId} tabIndex={-1}>
            What if
          </h2>
          <p className={w.scope}>
            {scopeLabel}
            {state.context ? ` · ${state.context}` : ''}
          </p>
        </div>
        <button type="button" className={w.close} aria-label="Close What if" onClick={onClose}>
          ×
        </button>
      </header>
      <div className={w.body}>
        <p className={w.lead}>
          Temporary. Saved assumptions and recorded rent, lease, payment, expense and market-rent
          records stay unchanged.
        </p>
        <label className={w.field}>
          <span>Case</span>
          <select
            id="whatif-case"
            value={saved ? saved.id : 'temporary'}
            onChange={(e) =>
              onState({
                ...state,
                source:
                  e.target.value === 'temporary'
                    ? { kind: 'temporary' }
                    : { kind: 'saved', id: e.target.value },
              })
            }
          >
            <option value="temporary">
              {state.name === 'What if' ? 'Temporary what if' : state.name} · not saved
            </option>
            {drafts.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name || 'Unnamed case'} · saved case
              </option>
            ))}
          </select>
        </label>

        {saved ? (
          <div className={w.caseBox}>
            <div
              id={`scenarios.${savedIndex}`}
              tabIndex={-1}
              role="region"
              aria-label={`${saved.name || 'Unnamed case'}: case assumptions`}
            >
              {caseErrors.map((e, i) => (
                <p role="alert" className={w.error} id={`${e.path}-error`} key={i}>
                  {e.message}
                </p>
              ))}
            </div>
            <div className={w.nameRow}>
              <label className={w.field}>
                <span>Case name</span>
                <input
                  id={`scenarios.${savedIndex}.name`}
                  value={saved.name}
                  maxLength={200}
                  disabled={saving}
                  aria-invalid={errors.some((e) => e.path === `scenarios.${savedIndex}.name`)}
                  aria-describedby={
                    errors.some((e) => e.path === `scenarios.${savedIndex}.name`)
                      ? `scenarios.${savedIndex}.name-error`
                      : undefined
                  }
                  onChange={(e) =>
                    onDrafts(
                      drafts.map((d, i) => (i === savedIndex ? { ...d, name: e.target.value } : d)),
                    )
                  }
                />
              </label>
              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  onDrafts(drafts.filter((_, i) => i !== savedIndex));
                  onState({ ...state, source: { kind: 'temporary' } });
                  setTimeout(() => document.getElementById('whatif-case')?.focus(), 0);
                }}
              >
                Remove {saved.name || 'case'}
              </button>
            </div>
            <p className={w.hint}>
              Blank fields inherit the baseline. Edits to a saved case are kept with the analysis
              when you save it.
            </p>
            {caseLocked && (
              <p className={w.hint} role="status">
                Saving… this case can be edited again when the save finishes.
              </p>
            )}
          </div>
        ) : (
          <>
            <section className={w.section} aria-labelledby={`${titleId}-start`}>
              <h3 id={`${titleId}-start`}>Start from</h3>
              <div className={w.pills}>
                {scenarioExamples.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    aria-pressed={state.name === preset.name}
                    onClick={() =>
                      onState({ ...state, values: presetValues(preset.name)!, name: preset.name })
                    }
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
              <p className={w.hint}>Illustrative presets, not promised outcomes.</p>
            </section>
            {!!suggestions.levers.length && (
              <section className={w.section} aria-labelledby={`${titleId}-suggest`}>
                <h3 id={`${titleId}-suggest`}>Suggested changes</h3>
                <ul className={w.suggestions}>
                  {suggestions.levers.map((lever) => (
                    <li key={lever.key}>
                      <button
                        type="button"
                        disabled={lever.value == null}
                        onClick={() =>
                          baselinePayload &&
                          setValues(withLever(baselinePayload.input, state.values, lever.key))
                        }
                      >
                        <span>
                          {lever.name} <small>{lever.change}</small>
                        </span>
                        <b>
                          {lever.value == null
                            ? 'Unavailable'
                            : `${lever.value >= 0 ? '+' : '−'}${wholeDollars(Math.abs(lever.value))}/yr`}
                        </b>
                      </button>
                    </li>
                  ))}
                  {suggestions.targets.map((target) => (
                    <li key={target.lever}>
                      <button
                        type="button"
                        onClick={() =>
                          setValues({
                            ...state.values,
                            [target.lever === 'Rent'
                              ? 'income.monthlyRent'
                              : 'financing.interestRate']: String(target.target),
                          })
                        }
                      >
                        <span>
                          {target.lever === 'Rent' ? 'Rent' : 'Interest rate'}{' '}
                          {target.lever === 'Rent'
                            ? wholeDollars(target.target)
                            : `${target.target.toFixed(2)}%`}
                          <small> to reach {target.outcome}</small>
                        </span>
                        <b>Target</b>
                      </button>
                    </li>
                  ))}
                </ul>
                <p className={w.hint}>Each adds to your what-if; Year 1 effect vs baseline.</p>
              </section>
            )}
          </>
        )}

        <section className={w.section} aria-labelledby={`${titleId}-fields`}>
          <h3 id={`${titleId}-fields`}>Assumptions</h3>
          {precedence.map(([key, amount, name]) => (
            <p key={key} className={w.paused}>
              Fixed {name} of {dollars(amount)} per year takes precedence. This {name} percentage
              will not change that amount, including when the fixed amount is zero.
            </p>
          ))}
          <div className={w.fields}>{KEY_PATHS.map(field)}</div>
          <details
            className={w.more}
            open={moreOpen}
            onToggle={(e) => setMore((e.target as HTMLDetailsElement).open)}
          >
            <summary>More assumptions</summary>
            <div className={w.fields}>{moreFields.map((f) => field(f.path.slice(6)))}</div>
          </details>
          {saved?.options && (
            <details className={w.more}>
              <summary>Explicit scenario calculation options</summary>
              <CalculationAssumptions options={saved.options} />
              <p className={w.hint}>
                These saved assumptions apply only to this case. Use base calculation options to
                inherit the dates, discount rate and tax assumptions from the analysis.
              </p>
              <button
                type="button"
                disabled={caseLocked}
                onClick={() =>
                  onDrafts(
                    drafts.map((d, i) => (i === savedIndex ? { ...d, options: undefined } : d)),
                  )
                }
              >
                Use base calculation options
              </button>
            </details>
          )}
        </section>

        <section className={w.section} aria-labelledby={`${titleId}-effect`} aria-live="polite">
          <h3 id={`${titleId}-effect`}>Effect</h3>
          {!baselineResult ? (
            <p className={w.paused}>
              Results paused until the flagged entries are corrected. Nothing is estimated for
              missing or invalid inputs.
            </p>
          ) : !simulation ? null : simulation.ok ? (
            <ul className={w.effects}>
              {rows.map((row) => (
                <li key={row.key} data-changed={row.changed || undefined}>
                  <span>{row.label}</span>
                  <b>{formatMetric(row.kind, row.simulated)}</b>
                  <DeltaNote kind={row.kind} baseline={row.baseline} simulated={row.simulated} />
                </li>
              ))}
            </ul>
          ) : (
            <p className={w.paused} role="status">
              Simulation paused. Correct the highlighted entry; your entries are kept and the
              analysis keeps showing the baseline.
            </p>
          )}
        </section>
      </div>
      <footer className={w.foot}>
        {!saved && (
          <button
            type="button"
            className={w.primary}
            disabled={saving || drafts.length >= MAX_CASES}
            onClick={saveAsCase}
          >
            Save as case
          </button>
        )}
        {dirty && (
          <button type="button" disabled={saving} onClick={onSave}>
            {saving ? 'Saving...' : saveLabel}
          </button>
        )}
        {!saved && (
          <button
            type="button"
            disabled={!Object.keys(activeOverrides(state.values)).length}
            onClick={() => onState({ ...state, values: {}, name: 'What if', context: undefined })}
          >
            Reset to baseline
          </button>
        )}
        <button type="button" onClick={onExit}>
          Exit what if
        </button>
        <p className={w.hint}>
          {drafts.length} of {MAX_CASES} saved cases · compare them on Compare.
        </p>
      </footer>
    </aside>
  );
  return modal ? (
    <div className={w.backdrop} onClick={(e) => e.target === e.currentTarget && onClose()}>
      {panel}
    </div>
  ) : (
    panel
  );
}
