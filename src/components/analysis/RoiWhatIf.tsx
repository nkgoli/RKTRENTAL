'use client';
import { useEffect, useId, useMemo, useRef } from 'react';
import type { AnalysisPayload } from '@/lib/analysis';
import type { ProjectionResult } from '@/lib/analysis/projections';
import { targetFixes } from '@/lib/analysis/deal-insights';
import { scenarioExamples, type ScenarioDraft } from '@/lib/analysis/scenarios';
import {
  activeOverrides,
  deltaTone,
  formatDelta,
  formatMetric,
  formatSlider,
  metricDeltas,
  presetValues,
  sliders,
  withSlider,
  type MetricKind,
  type Simulation,
  type Slider,
  type WhatIfMetricKey,
  type WhatIfState,
} from '@/lib/analysis/what-if';
import { wholeDollars } from '@/lib/analysis/chart-data';
import { dollars } from '@/lib/analysis/projections';
import { overrideLabel } from './RoiScenarios';
import w from './what-if.module.css';

const PANEL_METRICS: WhatIfMetricKey[] = [
  'monthlyCashFlow',
  'cashOnCash',
  'dscr',
  'irr',
  'finalEquity',
];
export const TRIGGER_ID = 'roi-whatif-trigger';

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

/**
 * One slim line under the view tabs while a what-if is active: what is simulated, or that it is
 * paused (so baseline figures are not read as simulated), with Edit and Reset.
 * The existing charts and metrics show the simulated values themselves.
 */
export function WhatIfStatus({
  name,
  changes,
  simulation,
  onEdit,
  onReset,
}: {
  name: string;
  changes: number;
  simulation: Simulation;
  onEdit: () => void;
  onReset: () => void;
}) {
  return (
    <section
      className={w.status}
      aria-label="Active what if"
      data-paused={!simulation.ok || undefined}
    >
      <p role="status">
        <span className={w.simBadge}>{simulation.ok ? 'Simulated' : 'Paused'}</span>
        <b>What if{name === 'What if' ? '' : ` · ${name}`}</b>
        {simulation.ok
          ? ` · ${changes} ${changes === 1 ? 'change' : 'changes'}, not saved`
          : ` · ${(simulation.errors[0]?.message ?? 'Check the changed assumptions').replace(/\.$/, '')}. Figures show the baseline.`}
      </p>
      <div className={w.statusActions}>
        <button type="button" onClick={onEdit}>
          Edit what if
        </button>
        <button type="button" onClick={onReset}>
          Reset to baseline
        </button>
      </div>
    </section>
  );
}

/**
 * The What if panel: a starting point and live sliders under Suggested changes. Every slider
 * movement updates the views at once; nothing here is saved, and saved cases are only copied.
 * A side panel on wide screens (the analysis stays visible beside it); a modal sheet on
 * narrower screens.
 */
