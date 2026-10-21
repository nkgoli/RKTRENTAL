'use client';

import {
  Children,
  cloneElement,
  isValidElement,
  useId,
  type AriaAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { cx } from './cx';

/** Label, optional tag, control, hint, error: always in that order. */
export function Field({
  label,
  hint,
  optional,
  error,
  children,
  className,
}: {
  label: string;
  hint?: string;
  optional?: boolean;
  error?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const fieldId = useId();
  const labelId = `${fieldId}-label`;
  const hintId = `${fieldId}-hint`;
  const errorId = `${fieldId}-error`;
  const controls = Children.map(children, (child) => {
    if (
      !isValidElement<AriaAttributes>(child) ||
      ![Input, Select, Textarea, 'input', 'select', 'textarea'].includes(child.type as typeof Input)
    ) {
      return child;
    }
    return cloneElement(child, {
      'aria-labelledby':
        child.props['aria-labelledby'] ?? (child.props['aria-label'] ? undefined : labelId),
      'aria-describedby':
        [child.props['aria-describedby'], hint && hintId, error && errorId]
          .filter(Boolean)
          .join(' ') || undefined,
      'aria-invalid': error ? true : child.props['aria-invalid'],
    });
  });
  return (
    <label className={cx('field', className)}>
      <span className="field-label" id={labelId}>
        {label}
        {optional && <span className="optional">Optional</span>}
      </span>
      {controls}
      {hint && (
        <span className="hint" id={hintId}>
          {hint}
        </span>
      )}
      {error && (
        <span className="field-error" id={errorId} role="alert">
          {error}
        </span>
      )}
    </label>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} />;
}

export function Select({ children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...rest}>{children}</select>;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} />;
}

export function FormRow({ columns = 2, children }: { columns?: 2 | 3; children: ReactNode }) {
  return <div className={cx('form-row', columns === 3 && 'three')}>{children}</div>;
}

export function SearchInput({
  placeholder = 'Search',
  ...rest
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="search">
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <input type="search" aria-label={placeholder} placeholder={placeholder} {...rest} />
    </div>
  );
}

export function Switch({
  on,
  label,
  onChange,
}: {
  on: boolean;
  label: string;
  onChange?: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      className={cx('switch', on && 'on')}
      onClick={() => onChange?.(!on)}
    />
  );
}

export function Check({
  label,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & { label: string }) {
  return (
    <label className="check">
      <input type="checkbox" {...rest} />
      {label}
    </label>
  );
}
