'use client';

import { useEffect, useId, useMemo, useRef } from 'react';
import { Field, Input, Select } from '@/components/ui';
import {
  applyValues,
  fieldLabel,
  friendlyIssues,
  groups,
  propertyRoiPatch,
  type Values,
} from '@/components/analysis/fields';
import {
  PayloadSchema,
  calculatePayload,
  issues,
  missingData,
  type AnalysisPayload,
  type ValidationIssue,
} from '@/lib/analysis';
import type { RoiDemoProvenance } from '@/lib/properties/roi-inputs';
import { FieldError } from './FieldError';
import styles from '../properties.module.css';

export function PropertyRoiFields({
  values,
  onChange,
  original,
  demo,
  errors = {},
  baseline,
  focusField,
  saved,
  propertyValues,
}: {
  values: Values;
  onChange: (values: Values) => void;
  original?: Values;
  /** Stored provenance of fictional demo values; unchanged ones are labeled. */
  demo?: RoiDemoProvenance;
  errors?: Record<string, string>;
  /** Opened from Returns & ROI: the analysis whose baseline these fields edit. */
  baseline?: AnalysisPayload;
  focusField?: string;
  /** Saved analysis status and revision; null for a new analysis. */
  saved?: string | null;
  /** Values saved on the property itself, shown where the analysis baseline differs. */
  propertyValues?: Values;
}) {
  const isDemo = (path: string) =>
    !!demo?.paths.includes(path) && !!original?.[path] && values[path] === original[path];
  const demoCount = demo?.paths.filter(isDemo).length ?? 0;
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  const found = friendlyIssues(
    Object.entries(errors)
      .filter(([path]) => path.startsWith('roiInputs.'))
      .map(([path, message]) => ({ path, message })),
  );
  // Full field-level ROI validation of the baseline as edited; saving is never blocked by it.
  const needed = useMemo<ValidationIssue[]>(() => {
    if (!baseline) return [];
    const edited = applyValues(baseline, values, !!baseline.options.tax);
    const missing = missingData(edited);
    if (missing.length) return friendlyIssues(missing);
    try {
      calculatePayload({ ...PayloadSchema.parse(edited), scenarios: [], benchmarks: [] });
      return [];
    } catch (error) {
      return friendlyIssues(issues(error));
    }
  }, [baseline, values]);
  const issueFor = (path: string) =>
    found.find((e) => e.path === path) ?? needed.find((e) => e.path === path);
  function focus(path: string) {
    const field = document.getElementById(`${id}-${path}`);
    let ancestor = field?.parentElement;
    while (ancestor) {
      if (ancestor instanceof HTMLDetailsElement) ancestor.open = true;
      ancestor = ancestor.parentElement;
    }
    field?.focus();
  }
  useEffect(() => {
    // Server validation can arrive after a manager has collapsed a section.
    const first = Object.keys(errors).find((path) => path.startsWith('roiInputs.'));
    if (first) focus(first.replace(/^roiInputs\./, ''));
    // Focus only in response to a new server validation result.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [errors]);
  useEffect(() => {
    // Returns & ROI links straight to the assumption a manager chose to complete.
    // Without a field, the #roi-details address scrolls this section into view.
    if (focusField) focus(focusField);
    // Focus once on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div ref={ref} id="roi-details" className={styles.roiDetails}>
      <input
        type="hidden"
        name="roiInputs"
        value={JSON.stringify(propertyRoiPatch(values, original))}
      />
      <details open>
        <summary>
          {baseline ? (
            'ROI assumptions'
          ) : (
            <>
              ROI details <span className="muted">· Optional</span>
            </>
          )}
        </summary>
        {baseline ? (
          <>
            <p className="muted">
              {saved
                ? `These are the baseline assumptions of your saved ROI analysis (${saved}).`
                : 'These details fill your new ROI analysis.'}{' '}
              Saving updates this property and the assumptions you change in its ROI analysis.
              Scenarios, comparisons and assumptions you leave unchanged stay as saved. Income is
              for the whole property, across all units. Blank means unknown; enter 0 only when it
              applies.
            </p>
            {needed.length ? (
              <div className={styles.roiNeeded} role="status">
                <p>
                  <strong>
                    {needed.length} {needed.length === 1 ? 'input' : 'inputs'} needed to calculate
                    ROI.
                  </strong>{' '}
                  You can save now and finish later.
                </p>
                <ul>
                  {needed.map((issue) => (
                    <li key={issue.path}>
                      <a
                        href={`#${id}-${issue.path}`}
                        onClick={(event) => {
                          event.preventDefault();
                          focus(issue.path);
                        }}
                      >
                        {fieldLabel(issue.path)}: {issue.message}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className={styles.roiReady} role="status">
                All required assumptions are complete. Save to recalculate your ROI.
              </p>
            )}
          </>
        ) : (
          <p className="muted">
            Save your property with all of these blank, or enter only what you know. Saved details
            fill a new ROI analysis automatically. Income is for the whole property, across all
            units. Blank means unknown; enter 0 only when it applies.
          </p>
        )}
        {original && !baseline && (
          <p className="muted">
            Clear a saved field to mark it unknown. Unchanged fields keep their latest saved values.
            If this property has a saved ROI analysis, the assumptions you change or clear here
            update it too; its other assumptions and scenarios stay as saved.
          </p>
        )}
        {demoCount > 0 && (
          <p className="muted" data-demo-assumptions={demoCount}>
            Sample data: {demoCount} value{demoCount === 1 ? ' is a' : 's are'} fictional demo
            {demoCount === 1 ? ' assumption' : ' assumptions'} ({demo!.label}), not recorded
            actuals. Replace a value with your own to use it.
          </p>
        )}
        {!!found.length && (
          <div role="alert">
            <p>Review these optional details, or leave a new field blank to add it later.</p>
            <ul>
              {found.map((issue) => (
                <li key={issue.path}>
                  <a
                    href={`#${id}-${issue.path}`}
                    onClick={(event) => {
                      event.preventDefault();
                      focus(issue.path);
                    }}
                  >
                    {fieldLabel(issue.path)}: {issue.message}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
        {errors.roiInputs && <FieldError message="Check your ROI details and try saving again." />}
        {groups.map((group, index) => (
          <details key={group.title} className={styles.roiGroup} open={!!baseline}>
            <summary>{group.title}</summary>
            {index === 0 && (
              <>
                <p className="muted">
                  Financing a purchase? Enter the loan amount or down payment and the loan terms
                  below. Paying in cash? Choose no loan; loan-only terms will not be needed.
                </p>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() =>
                    onChange({
                      ...values,
                      'input.financing.loanAmount': '0',
                    })
                  }
                >
                  Pay in cash · No loan
                </button>
                <p className="muted">
                  A $0 loan means no debt payments or lender costs. Interest rate, loan term and
                  loan type are not needed. Any saved loan details stay available if your plans
                  change.
                </p>
              </>
            )}
            {group.title === 'Expenses & reserves' && (
              <p className="muted">
                Fixed annual maintenance, capital reserves and management replace their percentages,
                including an explicit $0. Enter either the fixed annual cost or its percentage.
              </p>
            )}
            <div className={styles.roiGrid}>
              {group.fields.map((field) => {
                const error = issueFor(field.path);
                const onProperty = propertyValues?.[field.path] ?? '';
                const fieldId = `${id}-${field.path}`;
                const props = {
                  id: fieldId,
                  value: values[field.path] ?? '',
                  'aria-label': field.label,
                  onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
                    onChange({ ...values, [field.path]: event.target.value }),
                  'aria-invalid': !!error,
                  'aria-describedby': error ? `${fieldId}-error` : undefined,
                };
                return (
                  <Field key={field.path} label={field.label}>
                    {field.kind === 'select' ? (
                      <Select {...props}>
                        <option value="">Not set</option>
                        {field.choices?.map((choice) => (
                          <option key={choice} value={choice}>
                            {choice.replaceAll('_', ' ')}
                          </option>
                        ))}
                      </Select>
                    ) : (
                      <Input
                        {...props}
                        type={field.kind === 'date' ? 'date' : 'text'}
                        inputMode={field.kind === 'date' ? undefined : 'decimal'}
                      />
                    )}
                    {found.some((e) => e.path === field.path) ? (
                      <FieldError id={`${fieldId}-error`} message={error?.message} />
                    ) : (
                      error && (
                        <span id={`${fieldId}-error`} className={styles.roiNeededField}>
                          {error.message}
                        </span>
                      )
                    )}
                    {isDemo(field.path) && (
                      <span className="muted">Fictional demo value - not a recorded actual.</span>
                    )}
                    {original?.[field.path] && !values[field.path] && (
                      <span className="muted">Will be cleared on save.</span>
                    )}
                    {propertyValues &&
                      values[field.path] === original?.[field.path] &&
                      onProperty !== (original?.[field.path] ?? '') && (
                        <span className="muted">
                          Analysis value. Property details: {onProperty || 'blank'}.
                        </span>
                      )}
                  </Field>
                );
              })}
            </div>
          </details>
        ))}
      </details>
    </div>
  );
}
