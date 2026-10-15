import type { ReactNode } from 'react';
import {
  KpiIcon,
  OccupancyRing,
  Sparkline,
  TrendChip,
  type KpiTone,
  type SparklineTone,
} from '@/components/ui';

export type KpiCardProps = {
  label: string;
  value: ReactNode;
  note?: ReactNode;
  icon: ReactNode;
  tone?: KpiTone;
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

/** Metric card with an icon chip, optional trend chip, and a sparkline or ring. */
export function KpiCard({
  label,
  value,
  note,
  icon,
  tone = 'blue',
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
        <KpiIcon tone={tone}>{icon}</KpiIcon>
        {trend !== undefined && <TrendChip warm={trendWarm}>{trend}</TrendChip>}
      </div>
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      <div className="kpi-bottom">
        <span className="note">{note}</span>
        {spark && spark.length > 1 && <Sparkline values={spark} tone={sparkTone} label={sparkLabel} />}
        {ring !== undefined && <OccupancyRing value={ring} warm={ringWarm} label={ringLabel} />}
      </div>
    </article>
  );
}

