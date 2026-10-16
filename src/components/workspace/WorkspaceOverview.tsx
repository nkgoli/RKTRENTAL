import type { ReactNode } from 'react';
import Link from 'next/link';
import { Badge, Card, CardHeader, KpiIcon } from '@/components/ui';
import { formatAddress, formatDate, formatMoney } from '@/lib/properties/format';
import type { PropertyDetail, UnitDetail } from '@/lib/properties/data';
import { ArchiveButton } from '@/app/(manager)/properties/_components/PropertyForm';
import { DeleteUnitControl } from '@/components/units/DeleteUnitControl';
import type { Timeline } from '@/lib/workspace/timeline';
import type { PaymentsMonth } from '@/lib/workspace/timeline-data';
import { PropertyFactsCard, UnitFactsCard } from './InlineFacts';
import { LeaseTimeline } from './LeaseTimeline';
import { WorkspaceMedia } from './WorkspaceMedia';
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
    <Card className={styles.strip} aria-label="Payments this month">
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
    </Card>
  );
}

function NextSteps({ steps }: { steps: { label: string; href: string }[] }) {
  return (
    <Card>
      <CardHeader title="Next steps" />
      {steps.length ? <ul className={styles.steps}>{steps.map((step) => <li key={step.label}><span aria-hidden="true">↗</span><Link href={step.href}>{step.label}</Link></li>)}</ul> : <div className={styles.clearState}><KpiIcon tone="green">✓</KpiIcon><p>All caught up</p><small>No urgent items need attention.</small></div>}
    </Card>
  );
}

function PropertyUnits({ property }: { property: PropertyDetail }) {
  const units = property.units.filter((unit) => unit.status !== 'ARCHIVED');
  return (
    <Card flush id="units">
      <CardHeader title="Units" action={<span className="muted">{property.stats.unitCount} total</span>} />
      <div className={styles.tableWrap}>
        <table className="table" aria-label="Property units">
          <thead><tr><th>Unit</th><th>Tenant</th><th className="num">Rent</th><th>Status</th><th /></tr></thead>
          <tbody>
            {units.length === 0 && <tr><td colSpan={5} className="muted">No active units yet.</td></tr>}
            {units.map((unit) => (
              <tr key={unit.id}>
                <td><Link href={`/properties/${property.id}?unit=${unit.id}`}><strong>{unit.isImplicit ? 'Whole property' : unit.number}</strong></Link></td>
                <td>{unit.tenant?.name ?? <span className="muted">None</span>}</td>
                <td className="num">{formatMoney(unit.rent ?? unit.listedRent)}</td>
                <td><Badge tone={statusTone(unit.status)}>{unit.status === 'OCCUPIED' ? 'Occupied' : unit.status === 'VACANT' ? 'Vacant' : 'Turnover'}</Badge></td>
                <td><Link className="btn btn-ghost btn-sm" href={`/properties/${property.id}?unit=${unit.id}`}>Open</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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

export function PropertyOverview({ property, owners = [], timeline, payments }: {
  property: PropertyDetail;
  owners?: { id: string; name: string }[];
  timeline?: Timeline;
  payments?: PaymentsMonth;
}) {
  const activeUnits = property.units.filter((unit) => unit.status !== 'ARCHIVED');
  const steps = [
    ...(property.stats.openRepairs ? [{ label: `${property.stats.openRepairs} repair${property.stats.openRepairs === 1 ? '' : 's'} need attention`, href: `/properties/${property.id}/maintenance` }] : []),
    ...(property.stats.expiringLeases ? [{ label: `${property.stats.expiringLeases} lease${property.stats.expiringLeases === 1 ? '' : 's'} expiring soon`, href: `/properties/${property.id}/leases` }] : []),
    ...(activeUnits.some((unit) => unit.status === 'VACANT') ? [{ label: 'Review vacant units and pricing', href: `/properties/${property.id}/listing` }] : []),
  ];
  const target = { kind: 'property' as const, id: property.id };
  const multiUnit = activeUnits.some((unit) => !unit.isImplicit);

  return (
    <div className={styles.page}>
      <TimelineCard timeline={timeline} propertyId={property.id} linkUnits={multiUnit} />
      <PaymentsStrip payments={payments} href={`/properties/${property.id}/payments`} />
      {multiUnit && <PropertyUnits property={property} />}
      <div className={styles.pair}>
        <PropertyFactsCard
          propertyId={property.id}
          owners={owners}
          address={formatAddress(property)}
          typeLabel={activeUnits.length === 1 ? 'Single-family' : 'Multi-unit'}
          unitSummary={`${activeUnits.length} · ${property.stats.occupied} occupied`}
          ownerName={property.owner?.name ?? 'Not assigned'}
          initial={{
            name: property.name, type: property.type, street: property.street,
            city: property.city, state: property.state, postalCode: property.postalCode,
            yearBuilt: property.yearBuilt, ownerId: property.owner?.id ?? null,
          }}
          footer={<ArchiveButton propertyId={property.id} archived={property.archived} />}
        />
        <NextSteps steps={steps} />
      </div>
      <Card>
        <CardHeader title="Photos & documents" />
        <WorkspaceMedia target={target} photos={property.photos} files={property.files} />
      </Card>
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
  const target = { kind: 'unit' as const, id: unit.id };

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
          footer={<DeleteUnitControl propertyId={unit.property.id} unitId={unit.id} disabled={unit.isImplicit || !canDelete} implicit={unit.isImplicit} />}
        />
        <NextSteps steps={steps} />
      </div>
      <Card>
        <CardHeader title="Photos & documents" />
        <WorkspaceMedia target={target} photos={unit.photos} files={unit.files} />
      </Card>
    </div>
  );
}
