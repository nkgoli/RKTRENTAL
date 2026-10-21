'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type InputHTMLAttributes } from 'react';
import { Icon } from '../shell/Icons';

/**
 * Type-to-filter search for server-rendered lists. Debounces 250ms, then replaces the URL's
 * `name` param (dropping `page`) so the page re-renders with the new query and stays shareable.
 * Enter applies immediately; the field keeps focus across the navigation.
 */
export function SearchField({
  name = 'q',
  defaultValue = '',
  placeholder = 'Search',
  resetParams = ['page'],
  delay = 250,
  ...rest
}: {
  name?: string;
  defaultValue?: string;
  placeholder?: string;
  resetParams?: string[];
  delay?: number;
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'name' | 'defaultValue' | 'onChange'>) {
  const router = useRouter();
  const [value, setValue] = useState(defaultValue);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const applied = useRef(defaultValue);

  useEffect(() => {
    setValue(defaultValue);
    applied.current = defaultValue;
  }, [defaultValue]);

  const apply = (next: string) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (next.trim() === applied.current.trim()) return;
    applied.current = next;
    const url = new URL(window.location.href);
    if (next.trim()) url.searchParams.set(name, next.trim());
    else url.searchParams.delete(name);
    for (const param of resetParams) url.searchParams.delete(param);
    const query = url.searchParams.toString();
    router.replace(`${url.pathname}${query ? `?${query}` : ''}`, { scroll: false });
  };

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return (
    <div className="search">
      <Icon name="search" />
      <input
        type="search"
        name={name}
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(event) => {
          const next = event.target.value;
          setValue(next);
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => apply(next), delay);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            apply(value);
          }
        }}
        {...rest}
      />
    </div>
  );
}
