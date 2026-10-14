import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/shell/PageHeader';
import { Avatar, Badge, Card, CardHeader, Stat } from '@/components/ui';
import { requireManagerRole } from '@/lib/auth/access';
import { propertiesDb } from '@/lib/properties/data';
import { formatDate, formatMonth, formatMoney, initials, unitLabel } from '@/lib/properties/format';
import { FileUploader } from '../../../_components/FileUploader';
import { FileList, PhotoImage } from '../../../_components/Media';
import { EditUnitForm } from '../../../_components/UnitForm';

const unitStatus = {
  OCCUPIED: { tone: 'success', label: 'Occupied' },
  VACANT: { tone: 'info', label: 'Vacant' },
  TURNOVER: { tone: 'warning', label: 'Turnover' },
  ARCHIVED: { tone: 'neutral', label: 'Archived' },
} as const;

const leaseBadge = {
  ACTIVE: { tone: 'success', label: 'Active' },
  DRAFT: { tone: 'info', label: 'Draft' },
  ENDED: { tone: 'neutral', label: 'Ended' },
  TERMINATED: { tone: 'neutral', label: 'Terminated' },
} as const;

const requestBadge = {
  NEW: { tone: 'warning', label: 'Open' },
  ASSIGNED: { tone: 'warning', label: 'Assigned' },
  IN_PROGRESS: { tone: 'warning', label: 'In progress' },
  DONE: { tone: 'success', label: 'Done' },
  CANCELLED: { tone: 'neutral', label: 'Cancelled' },
} as const;

const DAY = 24 * 3600 * 1000;

function leaseEndNote(end: Date): string {
  const days = Math.ceil((end.getTime() - Date.now()) / DAY);
  if (days < 0) return 'Past end date';
  if (days <= 90) return `Expiring soon · ${days} ${days === 1 ? 'day' : 'days'} left`;
  return `${Math.round(days / 30)} months left`;
}

