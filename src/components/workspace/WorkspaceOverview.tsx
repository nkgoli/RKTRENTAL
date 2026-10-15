import Link from 'next/link';
import { Avatar, Badge, Card, CardHeader, KpiIcon, Sparkline } from '@/components/ui';
import { formatAddress, formatDate, formatMoney, initials } from '@/lib/properties/format';
import type { PropertyDetail, UnitDetail } from '@/lib/properties/data';
import type { ScopedReturns } from '@/lib/metrics/scoped';
import { FileList, PhotoImage } from '@/app/(manager)/properties/_components/Media';
import { FileUploader } from '@/app/(manager)/properties/_components/FileUploader';
import { DeleteUnitControl } from '@/components/units/DeleteUnitControl';
import styles from './WorkspaceOverview.module.css';

function moneyCents(cents: number) {
  return formatMoney(cents / 100);
}

function statusTone(status: string): 'success' | 'warning' | 'info' | undefined {
  if (status === 'OCCUPIED') return 'success';
  if (status === 'VACANT') return 'info';
  if (status === 'TURNOVER') return 'warning';
  return undefined;
}

function PropertyUnits({ property }: { property: PropertyDetail }) {
  return (
    <Card flush id="units">
      <CardHeader title="Units" action={<span className="muted">{property.stats.unitCount} total</span>} />
      <div className={styles.tableWrap}>
        <table className="table" aria-label="Property units">
          <thead><tr><th>Unit</th><th>Tenant</th><th className="num">Rent</th><th>Status</th><th /></tr></thead>
          <tbody>
            {property.units.filter((unit) => unit.status !== 'ARCHIVED').length === 0 && <tr><td colSpan={5} className="muted">No active units yet.</td></tr>}
            {property.units.filter((unit) => unit.status !== 'ARCHIVED').map((unit) => (
              <tr key={unit.id}>
                <td><Link href={`/properties/${property.id}/units/${unit.id}`}><strong>{unit.isImplicit ? 'Whole property' : unit.number}</strong></Link></td>
                <td>{unit.tenant?.name ?? <span className="muted">None</span>}</td>
                <td className="num">{formatMoney(unit.rent ?? unit.listedRent)}</td>
                <td><Badge tone={statusTone(unit.status)}>{unit.status === 'OCCUPIED' ? 'Occupied' : unit.status === 'VACANT' ? 'Vacant' : 'Turnover'}</Badge></td>
                <td><Link className="btn btn-ghost btn-sm" href={`/properties/${property.id}/units/${unit.id}`}>Open</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export function PropertyOverview({ property, returns, leaseFacts = [] }: {
  property: PropertyDetail;
  returns: ScopedReturns;
  leaseFacts?: { id: string; leaseStartDate: Date | null; leaseEndDate: Date | null; tenantName: string | null }[];
}) {
  const activeUnits = property.units.filter((unit) => unit.status !== 'ARCHIVED');
  const steps = [
    ...(property.stats.openRepairs ? [{ label: `${property.stats.openRepairs} repair${property.stats.openRepairs === 1 ? '' : 's'} need attention`, href: `/maintenance?propertyId=${property.id}` }] : []),
    ...(property.stats.expiringLeases ? [{ label: `${property.stats.expiringLeases} lease${property.stats.expiringLeases === 1 ? '' : 's'} expiring soon`, href: `/leases?propertyId=${property.id}&tab=expiring` }] : []),
    ...(activeUnits.some((unit) => unit.status === 'VACANT') ? [{ label: 'Review vacant units and pricing', href: `/properties/${property.id}?tab=listing` }] : []),
  ];

  return (
    <div className={styles.page}>
      <div className={styles.primary}>
        <Card flush>
          <CardHeader title="Lease timeline" action={<Link href={`/leases?propertyId=${property.id}`}>View leases</Link>} />
          <div className={styles.timeline}>
            {activeUnits.map((unit) => {
              const lease = leaseFacts.find((fact) => fact.id === unit.id);
              const term = lease?.leaseStartDate && lease.leaseEndDate
                ? `${formatDate(lease.leaseStartDate)} - ${formatDate(lease.leaseEndDate)}`
                : unit.status === 'VACANT' ? 'Available · no active lease' : 'No current tenant';
              return <Link className={styles.timelineItem} key={unit.id} href={`/properties/${property.id}/units/${unit.id}`}>
                <span className={styles.timelineDot} data-status={unit.status} />
                <span className={styles.timelineMain}><strong>{unit.isImplicit ? property.name : `Unit ${unit.number}`}</strong><small>{lease?.tenantName ?? unit.tenant?.name ?? term}{lease?.tenantName && lease?.leaseStartDate && lease.leaseEndDate ? ` · ${term}` : ''}</small></span>
                <span className={styles.timelineValue}>{formatMoney(unit.rent ?? unit.listedRent)}<small>/mo</small></span>
                <Badge tone={statusTone(unit.status)}>{unit.status === 'OCCUPIED' ? 'Occupied' : unit.status === 'VACANT' ? 'Vacant' : 'Turnover'}</Badge>
              </Link>;
            })}
            {activeUnits.length === 0 && <p className="muted">Add a unit to start tracking lease activity.</p>}
          </div>
        </Card>
        <div className={styles.twoCards}>
          <Card>
            <CardHeader title="Returns at a glance" action={<Link href={`/properties/${property.id}?tab=returns`}>View returns</Link>} />
            <div className={styles.kpiRows}>
              <div><span>Net operating income</span><strong>{moneyCents(returns.metrics.noiCents)}</strong></div>
              <div><span>Cash flow</span><strong>{moneyCents(returns.metrics.cashFlowCents)}</strong></div>
              <div><span>Cap rate</span><strong>{returns.metrics.capRate == null ? '—' : `${(returns.metrics.capRate * 100).toFixed(1)}%`}</strong></div>
            </div>
            <Sparkline values={returns.monthly.map((row) => row.incomeCents)} tone="ok" label="Monthly income trend" />
          </Card>
          <Card>
            <CardHeader title="Payments by the numbers" action={<Link href={`/payments?propertyId=${property.id}`}>View payments</Link>} />
            <div className={styles.paymentNumbers}>
              <div><p className="eyebrow">Collected · 12 mo</p><strong>{moneyCents(returns.collectedCents)}</strong></div>
              <div><p className="eyebrow">Due · 12 mo</p><strong>{moneyCents(returns.dueCents)}</strong></div>
            </div>
            <div className={styles.progressTrack}><span style={{ width: `${returns.dueCents ? Math.min(100, (returns.collectedCents / returns.dueCents) * 100) : 0}%` }} /></div>
            <p className="muted" style={{ fontSize: 12 }}>Collected rent compared with active lease rent scheduled for this period.</p>
          </Card>
        </div>
        <PropertyUnits property={property} />
      </div>
      <aside className={styles.side}>
        <Card>
          <CardHeader title="Property details" action={<Link href="#edit-property">Edit</Link>} />
          <dl className={styles.facts}>
            <dt>Address</dt><dd>{formatAddress(property)}</dd>
            <dt>Type</dt><dd>{activeUnits.length === 1 ? 'Single-family' : 'Multi-unit'}</dd>
            <dt>Year built</dt><dd>{property.yearBuilt ?? '—'}</dd>
            <dt>Units</dt><dd>{activeUnits.length} · {property.stats.occupied} occupied</dd>
            <dt>Owner</dt><dd>{property.owner?.name ?? 'Not assigned'}</dd>
          </dl>
        </Card>
        <Card>
          <CardHeader title="Next steps" />
          {steps.length ? <ul className={styles.steps}>{steps.map((step) => <li key={step.label}><span aria-hidden="true">↗</span><Link href={step.href}>{step.label}</Link></li>)}</ul> : <div className={styles.clearState}><KpiIcon tone="green">✓</KpiIcon><p>All caught up</p><small>No urgent items need attention.</small></div>}
        </Card>
        <Card>
          <CardHeader title="Documents and photos" action={<Link href={`/documents?propertyId=${property.id}`}>View all</Link>} />
          <p className={styles.subheading}>Property files</p>
          <FileList files={property.files} empty="No property files yet." />
          <p className={styles.subheading}>Photos</p>
          {property.photos.length ? <div className={styles.photoGrid} id="photos">{property.photos.slice(0, 4).map((photo, i) => <PhotoImage key={photo.id} photo={photo} index={i} />)}</div> : <p className="muted" id="photos">No photos uploaded yet.</p>}
          {property.leaseDocuments.length > 0 && <p className={styles.documentHint}>{property.leaseDocuments.length} lease document{property.leaseDocuments.length === 1 ? '' : 's'} on file</p>}
          <div className={styles.uploadControls}>
            <FileUploader targetType="property" targetId={property.id} kind="PHOTO" label="+ Upload photos" hint="JPG, PNG up to 25 MB" compact />
            <FileUploader targetType="property" targetId={property.id} kind="OTHER" label="Upload document" hint="PDF, JPG, PNG, DOC up to 25 MB" />
          </div>
        </Card>
      </aside>
    </div>
  );
}

function UnitLeaseTimeline({ unit }: { unit: UnitDetail }) {
  return (
    <Card>
      <CardHeader title="Lease timeline" action={unit.currentLease ? <Link href={`/leases/${unit.currentLease.id}?propertyId=${unit.property.id}&unitId=${unit.id}`}>View lease</Link> : <Link href={`/leases/new?unit=${unit.id}`}>Create lease</Link>} />
      {unit.leaseHistory.length ? <div className={styles.leaseTimeline}>{unit.leaseHistory.map((lease) => <div className={styles.leaseTimelineRow} key={lease.id}>
        <span className={styles.timelineDot} data-status={lease.status === 'ACTIVE' ? 'OCCUPIED' : 'VACANT'} />
        <span className={styles.timelineMain}><strong>{lease.tenantName}</strong><small>{formatDate(lease.startDate)} – {formatDate(lease.endDate)}</small></span>
        <span className={styles.timelineValue}>{formatMoney(lease.monthlyRent)}<small>/mo</small></span>
        <Badge tone={lease.status === 'ACTIVE' ? 'success' : undefined}>{lease.status[0] + lease.status.slice(1).toLowerCase()}</Badge>
      </div>)}</div> : <div className={styles.emptyLease}><strong>No lease history yet</strong><p className="muted">Create a lease to keep the unit timeline up to date.</p><Link className="btn btn-primary btn-sm" href={`/leases/new?unit=${unit.id}`}>Create lease</Link></div>}
    </Card>
  );
}

export function UnitOverview({ unit, returns, canDelete }: { unit: UnitDetail; returns: ScopedReturns; canDelete: boolean }) {
  const currentLease = unit.currentLease;
  const rentGap = unit.marketRent != null && unit.listedRent != null ? unit.marketRent - unit.listedRent : null;
  const steps = [
    ...(!currentLease ? [{ label: 'Create a lease for this unit', href: `/leases/new?unit=${unit.id}` }] : []),
    ...(unit.openRepairs ? [{ label: `${unit.openRepairs} open maintenance request${unit.openRepairs === 1 ? '' : 's'}`, href: `/maintenance?propertyId=${unit.property.id}&unitId=${unit.id}` }] : []),
    ...(rentGap != null && rentGap > 0 ? [{ label: `${formatMoney(rentGap)} below market rent`, href: `/properties/${unit.property.id}/units/${unit.id}?tab=listing` }] : []),
  ];

  return (
    <div className={styles.page}>
      <div className={styles.primary}>
        <UnitLeaseTimeline unit={unit} />
        <Card>
          <CardHeader title="Unit facts" action={<Link className="btn btn-secondary btn-sm" href="#edit-unit">Edit</Link>} />
          <dl className={styles.facts}>
            <dt>Status</dt><dd><Badge tone={statusTone(unit.status)}>{unit.status[0] + unit.status.slice(1).toLowerCase()}</Badge></dd>
            <dt>Bedrooms</dt><dd>{unit.bedrooms ?? '—'}</dd>
            <dt>Bathrooms</dt><dd>{unit.bathrooms ?? '—'}</dd>
            <dt>Size</dt><dd>{unit.squareFeet ? `${unit.squareFeet.toLocaleString('en-US')} sqft` : '—'}</dd>
            <dt>Floor</dt><dd>{unit.floor ?? '—'}</dd>
            <dt>Listed rent</dt><dd>{formatMoney(unit.listedRent)}</dd>
            <dt>Market rent</dt><dd>{formatMoney(unit.marketRent)}</dd>
            <dt>Amenities</dt><dd>{unit.amenities.length ? unit.amenities.map((amenity) => <Badge key={amenity}>{amenity}</Badge>) : '—'}</dd>
          </dl>
          <DeleteUnitControl propertyId={unit.property.id} unitId={unit.id} disabled={unit.isImplicit || !canDelete} implicit={unit.isImplicit} />
        </Card>
        <div className={styles.twoCards}>
          <Card>
            <CardHeader title="Returns at a glance" action={<Link href={`/properties/${unit.property.id}/units/${unit.id}?tab=returns`}>View returns</Link>} />
            <div className={styles.kpiRows}>
              <div><span>Net operating income</span><strong>{moneyCents(returns.metrics.noiCents)}</strong></div>
              <div><span>Cash flow</span><strong>{moneyCents(returns.metrics.cashFlowCents)}</strong></div>
              <div><span>Cap rate</span><strong>{returns.metrics.capRate == null ? '—' : `${(returns.metrics.capRate * 100).toFixed(1)}%`}</strong></div>
            </div>
            <Sparkline values={returns.monthly.map((row) => row.incomeCents)} tone="ok" label="Monthly unit income trend" />
          </Card>
          <Card>
            <CardHeader title="Payments by the numbers" action={<Link href={`/payments?propertyId=${unit.property.id}&unitId=${unit.id}`}>View payments</Link>} />
            <div className={styles.paymentNumbers}><div><p className="eyebrow">Collected · 12 mo</p><strong>{moneyCents(returns.collectedCents)}</strong></div><div><p className="eyebrow">Due · 12 mo</p><strong>{moneyCents(returns.dueCents)}</strong></div></div>
            <div className={styles.progressTrack}><span style={{ width: `${returns.dueCents ? Math.min(100, (returns.collectedCents / returns.dueCents) * 100) : 0}%` }} /></div>
            <p className="muted" style={{ fontSize: 12 }}>Collected rent compared with active lease rent scheduled for this period.</p>
          </Card>
        </div>
      </div>
      <aside className={styles.side}>
        <Card>
          <CardHeader title="Next steps" />
          {steps.length ? <ul className={styles.steps}>{steps.map((step) => <li key={step.label}><span aria-hidden="true">↗</span><Link href={step.href}>{step.label}</Link></li>)}</ul> : <div className={styles.clearState}><KpiIcon tone="green">✓</KpiIcon><p>All caught up</p><small>No urgent items need attention.</small></div>}
        </Card>
        <Card>
          <CardHeader title="Unit documents and photos" action={<Link href={`/documents?propertyId=${unit.property.id}&unitId=${unit.id}`}>View all</Link>} />
          <p className={styles.subheading}>Documents</p>
          <FileList files={unit.files} empty="No unit documents yet." />
          <p className={styles.subheading}>Photos</p>
          {unit.photos.length ? <div className={styles.photoGrid} id="photos">{unit.photos.slice(0, 4).map((photo, i) => <PhotoImage key={photo.id} photo={photo} index={i} />)}</div> : <p className="muted" id="photos">No photos uploaded yet.</p>}
          <div className={styles.uploadControls}>
            <FileUploader targetType="unit" targetId={unit.id} kind="PHOTO" label="+ Upload photos" hint="JPG, PNG up to 25 MB" compact />
            <FileUploader targetType="unit" targetId={unit.id} kind="OTHER" label="Upload document" hint="PDF, JPG, PNG, DOC up to 25 MB" />
          </div>
        </Card>
        <Card>
          <CardHeader title="Current lease" action={<Badge tone={currentLease ? 'success' : undefined}>{currentLease ? 'Active' : 'None'}</Badge>} />
          {currentLease ? <>
            <div className={styles.tenantLine}><Avatar initials={initials(currentLease.tenant?.name ?? 'Tenant')} /><div><strong>{currentLease.tenant?.name ?? 'Tenant not assigned'}</strong><small>{formatDate(currentLease.startDate)} – {formatDate(currentLease.endDate)}</small></div></div>
            <dl className={styles.facts}><dt>Rent</dt><dd>{formatMoney(currentLease.monthlyRent)} / month</dd><dt>Deposit</dt><dd>{formatMoney(currentLease.deposit)}</dd></dl>
          </> : <><p className="muted">No active lease on this unit.</p><Link className="btn btn-primary btn-sm" href={`/leases/new?unit=${unit.id}`}>Create lease</Link></>}
        </Card>
      </aside>
    </div>
  );
}
