import Link from 'next/link';
import { COLLECTION_RANGES, type CollectionMonth, type CollectionRange } from '@/lib/dashboard/queries';
import { bucketLabel } from '@/lib/returns/period';
import { formatUsd } from '@/lib/ledger';

/** Rent collected per month against rent due, with a 6M / 12M / 2Y / 5Y switch kept in the URL. */
export function CollectionChart({
  months,
  range,
}: {
  months: CollectionMonth[];
  range: CollectionRange;
}) {
  const width = 640;
  const height = 150;
  const base = 124;
  const max = Math.max(1, ...months.flatMap((m) => [m.dueCents, m.collectedCents]));
  const slot = width / Math.max(months.length, 1);
  const barWidth = Math.max(2, slot * 0.62);
  const labelEvery = Math.ceil(months.length / 12);
  const withYear = months.length > 12;
  return (
    <div data-testid="collection-chart">
      <div className="chips" role="group" aria-label="Rent collection range" style={{ marginBottom: 8 }}>
        {(Object.keys(COLLECTION_RANGES) as CollectionRange[]).map((key) => (
          <Link
            key={key}
            className={`chip${range === key ? ' active' : ''}`}
            href={key === '6M' ? '/dashboard' : `/dashboard?range=${key}`}
            aria-current={range === key ? 'true' : undefined}
            scroll={false}
          >
            {key}
          </Link>
        ))}
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        role="img"
        aria-label={`Rent collected against rent due, last ${months.length} months`}
      >
        {months.map((month, index) => {
          const x = index * slot + (slot - barWidth) / 2;
          const collected = (month.collectedCents / max) * 100;
          const due = (month.dueCents / max) * 100;
          return (
            <g key={month.key}>
              <title>{`${bucketLabel(month.key, true)}: ${formatUsd(month.collectedCents)} of ${formatUsd(month.dueCents)}`}</title>
              <rect x={x} y={base - due} width={barWidth} height={due} rx={2} fill="var(--design-border, #e2e8f0)" />
              <rect x={x} y={base - collected} width={barWidth} height={collected} rx={2} fill="var(--design-primary)" />
              {index % labelEvery === 0 && (
                <text x={index === 0 ? x : x + barWidth / 2} y={142} textAnchor={index === 0 ? 'start' : 'middle'} fontSize={10} fill="var(--design-muted)">
                  {bucketLabel(month.key, withYear)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
