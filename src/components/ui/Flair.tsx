import type { ReactNode } from 'react';
import { cx } from './cx';

export type KpiTone = 'blue' | 'green' | 'coral';

export function KpiIcon({ tone = 'blue', children }: { tone?: KpiTone; children: ReactNode }) {
  return (
    <span className={cx('kpi-icon', tone)} aria-hidden="true">
      {children}
    </span>
  );
}

export function TrendChip({ warm, children }: { warm?: boolean; children: ReactNode }) {
  return <span className={cx('trend', warm && 'warm')}>{children}</span>;
}

export type SparklineTone = 'default' | 'ok' | 'warm';

/** Tiny area/line chart; colours come from `currentColor` via the .spark class. */
export function Sparkline({
  values,
  tone = 'default',
  label,
}: {
  values: number[];
  tone?: SparklineTone;
  label?: string;
}) {
  const w = 96;
  const h = 34;
  const pad = 3;
  const min = Math.min(...values);
  const span = Math.max(...values) - min || 1;
  const step = values.length > 1 ? w / (values.length - 1) : 0;
  const pts = values.map((v, i) => [
    +(i * step).toFixed(1),
    +(h - pad - ((v - min) / span) * (h - pad * 2)).toFixed(1),
  ]);
  const line = pts.map(([x, y]) => `${x},${y}`).join(' ');
  return (
    <svg
      className={cx('spark', tone !== 'default' && tone)}
      viewBox={`0 0 ${w} ${h}`}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {pts.length > 0 && <polygon points={`0,${h} ${line} ${w},${h}`} />}
      <polyline points={line} />
    </svg>
  );
}

/** Circular percentage gauge; stroke and label colours inherit from the .ring class. */
export function OccupancyRing({
  value,
  warm,
  label,
}: {
  value: number;
  warm?: boolean;
  label?: string;
}) {
  const pct = Math.max(0, Math.min(100, value));
  const r = 20;
  const c = 2 * Math.PI * r;
  return (
    <div className={cx('ring', warm && 'warm')}>
      <svg
        viewBox="0 0 52 52"
        role="img"
        aria-label={label ?? `${Math.round(pct)}% occupied`}
      >
        <circle className="ring-track" cx="26" cy="26" r={r} fill="none" strokeWidth="6" />
        <circle
          className="ring-fill"
          cx="26"
          cy="26"
          r={r}
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${((pct / 100) * c).toFixed(2)} ${c.toFixed(2)}`}
          transform="rotate(-90 26 26)"
        />
        <text x="26" y="30" textAnchor="middle" fontSize="12" fontWeight="700">
          {Math.round(pct)}%
        </text>
      </svg>
    </div>
  );
}

/** Overlapping initials; shows at most `max` and a "+N" chip for the rest. */
export function AvatarStack({ initials, max = 4 }: { initials: string[]; max?: number }) {
  const shown = initials.slice(0, max);
  const extra = initials.length - shown.length;
  return (
    <div className="avatar-stack">
      {shown.map((i, n) => (
        <span key={`${i}-${n}`} className={`av c${(n % 4) + 1}`}>
          {i}
        </span>
      ))}
      {extra > 0 && <span className="av more">+{extra}</span>}
    </div>
  );
}

export type CoverKind = 'apartment' | 'lofts' | 'townhomes' | 'house';

const art: Record<CoverKind, ReactNode> = {
  apartment: (
    <>
      <rect x="60" y="40" width="90" height="120" fill="#fff" opacity=".85" />
      <rect x="150" y="70" width="70" height="90" fill="#fff" opacity=".7" />
      <path d="M72 56h12M96 56h12M120 56h12M72 80h12M96 80h12M120 80h12M72 104h12M96 104h12M120 104h12" stroke="#1e3a8a" strokeWidth="6" opacity=".35" />
    </>
  ),
  lofts: (
    <>
      <rect x="40" y="60" width="130" height="100" fill="#3a2f6b" opacity=".6" />
      <rect x="170" y="85" width="80" height="75" fill="#3a2f6b" opacity=".45" />
      <path d="M52 78h24M88 78h24M124 78h24M52 108h24M88 108h24M124 108h24" stroke="#f1dcc2" strokeWidth="8" opacity=".7" />
    </>
  ),
  townhomes: (
    <>
      <path d="M30 160V90l25-20 25 20v70zM80 160V90l25-20 25 20v70zM130 160V90l25-20 25 20v70z" fill="#fff" opacity=".75" />
      <path d="M48 120h14M98 120h14M148 120h14" stroke="#1e3a8a" strokeWidth="8" opacity=".3" />
    </>
  ),
  house: (
    <>
      <path d="M70 160V100l55-42 55 42v60z" fill="#fff" opacity=".85" />
      <path d="M60 104l65-50 65 50" fill="none" stroke="#e0a283" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="112" y="124" width="26" height="36" fill="#1e3a8a" opacity=".35" />
    </>
  ),
};

/** Property cover: gradient + illustration, or a photo when `src` is given. */
export function Cover({
  kind = 'apartment',
  src,
  children,
}: {
  kind?: CoverKind;
  src?: string;
  children?: ReactNode;
}) {
  return (
    <div
      className={cx('cover', `cover--${kind}`, src && 'has-img')}
      style={src ? { backgroundImage: `url("${src.replace(/"/g, '%22')}")` } : undefined}
    >
      <svg className="art" viewBox="0 0 250 160" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
        {art[kind]}
      </svg>
      {children}
    </div>
  );
}

export function CoverPill({ warm, children }: { warm?: boolean; children: ReactNode }) {
  return (
    <span className={cx('cover-pill', warm && 'warm')}>
      <i />
      {children}
    </span>
  );
}

export function CoverName({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="cover-name">
      <h3>{title}</h3>
      {subtitle && <span>{subtitle}</span>}
    </div>
  );
}