export default async function UnitDetailPage({
  params,
}: {
  params: Promise<{ id: string; unitId: string }>;
}) {
  const session = await requireManagerRole();
  const { id, unitId } = await params;
  const unit = await propertiesDb(session.organizationId).getUnit(id, unitId);
  if (!unit) notFound();

  const lease = unit.currentLease;
  const status = unitStatus[unit.status];
  const label = unitLabel(unit.property, unit);

  return (
    <>
      <PageHeader
        title={label}
        eyebrow="Portfolio"
        actions={[
          { label: 'Edit unit', href: '#edit-unit' },
          { label: 'Rent comps', href: '/rent-comps' },
          { label: 'Create lease', href: `/leases/new?unit=${unit.id}`, primary: true },
        ]}
      />
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link href="/properties">Properties</Link> /{' '}
        <Link href={`/properties/${unit.property.id}`}>{unit.property.name}</Link>
        {!unit.isImplicit && <> / Unit {unit.number}</>}
      </nav>
      <div className="row">
        <Badge tone={status.tone === 'neutral' ? undefined : status.tone}>{status.label}</Badge>
        {unit.property.archived && <Badge>Property archived</Badge>}
      </div>

      <section className="grid-4">
        <Stat label="Current rent" value={formatMoney(lease?.monthlyRent)} delta="per month" />
        <Stat
          label="Listed rent"
          value={formatMoney(unit.listedRent)}
          delta={
            unit.listedRent != null && lease
              ? unit.listedRent === lease.monthlyRent
                ? 'Matches current rent'
                : `${formatMoney(Math.abs(unit.listedRent - lease.monthlyRent))} ${unit.listedRent > lease.monthlyRent ? 'above' : 'below'} current`
              : 'Asking rent'
          }
          tone={
            unit.listedRent != null && lease && unit.listedRent > lease.monthlyRent
              ? 'up'
              : 'neutral'
          }
        />
        <Stat
          label="Lease ends"
          value={lease ? formatDate(lease.endDate) : '—'}
          delta={lease ? leaseEndNote(lease.endDate) : 'No active lease'}
        />
        <Stat
          label="Open repairs"
          value={unit.openRepairs}
          delta={unit.openRepairs ? 'Needs attention' : 'All clear'}
          tone={unit.openRepairs ? 'down' : 'up'}
        />
      </section>

      <section className="split">
        <div className="stack">
          <Card id="edit-unit">
            <CardHeader title="Unit facts" />
            <dl className="kv" style={{ gridTemplateColumns: '110px 1fr', marginBottom: 16 }}>
              <dt>Bedrooms</dt>
              <dd>{unit.bedrooms ?? '—'}</dd>
              <dt>Bathrooms</dt>
              <dd>{unit.bathrooms ?? '—'}</dd>
              <dt>Size</dt>
              <dd>{unit.squareFeet ? `${unit.squareFeet.toLocaleString('en-US')} sqft` : '—'}</dd>
              <dt>Floor</dt>
              <dd>{unit.floor ?? '—'}</dd>
              <dt>Listed rent</dt>
              <dd>{formatMoney(unit.listedRent)}</dd>
              <dt>Market rent</dt>
              <dd>
                {formatMoney(unit.marketRent)}
                {unit.marketRent != null && unit.listedRent != null && (
                  <span className="muted">
                    {' '}
                    ·{' '}
                    {unit.listedRent === unit.marketRent
                      ? 'at market'
                      : `${formatMoney(Math.abs(unit.listedRent - unit.marketRent))} ${unit.listedRent > unit.marketRent ? 'above' : 'below'} market`}
                  </span>
                )}
              </dd>
              <dt>Amenities</dt>
              <dd>
                {unit.amenities.length ? (
                  <span className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                    {unit.amenities.map((a) => (
                      <Badge key={a}>{a}</Badge>
                    ))}
                  </span>
                ) : (
                  '—'
                )}
              </dd>
            </dl>
            <EditUnitForm
              propertyId={unit.property.id}
              unitId={unit.id}
              implicit={unit.isImplicit}
              hasActiveLease={!!lease}
              initial={{
                number: unit.number,
                bedrooms: unit.bedrooms,
                bathrooms: unit.bathrooms,
                squareFeet: unit.squareFeet,
                listedRent: unit.listedRent,
                marketRent: unit.marketRent,
                floor: unit.floor,
                amenities: unit.amenities,
                status: unit.status,
              }}
            />
          </Card>

          <Card id="photos">
            <CardHeader title="Unit photos" />
            <div className="gallery">
              {unit.photos.map((p, i) => (
                <PhotoImage key={p.id} photo={p} index={i} />
              ))}
              <FileUploader
                targetType="unit"
                targetId={unit.id}
                kind="PHOTO"
                label="+ Upload photos"
                hint="JPG, PNG up to 25 MB"
                compact
              />
            </div>
          </Card>
        </div>

        <div className="stack">
          <Card>
            <CardHeader
              title="Current lease"
              action={lease ? <Badge tone="success">Active</Badge> : <Badge>None</Badge>}
            />
            {lease ? (
              <>
                {lease.tenant && (
                  <div className="list-item" style={{ paddingTop: 0 }}>
                    <Avatar initials={initials(lease.tenant.name)} />
                    <div>
                      <Link href={`/tenants/${lease.tenant.id}`}>
                        <strong>{lease.tenant.name}</strong>
                      </Link>
                      <br />
                      <small className="muted">{lease.tenant.email ?? 'No email on file'}</small>
                    </div>
                  </div>
                )}
                <dl className="kv" style={{ gridTemplateColumns: '90px 1fr', marginTop: 12 }}>
                  <dt>Term</dt>
                  <dd>
                    {formatDate(lease.startDate)} – {formatDate(lease.endDate)}
                  </dd>
                  <dt>Rent</dt>
                  <dd>{formatMoney(lease.monthlyRent)} / month</dd>
                  <dt>Deposit</dt>
                  <dd>{formatMoney(lease.deposit)}</dd>
                  <dt>Status</dt>
                  <dd>Active</dd>
                </dl>
                <div className="row" style={{ marginTop: 16 }}>
                  <Link className="btn btn-secondary btn-sm" href={`/leases/${lease.id}`}>
                    View lease
                  </Link>
                  {lease.tenant && (
                    <Link className="btn btn-ghost btn-sm" href={`/tenants/${lease.tenant.id}`}>
                      View tenant
                    </Link>
                  )}
                </div>
              </>
            ) : (
              <>
                <p className="muted">No active lease on this unit.</p>
                <div className="row" style={{ marginTop: 12 }}>
                  <Link className="btn btn-primary btn-sm" href={`/leases/new?unit=${unit.id}`}>
                    Create lease
                  </Link>
                </div>
              </>
            )}
          </Card>

          <Card>
            <CardHeader title="Unit documents" action={<Link href="/documents">View all</Link>} />
            <FileList files={unit.files} empty="No documents for this unit yet." />
            <div style={{ marginTop: 12 }}>
              <FileUploader
                targetType="unit"
                targetId={unit.id}
                kind="OTHER"
                label="Upload document"
                hint="PDF, JPG, PNG, DOC up to 25 MB"
              />
            </div>
          </Card>
        </div>
      </section>

      <section className="grid-2" style={{ alignItems: 'start' }}>
        <div className="card flush">
          <div className="card-header">
            <h3>Lease history</h3>
          </div>
          <table className="table" style={{ marginTop: 12 }}>
            <thead>
              <tr>
                <th>Tenant</th>
                <th>Term</th>
                <th className="num">Rent</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {unit.leaseHistory.length === 0 && (
                <tr>
                  <td colSpan={4} className="muted">
                    No leases yet.
                  </td>
                </tr>
              )}
              {unit.leaseHistory.map((l) => {
                const b = leaseBadge[l.status];
                return (
                  <tr key={l.id}>
                    <td>
                      <Link href={`/leases/${l.id}`}>{l.tenantName}</Link>
                    </td>
                    <td>
                      {formatMonth(l.startDate)} – {formatMonth(l.endDate)}
                    </td>
                    <td className="num">{formatMoney(l.monthlyRent)}</td>
                    <td>
                      <Badge tone={b.tone === 'neutral' ? undefined : b.tone}>{b.label}</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="card flush">
          <div className="card-header">
            <h3>Maintenance for this unit</h3>
            <Link href="/maintenance">View all</Link>
          </div>
          <table className="table" style={{ marginTop: 12 }}>
            <thead>
              <tr>
                <th>Request</th>
                <th>Opened</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {unit.maintenance.length === 0 && (
                <tr>
                  <td colSpan={3} className="muted">
                    No maintenance requests.
                  </td>
                </tr>
              )}
              {unit.maintenance.map((m) => {
                const b = requestBadge[m.status];
                return (
                  <tr key={m.id}>
                    <td>
                      <Link href="/maintenance">{m.title}</Link>
                    </td>
                    <td>{formatDate(m.createdAt)}</td>
                    <td>
                      <Badge tone={b.tone === 'neutral' ? undefined : b.tone}>{b.label}</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {unit.property.type === 'SINGLE_UNIT' && (
        <p className="muted" style={{ fontSize: 13 }}>
          {unit.property.name} is a single-unit property, so this page is its one unit.
        </p>
      )}
    </>
  );
}
