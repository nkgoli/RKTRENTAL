import Link from 'next/link';
import { Badge, Card, CardHeader } from '@/components/ui';
import type { PropertyDetail } from '@/lib/properties/data';
import type { PropertyWorkspaceReturns } from '@/lib/metrics/queries';
import { formatMoney } from '@/lib/properties/format';
import { propertyListingMode } from '@/components/properties/listing';
import { RentCompsPanel } from '@/components/rent-comps/RentCompsPanel';
import styles from './PropertyListing.module.css';

export async function PropertyListing({
  property,
  returns,
  organizationId,
  searchParams,
}: {
  property: PropertyDetail;
  returns: PropertyWorkspaceReturns;
  organizationId: string;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const units = returns.unitFacts.filter((unit) => unit.status !== 'ARCHIVED');
  if (propertyListingMode(units.length) === 'single-family-comps') {
    const unit = units[0]!;
    return <section className={styles.singleFamily}>
      <div className={styles.heading}><p className="eyebrow">Single-family listing</p><h2>Rent comps for {property.name}</h2><p className="muted">Comparable rentals use this home&apos;s size, beds, baths and location.</p></div>
      <RentCompsPanel organizationId={organizationId} unitId={unit.id} searchParams={searchParams} subjectLabel={property.name} propertyLevel />
    </section>;
  }

  return <Card flush>
    <CardHeader title="Market rent by unit" action={<Badge tone="info">Multi-unit property</Badge>} />
    <div className={styles.tableWrap}>
      <table className="table" aria-label="Market rent by unit">
        <thead><tr><th>Unit</th><th>Configuration</th><th className="num">Current rent</th><th className="num">Market rent</th><th className="num">Gap</th><th>Status</th><th /></tr></thead>
        <tbody>
          {units.length === 0 && <tr><td colSpan={7} className="muted">No units available for rent comparisons.</td></tr>}
          {units.map((unit) => {
            const comparisonRent = unit.currentRent ?? unit.listedRent;
            const gap = unit.marketRent != null && comparisonRent != null ? unit.marketRent - comparisonRent : null;
            const statusLabel = unit.status === 'OCCUPIED' ? 'Occupied' : unit.status === 'VACANT' ? 'Vacant' : 'Turnover';
            return <tr key={unit.id}>
              <td><Link href={`/properties/${property.id}?unit=${unit.id}`}><strong>{unit.number}</strong></Link></td>
              <td>{unit.bedrooms ?? '—'} bd · {unit.bathrooms ?? '—'} ba{unit.squareFeet ? ` · ${unit.squareFeet.toLocaleString('en-US')} sqft` : ''}</td>
              <td className="num">{formatMoney(unit.currentRent ?? unit.listedRent)}</td>
              <td className="num">{formatMoney(unit.marketRent)}</td>
              <td className="num">{gap == null ? '—' : `${gap >= 0 ? '+' : '−'}${formatMoney(Math.abs(gap))}`}</td>
              <td><Badge tone={unit.status === 'OCCUPIED' ? 'success' : unit.status === 'VACANT' ? 'info' : 'warning'}>{statusLabel}</Badge></td>
              <td><Link className="btn btn-secondary btn-sm" href={`/properties/${property.id}/listing?unit=${unit.id}`}>See comps</Link></td>
            </tr>;
          })}
        </tbody>
      </table>
    </div>
    <p className={styles.note}>Comps are compared at the unit level. A property-wide rent estimate is not shown for multi-unit buildings.</p>
  </Card>;
}
