import type { CSSProperties, ReactNode } from 'react';
import { cx } from './cx';

export function Alert({
  tone = 'info',
  children,
}: {
  tone?: 'info' | 'warning' | 'success' | 'error';
  children: ReactNode;
}) {
  return (
    <div
      className={cx('alert', tone !== 'info' && tone)}
      role={tone === 'error' ? 'alert' : 'status'}
    >
      {children}
    </div>
  );
}

export function Progress({
  value,
  label = 'Progress',
  style,
}: {
  value: number;
  label?: string;
  style?: CSSProperties;
}) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div
      className="progress"
      role="progressbar"
      aria-label={label}
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      style={style}
    >
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Steps({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="steps">
      {steps.map((s, i) => (
        <li
          key={s}
          className={cx(i < current && 'done', i === current && 'current')}
          aria-current={i === current ? 'step' : undefined}
        >
          {s}
        </li>
      ))}
    </ol>
  );
}
