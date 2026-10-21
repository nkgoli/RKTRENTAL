import Link from 'next/link';
import { Badge, Card, CardHeader, Table } from '@/components/ui';
import type { PropertyDetail } from '@/lib/properties/data';
import type { PropertyWorkspaceReturns } from '@/lib/metrics/queries';
import { formatMoney } from '@/lib/properties/format';
import { propertyListingMode } from '@/components/properties/listing';
import { RentCompsPanel } from '@/components/rent-comps/RentCompsPanel';
import { EmptyState } from '@/components/RouteStates';
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
    return <section className={styles.singleFamily} aria-label="Single-family listing">
      <RentCompsPanel organizationId={organizationId} unitId={unit.id} searchParams={searchParams} subjectLabel={property.name} propertyLevel />
    </section>;
  }

  if (!units.length) return <EmptyState title="No units to compare yet" description="Add a unit with its size, beds and baths to compare nearby rentals." action="Go to property" href={`/properties/${property.id}#add-unit`} />;

  const hasConfiguration = units.some((unit) => unit.bedrooms != null || unit.bathrooms != null);
  return <Card flush>
    <CardHeader title="Market rent by unit" action={<span className={styles.count}>{units.length} units · {units.filter((unit) => unit.marketRent != null).length} with market rent</span>} />
    <p className={styles.intro}>Review each unit against nearby rentals. Market rent is the saved estimate; open comps to review a new suggestion.</p>
    {!hasConfiguration && <p className={styles.intro}><Link href={`/properties/${property.id}#units`}>Add unit details to improve comps → Edit units</Link></p>}
    <div className={styles.tableWrap} role="region" aria-label="Market rent by unit table" tabIndex={0}>
      <Table mobile="cards" aria-label="Market rent by unit">
        <thead><tr><th scope="col">Unit</th>{hasConfiguration && <th scope="col">Configuration</th>}<th scope="col" className="num">Current / listed</th><th scope="col" className="num">Market rent</th><th scope="col" className="num">Gap / month</th><th scope="col">Status</th><th scope="col" aria-label="Compare rentals" /></tr></thead>
        <tbody>
          {units.map((unit) => {
            const comparisonRent = unit.currentRent ?? unit.listedRent;
            const gap = unit.marketRent != null && comparisonRent != null ? unit.marketRent - comparisonRent : null;
            const statusLabel = unit.status === 'OCCUPIED' ? 'Occupied' : unit.status === 'VACANT' ? 'Vacant' : 'Turnover';
            return <tr key={unit.id} className="row-link">
              <td data-cell="title"><Link className="row-anchor" href={`/properties/${property.id}/listing?unit=${unit.id}`}><strong>{unit.number}</strong></Link></td>
              {hasConfiguration && <td data-cell="sub">{unit.bedrooms == null && unit.bathrooms == null ? 'Add beds / baths' : `${unit.bedrooms ?? '—'} bd · ${unit.bathrooms ?? '—'} ba`}{unit.squareFeet ? ` · ${unit.squareFeet.toLocaleString('en-US')} sqft` : ''}</td>}
              <td className="num" data-cell="amount">{formatMoney(comparisonRent)}<small className={styles.rentKind}>{unit.currentRent == null ? 'Listed' : 'Current lease'}</small></td>
              <td className="num" data-cell="meta">{unit.marketRent == null ? <span className="muted">Not set</span> : formatMoney(unit.marketRent)}</td>
              <td className={`num ${gap && gap > 0 ? styles.positive : gap && gap < 0 ? styles.negative : ''}`} data-cell="sub">{gap == null || gap === 0 ? '—' : `${gap > 0 ? '+' : '−'}${formatMoney(Math.abs(gap))}`}</td>
              <td data-cell="status"><Badge tone={unit.status === 'OCCUPIED' ? 'success' : unit.status === 'VACANT' ? 'info' : 'warning'}>{statusLabel}</Badge></td>
              <td data-cell="hide"><Link className="btn btn-ghost btn-sm" aria-label={`See comps for unit ${unit.number}`} href={`/properties/${property.id}/listing?unit=${unit.id}`}>→</Link></td>
            </tr>;
          })}
        </tbody>
      </Table>
    </div>
    <p className={styles.note}>Comps are compared at the unit level. A property-wide rent estimate is not shown for multi-unit buildings.</p>
  </Card>;
}
