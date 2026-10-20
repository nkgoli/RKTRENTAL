'use client';

import { useEffect, useId, useRef } from 'react';
import { Field, Input, Select } from '@/components/ui';
import {
  fieldLabel,
  friendlyIssues,
  groups,
  propertyRoiPatch,
  type Values,
} from '@/components/analysis/fields';
import type { RoiDemoProvenance } from '@/lib/properties/roi-inputs';
import { FieldError } from './FieldError';
import styles from '../properties.module.css';

export function PropertyRoiFields({
  values,
  onChange,
  original,
  demo,
  errors = {},
}: {
  values: Values;
  onChange: (values: Values) => void;
  original?: Values;
  /** Stored provenance of fictional demo values; unchanged ones are labeled. */
  demo?: RoiDemoProvenance;
  errors?: Record<string, string>;
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
  return (
    <div ref={ref} className={styles.roiDetails}>
      <input
        type="hidden"
        name="roiInputs"
        value={JSON.stringify(propertyRoiPatch(values, original))}
      />
      <details open>
        <summary>
          ROI details <span className="muted">· Optional</span>
        </summary>
        <p className="muted">
          Save your property with all of these blank, or enter only what you know. Saved details
          fill a new ROI analysis automatically. Income is for the whole property, across all units.
          Blank means unknown; enter 0 only when it applies.
        </p>
        {original && (
          <p className="muted">
            Clear a saved field to mark it unknown. Unchanged fields keep their latest saved values.
            Existing saved analyses keep their own assumptions.
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
          <details key={group.title} className={styles.roiGroup}>
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
                const error = found.find((e) => e.path === field.path);
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
                    <FieldError id={`${fieldId}-error`} message={error?.message} />
                    {isDemo(field.path) && (
                      <span className="muted">Fictional demo value - not a recorded actual.</span>
                    )}
                    {original?.[field.path] && !values[field.path] && (
                      <span className="muted">Will be cleared on save.</span>
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
