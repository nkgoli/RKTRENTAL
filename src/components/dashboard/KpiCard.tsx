import type { ReactNode } from 'react';
import {
  OccupancyRing,
  Sparkline,
  TrendChip,
  type SparklineTone,
} from '@/components/ui';

export type KpiCardProps = {
  label: string;
  value: ReactNode;
  note?: ReactNode;
  /** Only for a real trend (e.g. ▲ 4.1%); never a restatement of the label or period. */
  trend?: ReactNode;
  trendWarm?: boolean;
  spark?: number[];
  sparkTone?: SparklineTone;
  sparkLabel?: string;
  /** Percentage shown as an occupancy-style ring. */
  ring?: number;
  ringWarm?: boolean;
  ringLabel?: string;
};

/** Compact metric tile: label, value and one line of context, with an optional trend, sparkline or ring. */
export function KpiCard({
  label,
  value,
  note,
  trend,
  trendWarm,
  spark,
  sparkTone,
  sparkLabel,
  ring,
  ringWarm,
  ringLabel,
}: KpiCardProps) {
  return (
    <article className="card kpi stat">
      <div className="kpi-top">
        <div className="label">{label}</div>
        {trend !== undefined && <TrendChip warm={trendWarm}>{trend}</TrendChip>}
      </div>
      <div className="kpi-bottom">
        <div>
          <div className="value">{value}</div>
          {note && <span className="note">{note}</span>}
        </div>
        {spark && spark.length > 1 && <Sparkline values={spark} tone={sparkTone} label={sparkLabel} />}
        {ring !== undefined && <OccupancyRing value={ring} warm={ringWarm} label={ringLabel} />}
      </div>
    </article>
  );
}
