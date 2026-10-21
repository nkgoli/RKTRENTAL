import type { ReactNode } from 'react';
import Link from 'next/link';
import { Badge, Card, CardHeader, Pagination, pageFrom, paginate } from '@/components/ui';
import { bedBath, formatAddress, formatDate, formatMoney } from '@/lib/properties/format';
import type { PropertyDetail, UnitDetail } from '@/lib/properties/data';
import { ArchiveButton } from '@/app/(manager)/properties/_components/PropertyForm';
import { DeleteUnitControl } from '@/components/units/DeleteUnitControl';
import type { Timeline } from '@/lib/workspace/timeline';
import type { PaymentsMonth } from '@/lib/workspace/timeline-data';
import { PropertyFactsCard, UnitFactsCard } from './InlineFacts';
import { LeaseTimeline } from './LeaseTimeline';
import { AddUnitDialog } from '@/app/(manager)/properties/_components/AddUnitDialog';
import styles from './WorkspaceOverview.module.css';

function statusTone(status: string): 'success' | 'warning' | 'info' | undefined {
  if (status === 'OCCUPIED') return 'success';
  if (status === 'VACANT') return 'info';
  if (status === 'TURNOVER') return 'warning';
  return undefined;
}

const dollars = (cents: number) => formatMoney(cents / 100);

