import Link from 'next/link';
import { Avatar, Badge, Card, CardHeader, KpiIcon } from '@/components/ui';
import { formatAddress, formatDate, formatMoney, initials } from '@/lib/properties/format';
import type { PropertyDetail, UnitDetail } from '@/lib/properties/data';
import { FileList } from '@/app/(manager)/properties/_components/Media';
import { FilesUploader } from '@/app/(manager)/properties/_components/ManagedUploads';
import { ArchiveButton } from '@/app/(manager)/properties/_components/PropertyForm';
import { photoLimitForTarget } from '@/lib/storage/photo-limits';
import { DeleteUnitControl } from '@/components/units/DeleteUnitControl';
import { PropertyFactsCard, UnitFactsCard } from './InlineFacts';
import styles from './WorkspaceOverview.module.css';

type LeaseFact = { id: string; leaseStartDate: Date | null; leaseEndDate: Date | null; tenantName: string | null };

function statusTone(status: string): 'success' | 'warning' | 'info' | undefined {
  if (status === 'OCCUPIED') return 'success';
  if (status === 'VACANT') return 'info';
  if (status === 'TURNOVER') return 'warning';
  return undefined;
}

function leaseTerm(fact?: LeaseFact) {
  return fact?.leaseStartDate && fact.leaseEndDate ? `${formatDate(fact.leaseStartDate)} – ${formatDate(fact.leaseEndDate)}` : null;
}

function NextSteps({ steps }: { steps: { label: string; href: string }[] }) {
  return (
    <Card>
      <CardHeader title="Next steps" />
      {steps.length ? <ul className={styles.steps}>{steps.map((step) => <li key={step.label}><span aria-hidden="true">↗</span><Link href={step.href}>{step.label}</Link></li>)}</ul> : <div className={styles.clearState}><KpiIcon tone="green">✓</KpiIcon><p>All caught up</p><small>No urgent items need attention.</small></div>}
    </Card>
  );
}