export function WhatIfPanel({
  open,
  modal,
  onClose,
  scopeLabel,
  state,
  onState,
  baselinePayload,
  baselineResult,
  simulation,
  cases,
  onExit,
  onManageCases,
}: {
  open: boolean;
  /** True on narrow screens: the panel is a modal sheet that traps focus. */
  modal: boolean;
  onClose: () => void;
  scopeLabel: string;
  state: WhatIfState;
  onState: (next: WhatIfState) => void;
  baselinePayload: AnalysisPayload | null;
  baselineResult: ProjectionResult | null;
  simulation: Simulation | null;
  /** Saved cases, offered as starting points only; they are never edited here. */
  cases: ScenarioDraft[];
  onExit: () => void;
  onManageCases: () => void;
}) {
  const box = useRef<HTMLElement>(null);
  const titleId = useId();
  const values = state.values;

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

  const targets = useMemo(() => {
    if (!baselinePayload || !baselineResult) return [];
    try {
      return targetFixes(baselinePayload, baselineResult);
    } catch {
      return [];
    }
  }, [baselinePayload, baselineResult]);
  const rows = useMemo(
    () => (baselinePayload ? sliders(baselinePayload.input, values) : []),
    [baselinePayload, values],
  );

  if (!open) return null;

  const pathError = (path: string) =>
    simulation && !simulation.ok ? simulation.errors.find((e) => e.path === path) : undefined;
  const generalErrors =
    simulation && !simulation.ok ? simulation.errors.filter((e) => !e.path) : [];
  const shownPaths = new Set(rows.map((r) => r.path));
  // Overrides from a preset or a copied case that have no slider stay applied; list them.
  const others = Object.keys(activeOverrides(values)).filter((p) => !shownPaths.has(p));
  // A percentage cannot move a fixed annual amount the engine uses; say so plainly.
  const precedence = (
    [
      ['maintenancePercent', 'maintenance', 'maintenance'],
      ['capexPercent', 'capex', 'capital reserve'],
      ['propertyManagementPercent', 'propertyManagement', 'management'],
    ] as const
  ).flatMap(([percent, fixed, name]) => {
    const typed = values[`expenses.${fixed}`]?.trim();
    const amount = typed ? Number(typed) : baselinePayload?.input.expenses?.[fixed];
    return values[`expenses.${percent}`]?.trim() && amount !== undefined
      ? [[percent, amount, name] as const]
      : [];
  });
  const effects =
    simulation?.ok && baselineResult
      ? metricDeltas(baselineResult, simulation.result, PANEL_METRICS)
      : [];
  const target = (path: string) =>
    targets.find(
      (t) => (t.lever === 'Rent' ? 'income.monthlyRent' : 'financing.interestRate') === path,
    );

  function start(choice: string) {
    const savedCase = choice.startsWith('case:')
      ? cases.find((c) => `case:${c.id}` === choice)
      : undefined;
    const preset = choice.startsWith('preset:') ? choice.slice(7) : null;
    onState({
      scope: state.scope,
      ...(state.context ? { context: state.context } : {}),
      values: savedCase
        ? { ...activeOverrides(savedCase.values) }
        : preset
          ? (presetValues(preset) ?? {})
          : {},
      name: savedCase ? `${savedCase.name || 'Unnamed case'} (copy)` : (preset ?? 'What if'),
      ...(choice ? { start: choice } : {}),
      ...(savedCase?.options ? { options: savedCase.options } : {}),
    });
  }

  function slider(row: Slider) {
    const id = `whatif.${row.path}`;
    const error = pathError(row.path);
    const changed = !!values[row.path]?.trim();
    const shown = formatSlider(row.unit, row.value);
    const hint = target(row.path);
    return (
      <div key={row.path} className={w.slider} data-overridden={changed || undefined}>
        <div className={w.sliderHead}>
          <label htmlFor={id}>
            {row.label}
            {row.basis && <small> · % {row.basis}</small>}
          </label>
          <output htmlFor={id} aria-hidden="true">
            {shown}
          </output>
        </div>
        <input
          id={id}
          type="range"
          min={row.min}
          max={row.max}
          step={row.step}
          value={row.value}
          aria-valuetext={`${shown}${row.basis ? ` ${row.basis}` : ''}${changed ? '' : ', baseline'}`}
          aria-invalid={!!error}
          aria-describedby={`${id}-note${error ? ` ${id}-error` : ''}`}
          onChange={(e) =>
            onState({ ...state, values: withSlider(values, row, Number(e.target.value)) })
          }
        />
        <small id={`${id}-note`} className={w.sliderNote}>
          {row.baseline == null
            ? 'Not set in the baseline'
            : changed
              ? `Baseline ${formatSlider(row.unit, row.baseline)}`
              : 'Baseline'}
          {row.note ? ` · ${row.note}` : ''}
          {hint
            ? ` · ${hint.lever === 'Rent' ? wholeDollars(hint.target) : `${hint.target.toFixed(2)}%`} reaches ${hint.outcome}`
            : ''}
        </small>
        {error && (
          <small id={`${id}-error`} className={w.error}>
            {error.message}
          </small>
        )}
      </div>
    );
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
          Temporary. Saved assumptions, saved cases and recorded rent, lease, payment, expense and
          market-rent records stay unchanged.
        </p>
        <label className={w.field}>
          <span>Start from</span>
          <select
            id="whatif-start"
            value={state.start ?? ''}
            onChange={(e) => start(e.target.value)}
          >
            <option value="">
              {state.start || state.name === 'What if' ? 'Baseline' : state.name}
            </option>
            <optgroup label="Illustrative presets">
              {scenarioExamples.map((preset) => (
                <option key={preset.name} value={`preset:${preset.name}`}>
                  {preset.name}
                </option>
              ))}
            </optgroup>
            {cases.length > 0 && (
              <optgroup label="Saved cases (copied, not changed)">
                {cases.map((c) => (
                  <option key={c.id} value={`case:${c.id}`}>
                    {c.name || 'Unnamed case'}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </label>

        <section className={w.section} aria-labelledby={`${titleId}-suggest`}>
          <h3 id={`${titleId}-suggest`}>Suggested changes</h3>
          {!baselineResult || !baselinePayload ? (
            <p className={w.paused}>
              Results paused until the flagged entries are corrected. Nothing is estimated for
              missing or invalid inputs.
            </p>
          ) : (
            <>
              <p className={w.hint}>
                Drag or use the arrow keys; every view updates as you go. Back at the baseline mark,
                a slider inherits the baseline.
              </p>
              {precedence.map(([key, amount, name]) => (
                <p key={key} className={w.paused}>
                  Fixed {name} of {dollars(amount)} per year takes precedence. This {name}{' '}
                  percentage will not change that amount, including when the fixed amount is zero.
                </p>
              ))}
              {generalErrors.map((e, i) => (
                <p key={i} className={w.error} role="alert">
                  {e.message}
                </p>
              ))}
              <div className={w.sliders}>
                {rows.map((row) =>
                  'missing' in row ? (
                    <div key={row.path} className={w.slider}>
                      <div className={w.sliderHead}>
                        <span>{row.label}</span>
                      </div>
                      <small className={w.sliderNote}>{row.missing}</small>
                    </div>
                  ) : (
                    slider(row)
                  ),
                )}
              </div>
              {others.length > 0 && (
                <p className={w.hint}>
                  Also applied from {state.name}:{' '}
                  {others.map((p) => `${overrideLabel(p)} ${values[p]}`).join(' · ')}
                </p>
              )}
            </>
          )}
        </section>

        <section className={w.section} aria-labelledby={`${titleId}-effect`} aria-live="polite">
          <h3 id={`${titleId}-effect`}>Effect</h3>
          {!baselineResult ? null : !simulation ? (
            <p className={w.hint}>Showing the baseline. Move a slider to see the effect.</p>
          ) : simulation.ok ? (
            <ul className={w.effects}>
              {effects.map((row) => (
                <li key={row.key} data-changed={row.changed || undefined}>
                  <span>{row.label}</span>
                  <b>{formatMetric(row.kind, row.simulated)}</b>
                  <DeltaNote kind={row.kind} baseline={row.baseline} simulated={row.simulated} />
                </li>
              ))}
            </ul>
          ) : (
            <p className={w.paused} role="status">
              Simulation paused. Adjust the highlighted slider; the analysis keeps showing the
              baseline.
            </p>
          )}
        </section>
      </div>
      <footer className={w.foot}>
        <button
          type="button"
          disabled={!Object.keys(activeOverrides(values)).length}
          onClick={() => onState({ scope: state.scope, values: {}, name: 'What if' })}
        >
          Reset to baseline
        </button>
        <button type="button" onClick={onExit}>
          Exit what if
        </button>
        <p className={w.hint}>
          Nothing here is saved.{' '}
          <button type="button" className={w.linkButton} onClick={onManageCases}>
            Manage saved cases on Compare
          </button>
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