/** Compact strip from the ledger: what was collected against this month's charges. */
function PaymentsStrip({ payments, href }: { payments?: PaymentsMonth; href: string }) {
  if (!payments) return null;
  const pct = payments.dueCents > 0 ? Math.min(100, Math.round((payments.paidCents / payments.dueCents) * 100)) : 0;
  return (
    <section className={styles.strip} aria-label="Payments this month">
      <div className={styles.stripHead}>
        <h3>Payments this month</h3>
        <Link href={href}>View payments</Link>
      </div>
      {payments.hasCharges ? <>
        <div className={styles.stripNumbers}>
          <span><strong>{dollars(payments.paidCents)}</strong> collected of {dollars(payments.dueCents)}</span>
          <span className={payments.outstandingCents ? styles.owed : 'muted'}>
            {payments.outstandingCents ? `${dollars(payments.outstandingCents)} outstanding${payments.lateCount ? ` · ${payments.lateCount} late` : ''}` : 'All paid'}
          </span>
        </div>
        <div className={styles.bar} role="progressbar" aria-label="Collected this month" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${pct}%` }} /></div>
      </> : <p className="muted">No rent charges due this month.</p>}
    </section>
  );
}

function NextSteps({ steps }: { steps: { label: string; href: string }[] }) {
  return (
    <Card className={styles.nextSteps}>
      <CardHeader title="Next steps" />
      {steps.length ? <ul className={styles.steps}>{steps.map((step) => <li key={step.label}><span aria-hidden="true">↗</span><Link href={step.href}>{step.label}</Link></li>)}</ul> : <div className={styles.clearState}><p>All caught up</p><small>No urgent items need attention.</small></div>}
    </Card>
  );
}

function initials(name: string) {
  return name.split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase();
}

function PropertyUnits({ property, page: pageParam }: { property: PropertyDetail; page?: string }) {
  const all = property.units.filter((unit) => unit.status !== 'ARCHIVED');
  const page = pageFrom(pageParam, all.length);
  const units = paginate(all, page);
  return (
    <Card flush id="units">
      <CardHeader title="Units" action={<div className={styles.unitActions}><span className="muted">{all.length} total · {property.stats.occupied} occupied</span>{!property.archived && <AddUnitDialog propertyId={property.id} />}</div>} />
      <div className={styles.unitCards}>
        {units.length === 0 && <p className="muted">No active units yet.</p>}
        {units.map((unit) => (
          <article key={unit.id} className={styles.unitCard}>
            <div className={styles.unitCardTop}>
              <Link href={`/properties/${property.id}?unit=${unit.id}`}>Unit {unit.isImplicit ? 'Whole property' : unit.number}</Link>
              <Badge tone={statusTone(unit.status)}>{unit.status === 'OCCUPIED' ? 'Occupied' : unit.status === 'VACANT' ? 'Vacant' : 'Turnover'}</Badge>
            </div>
            <div className={styles.unitCardFacts}>
              <div><small>Configuration</small>{unit.bedrooms == null && unit.bathrooms == null ? <Link href={`/properties/${property.id}?unit=${unit.id}`}>Add details</Link> : bedBath(unit)}{unit.squareFeet ? ` · ${unit.squareFeet.toLocaleString('en-US')} sqft` : ''}</div>
              <div><small>Rent / month</small><strong>{formatMoney(unit.rent ?? unit.listedRent)}</strong></div>
              <div><small>Tenant</small>{unit.tenant ? <Link href={`/tenants/${unit.tenant.id}`}>{unit.tenant.name}</Link> : 'No tenant'}</div>
            </div>
            <Link className="btn btn-secondary btn-sm" aria-label={`Open unit ${unit.number}`} href={`/properties/${property.id}?unit=${unit.id}`}>Open unit {unit.number}</Link>
          </article>
        ))}
      </div>
      <div className={styles.tableWrap} role="region" aria-label="Property units table" tabIndex={0}>
        <table className="table" aria-label="Property units">
          <thead><tr><th scope="col">Unit</th><th scope="col">Tenant</th><th scope="col" className="num">Rent / month</th><th scope="col">Status</th><th scope="col" aria-label="Open unit" /></tr></thead>
          <tbody>
            {units.length === 0 && <tr><td colSpan={5} className="muted">No active units yet.</td></tr>}
            {units.map((unit) => (
              <tr key={unit.id}>
                <td><Link href={`/properties/${property.id}?unit=${unit.id}`}><strong>{unit.isImplicit ? 'Whole property' : unit.number}</strong></Link><small className={styles.unitConfiguration}>{unit.bedrooms == null && unit.bathrooms == null ? <Link href={`/properties/${property.id}?unit=${unit.id}`}>Add details</Link> : bedBath(unit)}{unit.squareFeet ? ` · ${unit.squareFeet.toLocaleString('en-US')} sqft` : ''}</small></td>
                <td>{unit.tenant ? <span className={styles.person}><span className={styles.personMark} aria-hidden="true">{initials(unit.tenant.name)}</span><Link href={`/tenants/${unit.tenant.id}`}>{unit.tenant.name}</Link></span> : <span className="muted">No tenant</span>}</td>
                <td className="num">{formatMoney(unit.rent ?? unit.listedRent)}</td>
                <td><Badge tone={statusTone(unit.status)}>{unit.status === 'OCCUPIED' ? 'Occupied' : unit.status === 'VACANT' ? 'Vacant' : 'Turnover'}</Badge></td>
                <td><Link className="btn btn-ghost btn-sm" aria-label={`Open unit ${unit.number}`} href={`/properties/${property.id}?unit=${unit.id}`}>Open</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Pagination page={page} total={all.length} noun="units" href={(p) => `/properties/${property.id}?unitsPage=${p}#units`} />
    </Card>
  );
}

function TimelineCard({ timeline, propertyId, linkUnits, footer }: { timeline?: Timeline; propertyId: string; linkUnits?: boolean; footer?: ReactNode }) {
  if (!timeline) return null;
  return (
    <Card aria-label="Lease timeline">
      <CardHeader title="Lease timeline" />
      <LeaseTimeline timeline={timeline} propertyId={propertyId} linkUnits={linkUnits} />
      {footer}
    </Card>
  );
}

export function PropertyOverview({ property, owners = [], timeline, payments, unitsPage }: {
  property: PropertyDetail;
  owners?: { id: string; name: string }[];
  timeline?: Timeline;
  payments?: PaymentsMonth;
  unitsPage?: string;
}) {
  const activeUnits = property.units.filter((unit) => unit.status !== 'ARCHIVED');
  const steps = [
    ...(property.stats.openRepairs ? [{ label: `${property.stats.openRepairs} repair${property.stats.openRepairs === 1 ? '' : 's'} need attention`, href: `/properties/${property.id}/maintenance` }] : []),
    ...(property.stats.expiringLeases ? [{ label: `${property.stats.expiringLeases} lease${property.stats.expiringLeases === 1 ? '' : 's'} expiring soon`, href: `/properties/${property.id}/leases` }] : []),
    ...(activeUnits.some((unit) => unit.status === 'VACANT') ? [{ label: 'Review vacant units and pricing', href: `/properties/${property.id}/listing` }] : []),
  ];
  const multiUnit = activeUnits.some((unit) => !unit.isImplicit);

  const occupancyPct = activeUnits.length ? Math.round((property.stats.occupied / activeUnits.length) * 100) : 0;
  return (
    <div className={styles.page}>
      <section className={styles.summary} aria-label="Property at a glance">
        <div className={styles.occupancy}>
          <span className={styles.occupancyTile} aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 21V4h10v17M14 9h6v12M2 21h20M8 8h2M8 12h2M8 16h2M17 13h1M17 17h1" /></svg></span>
          <div><small>Property occupancy</small><p><strong className={styles.metric}>{occupancyPct}%</strong>{property.stats.occupied} of {activeUnits.length} occupied</p></div>
        </div>
        <PaymentsStrip payments={payments} href={`/properties/${property.id}/payments`} />
      </section>
      <TimelineCard timeline={timeline} propertyId={property.id} linkUnits={multiUnit} />
      {multiUnit && <PropertyUnits property={property} page={unitsPage} />}
      <div className={styles.pair}>
        <PropertyFactsCard
          propertyId={property.id}
          owners={owners}
          address={formatAddress(property)}
          typeLabel={property.type === 'SINGLE_UNIT' ? 'Single-family' : 'Multi-unit'}
          unitSummary={`${activeUnits.length} · ${property.stats.occupied} occupied`}
          ownerName={property.owner?.name ?? 'Not assigned'}
          initial={{
            name: property.name, type: property.type, street: property.street,
            city: property.city, state: property.state, postalCode: property.postalCode,
            yearBuilt: property.yearBuilt, ownerId: property.owner?.id ?? null,
          }}
          footer={<ArchiveButton propertyId={property.id} propertyName={property.name} archived={property.archived} />}
        />
        <NextSteps steps={steps} />
      </div>

    </div>
  );
}

function UnitLeaseSummary({ unit }: { unit: UnitDetail }) {
  const current = unit.currentLease;
  if (!current) {
    return <div className={styles.emptyLease}>
      <strong>No active lease on this unit.</strong>
      <p className="muted">Set up a lease to start collecting rent.</p>
      <Link className="btn btn-primary btn-sm" href={`/leases/new?unit=${unit.id}`}>Create lease</Link>
    </div>;
  }
  return <p className={styles.leaseLine}>
    <strong>{current.tenant ? <Link href={`/tenants/${current.tenant.id}`}>{current.tenant.name}</Link> : 'Tenant not assigned'}</strong>
    <span className="muted">{formatDate(current.startDate)} – {formatDate(current.endDate)} · {formatMoney(current.monthlyRent)} / month · Deposit {formatMoney(current.deposit)}</span>
    <Link href={`/leases/${current.id}?propertyId=${unit.property.id}&unitId=${unit.id}`}>View lease</Link>
  </p>;
}

export function UnitOverview({ unit, canDelete, timeline, payments }: {
  unit: UnitDetail;
  canDelete: boolean;
  timeline?: Timeline;
  payments?: PaymentsMonth;
}) {
  const currentLease = unit.currentLease;
  const rentGap = unit.marketRent != null && unit.listedRent != null ? unit.marketRent - unit.listedRent : null;
  const steps = [
    ...(!currentLease ? [{ label: 'Create a lease for this unit', href: `/leases/new?unit=${unit.id}` }] : []),
    ...(unit.openRepairs ? [{ label: `${unit.openRepairs} open maintenance request${unit.openRepairs === 1 ? '' : 's'}`, href: `/properties/${unit.property.id}/maintenance?unit=${unit.id}` }] : []),
    ...(rentGap != null && rentGap > 0 ? [{ label: `${formatMoney(rentGap)} below market rent`, href: `/properties/${unit.property.id}/listing?unit=${unit.id}` }] : []),
  ];

  return (
    <div className={styles.page}>
      {timeline
        ? <TimelineCard timeline={timeline} propertyId={unit.property.id} footer={<UnitLeaseSummary unit={unit} />} />
        : <Card><CardHeader title="Lease timeline" /><UnitLeaseSummary unit={unit} /></Card>}
      <PaymentsStrip payments={payments} href={`/properties/${unit.property.id}/payments?unit=${unit.id}`} />
      <div className={styles.pair}>
        <UnitFactsCard
          propertyId={unit.property.id}
          unitId={unit.id}
          implicit={unit.isImplicit}
          hasActiveLease={!!currentLease}
          initial={{
            number: unit.number, status: unit.status, bedrooms: unit.bedrooms, bathrooms: unit.bathrooms,
            squareFeet: unit.squareFeet, listedRent: unit.listedRent, marketRent: unit.marketRent,
            floor: unit.floor, amenities: unit.amenities,
          }}
          footer={<DeleteUnitControl propertyId={unit.property.id} unitId={unit.id} unitLabel={unit.number} disabled={unit.isImplicit || !canDelete} implicit={unit.isImplicit} />}
        />
        <NextSteps steps={steps} />
      </div>

    </div>
  );
}
