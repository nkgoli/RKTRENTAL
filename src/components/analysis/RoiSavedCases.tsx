'use client';
import { useState } from 'react';
import type { AnalysisPayload, ValidationIssue } from '@/lib/analysis';
import { activeOverrides } from '@/lib/analysis/what-if';
import type { ScenarioDraft } from '@/lib/analysis/scenarios';
import { readPath } from './fields';
import { CalculationAssumptions, inputFields } from './RoiScenarios';
import styles from './analysis.module.css';
import w from './what-if.module.css';

/** The assumptions most cases change; every other input sits under "More assumptions". */
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
const MAX_CASES = 20;

const baseText = (base: AnalysisPayload, path: string) => {
  const v = readPath(base.input, path);
  return v === undefined || v === '' ? 'Not set' : String(v);
};

/**
 * Saved cases on Compare: created, named, edited and removed here, and kept with the analysis
 * when it is saved. This is separate from the temporary What if, which only copies a case.
 */
export function SavedCases({
  drafts,
  onDrafts,
  base,
  errors,
  saving,
  busy,
}: {
  drafts: ScenarioDraft[];
  onDrafts: (next: ScenarioDraft[]) => void;
  /** Baseline assumptions as entered (shown as each field's baseline). */
  base: AnalysisPayload;
  errors: ValidationIssue[];
  saving: boolean;
  /** True while a save request is in flight: edits wait so the reply cannot drop them. */
  busy: boolean;
}) {
  const [opened, setOpened] = useState<string[]>([]);
  const [more, setMore] = useState<string[]>([]);
  const locked = busy;

  function add() {
    const index = drafts.length;
    const id = crypto.randomUUID();
    onDrafts([...drafts, { id, name: `Case ${index + 1}`, values: {} }]);
    setOpened((list) => [...list, id]);
    setTimeout(() => {
      const input = document.getElementById(`scenarios.${index}.name`) as HTMLInputElement | null;
      input?.focus();
      input?.select();
    }, 0);
  }

  function editor(draft: ScenarioDraft, index: number) {
    const prefix = `scenarios.${index}`;
    const fieldError = (path: string) =>
      errors.find((e) => e.path === `${prefix}.overrides.${path}`);
    const caseErrors = errors.filter(
      (e) =>
        e.path === prefix ||
        e.path === `${prefix}.name` ||
        (e.path.startsWith(`${prefix}.`) && !e.path.includes('.overrides.')),
    );
    const nameError = errors.some((e) => e.path === `${prefix}.name`);
    const setValues = (next: Record<string, string>) => {
      if (locked) return;
      onDrafts(drafts.map((d, i) => (i === index ? { ...d, values: next } : d)));
    };
    const moreFields = inputFields.filter((f) => !KEY_PATHS.includes(f.path.slice(6)));
    const moreOpen =
      more.includes(draft.id) ||
      moreFields.some((f) => draft.values[f.path.slice(6)]?.trim() || fieldError(f.path.slice(6)));
    const changes = Object.keys(activeOverrides(draft.values)).length;
    const field = (path: string) => {
      const spec = inputFields.find((f) => f.path === `input.${path}`);
      if (!spec) return null;
      const id = `${prefix}.overrides.${path}`;
      const error = fieldError(path);
      return (
        <label
          key={path}
          className={w.field}
          data-overridden={!!draft.values[path]?.trim() || undefined}
        >
          <span>
            {spec.label}
            <small> · Baseline {baseText(base, path)}</small>
          </span>
          {spec.kind === 'select' ? (
            <select
              id={id}
              value={draft.values[path] ?? ''}
              disabled={locked}
              aria-invalid={!!error}
              aria-describedby={error ? `${id}-error` : undefined}
              onChange={(e) => setValues({ ...draft.values, [path]: e.target.value })}
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
              value={draft.values[path] ?? ''}
              disabled={locked}
              placeholder={`Baseline ${baseText(base, path)}`}
              aria-invalid={!!error}
              aria-describedby={error ? `${id}-error` : undefined}
              onChange={(e) => setValues({ ...draft.values, [path]: e.target.value })}
            />
          )}
          {error && (
            <small id={`${id}-error`} className={w.error}>
              {error.message}
            </small>
          )}
        </label>
      );
    };
    const hasError = errors.some((e) => e.path === prefix || e.path.startsWith(`${prefix}.`));
    return (
      <details
        key={draft.id}
        className={w.caseItem}
        open={opened.includes(draft.id) || hasError}
        onToggle={(e) => {
          const isOpen = (e.target as HTMLDetailsElement).open;
          setOpened((list) =>
            isOpen ? [...new Set([...list, draft.id])] : list.filter((x) => x !== draft.id),
          );
        }}
      >
        <summary>
          {draft.name || 'Unnamed case'}
          <small>
            {' '}
            · {changes} {changes === 1 ? 'override' : 'overrides'}
          </small>
        </summary>
        <div className={w.caseBox}>
          <div
            id={prefix}
            tabIndex={-1}
            role="region"
            aria-label={`${draft.name || 'Unnamed case'}: case assumptions`}
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
                id={`${prefix}.name`}
                value={draft.name}
                maxLength={200}
                disabled={saving}
                aria-invalid={nameError}
                aria-describedby={nameError ? `${prefix}.name-error` : undefined}
                onChange={(e) =>
                  onDrafts(drafts.map((d, i) => (i === index ? { ...d, name: e.target.value } : d)))
                }
              />
            </label>
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                onDrafts(drafts.filter((_, i) => i !== index));
                setTimeout(() => document.getElementById('roi-case-add')?.focus(), 0);
              }}
            >
              Remove {draft.name || 'case'}
            </button>
          </div>
          {locked && (
            <p className={w.hint} role="status">
              Saving… this case can be edited again when the save finishes.
            </p>
          )}
          <div className={w.fields}>{KEY_PATHS.map(field)}</div>
          <details
            className={w.more}
            open={moreOpen}
            onToggle={(e) => {
              const isOpen = (e.target as HTMLDetailsElement).open;
              setMore((list) =>
                isOpen ? [...new Set([...list, draft.id])] : list.filter((x) => x !== draft.id),
              );
            }}
          >
            <summary>More assumptions</summary>
            <div className={w.fields}>{moreFields.map((f) => field(f.path.slice(6)))}</div>
          </details>
          {draft.options && (
            <details className={w.more}>
              <summary>Explicit scenario calculation options</summary>
              <CalculationAssumptions options={draft.options} />
              <p className={w.hint}>
                These saved assumptions apply only to this case. Use base calculation options to
                inherit the dates, discount rate and tax assumptions from the analysis.
              </p>
              <button
                type="button"
                disabled={locked}
                onClick={() =>
                  onDrafts(drafts.map((d, i) => (i === index ? { ...d, options: undefined } : d)))
                }
              >
                Use base calculation options
              </button>
            </details>
          )}
        </div>
      </details>
    );
  }

  return (
    <section
      id="roi-case-editor"
      className={`${styles.card} ${w.cases}`}
      aria-labelledby="roi-case-editor-title"
    >
      <div className={w.casesHead}>
        <div>
          <h3 id="roi-case-editor-title">Saved cases</h3>
          <p className={w.hint}>
            {drafts.length} of {MAX_CASES} · blank fields inherit the baseline. Cases are kept with
            the analysis when you save it.
          </p>
        </div>
        <button
          type="button"
          id="roi-case-add"
          disabled={saving || drafts.length >= MAX_CASES}
          onClick={add}
        >
          Add case
        </button>
      </div>
      {drafts.map(editor)}
    </section>
  );
}