function PropertyUnits({ property, leaseFacts }: { property: PropertyDetail; leaseFacts: LeaseFact[] }) {
  const units = property.units.filter((unit) => unit.status !== 'ARCHIVED');
  return (
    <Card flush id="units">
      <CardHeader title="Units" action={<span className="muted">{property.stats.unitCount} total</span>} />
      <div className={styles.tableWrap}>
        <table className="table" aria-label="Property units">
          <thead><tr><th>Unit</th><th>Tenant</th><th>Lease term</th><th className="num">Rent</th><th>Status</th><th /></tr></thead>
          <tbody>
            {units.length === 0 && <tr><td colSpan={6} className="muted">No active units yet.</td></tr>}
            {units.map((unit) => (
              <tr key={unit.id}>
                <td><Link href={`/properties/${property.id}?unit=${unit.id}`}><strong>{unit.isImplicit ? 'Whole property' : unit.number}</strong></Link></td>
                <td>{unit.tenant?.name ?? <span className="muted">None</span>}</td>
                <td>{leaseTerm(leaseFacts.find((fact) => fact.id === unit.id)) ?? <span className="muted">{unit.status === 'VACANT' ? 'Available' : '—'}</span>}</td>
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

export function PropertyOverview({ property, owners = [], leaseFacts = [] }: {
  property: PropertyDetail;
  owners?: { id: string; name: string }[];
  leaseFacts?: LeaseFact[];
}) {
  const activeUnits = property.units.filter((unit) => unit.status !== 'ARCHIVED');
  const steps = [
    ...(property.stats.openRepairs ? [{ label: `${property.stats.openRepairs} repair${property.stats.openRepairs === 1 ? '' : 's'} need attention`, href: `/properties/${property.id}/maintenance` }] : []),
    ...(property.stats.expiringLeases ? [{ label: `${property.stats.expiringLeases} lease${property.stats.expiringLeases === 1 ? '' : 's'} expiring soon`, href: `/properties/${property.id}/leases` }] : []),
    ...(activeUnits.some((unit) => unit.status === 'VACANT') ? [{ label: 'Review vacant units and pricing', href: `/properties/${property.id}/listing` }] : []),
  ];
  const target = { kind: 'property' as const, id: property.id };

  return (
    <div className={styles.page}>
      <div className={styles.primary}>
        <PropertyUnits property={property} leaseFacts={leaseFacts} />
      </div>
      <aside className={styles.side}>
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
        <Card>
          <CardHeader title="Documents and photos" action={<Link href={`/properties/${property.id}/documents`}>View all</Link>} />
          <FileList files={property.files} empty="No property files yet." />
          {property.leaseDocuments.length > 0 && <p className={styles.documentHint}>{property.leaseDocuments.length} lease document{property.leaseDocuments.length === 1 ? '' : 's'} on file</p>}
          <div className={styles.uploadControls} id="photos">
            <FilesUploader target={target} photos={property.photos} max={photoLimitForTarget(target)} />
          </div>
        </Card>
      </aside>
    </div>
  );
}

function UnitLeaseCard({ unit }: { unit: UnitDetail }) {
  const current = unit.currentLease;
  const previous = unit.leaseHistory.filter((lease) => lease.id !== current?.id);
  return (
    <Card>
      <CardHeader title="Lease" action={current ? <Link href={`/leases/${current.id}?propertyId=${unit.property.id}&unitId=${unit.id}`}>View lease</Link> : <Link href={`/leases/new?unit=${unit.id}`}>Create lease</Link>} />
      {current ? <>
        <div className={styles.tenantLine}>
          <Avatar initials={initials(current.tenant?.name ?? 'Tenant')} />
          <div><strong>{current.tenant ? <Link href={`/tenants/${current.tenant.id}`}>{current.tenant.name}</Link> : 'Tenant not assigned'}</strong><small>{formatDate(current.startDate)} – {formatDate(current.endDate)}</small></div>
          <Badge tone="success">Active</Badge>
        </div>
        <dl className={styles.facts}><dt>Rent</dt><dd>{formatMoney(current.monthlyRent)} / month</dd><dt>Deposit</dt><dd>{formatMoney(current.deposit)}</dd></dl>
      </> : <div className={styles.emptyLease}><strong>No active lease on this unit.</strong><p className="muted">Create a lease to keep the unit timeline up to date.</p><Link className="btn btn-primary btn-sm" href={`/leases/new?unit=${unit.id}`}>Create lease</Link></div>}
      {previous.length > 0 && <>
        <p className={styles.subheading}>Previous leases</p>
        <div className={styles.leaseTimeline}>{previous.map((lease) => <div className={styles.leaseTimelineRow} key={lease.id}>
          <span className={styles.timelineDot} data-status="VACANT" />
          <span className={styles.timelineMain}><strong>{lease.tenantName}</strong><small>{formatDate(lease.startDate)} – {formatDate(lease.endDate)}</small></span>
          <span className={styles.timelineValue}>{formatMoney(lease.monthlyRent)}<small>/mo</small></span>
          <Badge>{lease.status[0] + lease.status.slice(1).toLowerCase()}</Badge>
        </div>)}</div>
      </>}
    </Card>
  );
}

export function UnitOverview({ unit, canDelete }: { unit: UnitDetail; canDelete: boolean }) {
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
      <div className={styles.primary}>
        <UnitLeaseCard unit={unit} />
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
      </div>
      <aside className={styles.side}>
        <NextSteps steps={steps} />
        <Card>
          <CardHeader title="Unit documents and photos" action={<Link href={`/properties/${unit.property.id}/documents?unit=${unit.id}`}>View all</Link>} />
          <FileList files={unit.files} empty="No unit documents yet." />
          <div className={styles.uploadControls} id="photos">
            <FilesUploader target={target} photos={unit.photos} max={photoLimitForTarget(target)} />
          </div>
        </Card>
      </aside>
    </div>
  );
}
