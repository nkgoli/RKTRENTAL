'use client';

import { useId, useState } from 'react';

/** Native selection plus a wrapping readout for labels longer than a phone control. */
export function SelectionField({
  name,
  label,
  options,
  defaultValue,
  help,
  className,
}: {
  name: string;
  label: string;
  options: readonly { value: string; label: string }[];
  defaultValue: string;
  help: string;
  className?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const id = useId();
  return (
    <label className={className}>
      <span>{label}</span>
      <select
        name={name}
        aria-label={label}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        aria-describedby={`${id}-value ${id}-help`}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <small id={`${id}-value`} aria-live="polite">
        {options.find((option) => option.value === value)?.label}
      </small>
      <small id={`${id}-help`}>{help}</small>
    </label>
  );
}
