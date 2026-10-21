import type { HTMLAttributes, ReactNode } from 'react';
import { cx } from './cx';
import { Progress } from './Feedback';

export function Card({
  flush,
  className,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { flush?: boolean }) {
  return <div className={cx('card', flush && 'flush', className)} {...rest} />;
}

export function CardHeader({ title, action }: { title: ReactNode; action?: ReactNode }) {
  return (
    <div className="card-header">
      <h3>{title}</h3>
      {action}
    </div>
  );
}

export type StatTone = 'up' | 'down' | 'neutral';

export function Stat({
  label,
  value,
  delta,
  tone = 'neutral',
  progress,
}: {
  label: string;
  value: ReactNode;
  delta?: ReactNode;
  tone?: StatTone;
  /** 0–100 */
  progress?: number;
}) {
  return (
    <div className="card stat">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {delta !== undefined && (
        <span className={cx('delta', tone !== 'neutral' && tone)}>{delta}</span>
      )}
      {progress !== undefined && (
        <Progress value={progress} label={`${label} progress`} style={{ marginTop: 10 }} />
      )}
    </div>
  );
}
