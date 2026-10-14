import Link from 'next/link';
import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/shell/PageHeader';
import { Alert, Badge, Button, Card, CardHeader, FileRow, Stat } from '@/components/ui';
import { requireManagerRole } from '@/lib/auth/access';
import { propertiesDb } from '@/lib/properties/data';
import {
  bedBath,
  formatAddress,
  formatBytes,
  formatDate,
  formatMoney,
  propertyTypeLabel,
} from '@/lib/properties/format';
import { FileUploader } from '../_components/FileUploader';
import { FileList, PhotoImage, downloadUrl, fileKind } from '../_components/Media';
import { EditPropertyForm } from '../_components/PropertyForm';
import { AddUnitForm } from '../_components/UnitForm';

const statusBadge = {
  OCCUPIED: { tone: 'success', label: 'Occupied' },
  VACANT: { tone: 'info', label: 'Vacant' },
  TURNOVER: { tone: 'warning', label: 'Turnover' },
  ARCHIVED: { tone: 'neutral', label: 'Archived' },
} as const;

export default async function PropertyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireManagerRole();
  const { id } = await params;
  const data = propertiesDb(session.organizationId);
  const [property, owners] = await Promise.all([data.getProperty(id), data.listOwners()]);
  if (!property) notFound();

  const single = property.type === 'SINGLE_UNIT';
  const onlyUnit = single
    ? (property.units.find((u) => u.status !== 'ARCHIVED') ?? property.units[0])
    : null;
  const [hero, ...restPhotos] = property.photos;
  const unitHref = (unitId: string) => `/properties/${property.id}/units/${unitId}`;

  return (
    <>
      <PageHeader
        title={property.name}
        eyebrow="Portfolio"
        actions={[
          { label: 'Edit property', href: '#edit-property' },
          ...(single ? [] : [{ label: '+ Add unit', href: '#add-unit', primary: true }]),
        ]}
      />
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link href="/properties">Properties</Link> / {property.name}
      </nav>
      {property.archived && (
        <Alert tone="warning">
          This property is archived. Restore it from Edit property to add units.
        </Alert>
      )}

      <section className="split">
        <div className="stack">
          <div className="gallery" id="photos" style={{ gridTemplateColumns: '2fr 1fr 1fr' }}>
            {hero ? (
              <PhotoImage
                photo={hero}
                wide
                style={{ gridRow: 'span 2', aspectRatio: 'auto', minHeight: 230 }}
              />
            ) : (
              <div
                className="photo wide"
                style={{ gridRow: 'span 2', aspectRatio: 'auto', minHeight: 230 }}
              >
                <span className="caption">No photos yet</span>
              </div>
            )}
            {restPhotos.slice(0, 3).map((p, i) => (
              <PhotoImage key={p.id} photo={p} index={i + 1} />
            ))}
            <FileUploader
              targetType="property"
              targetId={property.id}
              kind="PHOTO"
              label="+ Upload photos"
              hint="JPG, PNG up to 25 MB"
              compact
            />
          </div>
          {restPhotos.length > 3 && (
            <div className="gallery">
              {restPhotos.slice(3).map((p, i) => (
                <PhotoImage key={p.id} photo={p} index={i} />
              ))}
            </div>
          )}
        </div>
        <Card>
          <CardHeader
            title="Details"
            action={
              property.archived ? <Badge>Archived</Badge> : <Badge tone="success">Active</Badge>
            }
          />
          <dl className="kv" style={{ gridTemplateColumns: '110px 1fr' }}>
            <dt>Address</dt>
            <dd>{formatAddress(property)}</dd>
            <dt>Type</dt>
            <dd>{propertyTypeLabel(property.type)}</dd>
            <dt>Units</dt>
            <dd>
              {property.stats.unitCount} ({property.stats.occupied} occupied)
            </dd>
            <dt>Year built</dt>
            <dd>{property.yearBuilt ?? '—'}</dd>
            <dt>Owner</dt>
            <dd>{property.owner?.name ?? '—'}</dd>
            <dt>Manager</dt>
            <dd>{session.name}</dd>
          </dl>
        </Card>
      </section>

      <section className="grid-4">
        <Stat
          label="Occupancy"
          value={`${property.stats.occupancy}%`}
          progress={property.stats.occupancy}
        />
        <Stat
          label="Monthly rent"
          value={formatMoney(property.stats.monthlyRent)}
          delta="From active leases"
        />
        <Stat
          label="Open repairs"
          value={property.stats.openRepairs}
          delta={
            property.stats.openRepairs ? (
              <Link href="/maintenance">View maintenance</Link>
            ) : (
              'All clear'
            )
          }
          tone={property.stats.openRepairs ? 'down' : 'up'}
        />
        <Stat
          label="Leases expiring"
          value={property.stats.expiringLeases}
          delta="next 90 days"
          tone={property.stats.expiringLeases ? 'down' : 'neutral'}
        />
      </section>

      <nav className="tabs" aria-label="Sections">
        <a className="active" href="#units">
          Units
        </a>
        <a href="#documents">Documents</a>
        <a href="#photos">Photos</a>
      </nav>

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0,3fr) minmax(0,2fr)',
          gap: 20,
          alignItems: 'start',
        }}
      >
        <div className="card flush" id="units">
          <div className="card-header">
            <h3>Units</h3>
            {!single && (
              <a className="btn btn-sm btn-secondary" href="#add-unit">
                + Add unit
              </a>
            )}
          </div>
          {single && onlyUnit && (
            <p className="muted" style={{ padding: '12px 20px 0', fontSize: 13 }}>
              A single-unit property has one unit — its details open straight from here.
            </p>
          )}
          <table className="table" style={{ marginTop: 12 }}>
            <thead>
              <tr>
                <th style={{ padding: '12px 12px 12px 20px' }}>Unit</th>
                <th style={{ padding: '12px 8px' }}>Tenant</th>
                <th className="num" style={{ padding: '12px 8px' }}>
                  Rent
                </th>
                <th style={{ padding: '12px 8px' }}>Status</th>
                <th style={{ padding: '12px 20px 12px 8px' }} />
              </tr>
            </thead>
            <tbody>
              {property.units.length === 0 && (
                <tr>
                  <td colSpan={5} className="muted">
                    No units yet. Add the first unit using the form.
                  </td>
                </tr>
              )}
              {property.units.map((u) => {
                const badge = statusBadge[u.status];
                return (
                  <tr key={u.id}>
                    <td style={{ padding: '14px 12px 14px 20px' }}>
                      <strong>
                        <Link href={unitHref(u.id)}>
                          {u.isImplicit ? 'Whole property' : u.number}
                        </Link>
                      </strong>
                      <br />
                      <small className="muted">{bedBath(u)}</small>
                    </td>
                    <td style={{ padding: '14px 8px' }}>
                      {u.tenant ? (
                        <Link href={`/tenants/${u.tenant.id}`}>{u.tenant.name}</Link>
                      ) : (
                        <span className="muted">None</span>
                      )}
                    </td>
                    <td className="num" style={{ padding: '14px 8px' }}>
                      {formatMoney(u.rent ?? u.listedRent)}
                    </td>
                    <td style={{ padding: '14px 8px' }}>
                      <span className={`badge ${badge.tone === 'neutral' ? '' : badge.tone}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td style={{ padding: '14px 20px 14px 8px' }}>
                      <Link
                        className="btn btn-sm btn-ghost"
                        href={unitHref(u.id)}
                        aria-label={`Open unit ${u.number}`}
                      >
                        {single ? 'Open' : 'Edit'}
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="muted" style={{ padding: '12px 20px', fontSize: 13 }}>
            Showing {property.units.length} of {property.units.length} units
          </p>
        </div>

        <div className="stack">
          {!single && !property.archived && <AddUnitForm propertyId={property.id} />}

          <Card id="documents">
            <CardHeader title="Documents" action={<Link href="/documents">View all</Link>} />
            <p className="muted" style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
              Property files
            </p>
            <FileList files={property.files} empty="No property files yet." />
            <p className="muted" style={{ fontSize: 12, fontWeight: 600, margin: '12px 0 4px' }}>
              Lease documents
            </p>
            {property.leaseDocuments.length === 0 && (
              <p className="muted" style={{ fontSize: 13 }}>
                No lease documents yet.
              </p>
            )}
            {property.leaseDocuments.map((d) => (
              <FileRow
                key={d.id}
                kind={fileKind(d.mimeType)}
                name={d.name}
                meta={`${d.tenantName ?? 'Lease'} · Unit ${d.unitNumber} · ${formatDate(d.createdAt)} · ${formatBytes(d.sizeBytes)}`}
                action={
                  <>
                    <Button size="sm" href={downloadUrl(d.id)}>
                      Download
                    </Button>
                    <Button size="sm" href={`/leases/${d.leaseId}`}>
                      Open lease
                    </Button>
                  </>
                }
              />
            ))}
            <div style={{ marginTop: 12 }}>
              <FileUploader
                targetType="property"
                targetId={property.id}
                kind="OTHER"
                label="Upload document"
                hint="PDF, JPG, PNG, DOC up to 25 MB"
              />
            </div>
          </Card>
        </div>
      </section>

      <EditPropertyForm
        propertyId={property.id}
        archived={property.archived}
        owners={owners}
        initial={{
          name: property.name,
          type: property.type,
          street: property.street,
          city: property.city,
          state: property.state,
          postalCode: property.postalCode,
          yearBuilt: property.yearBuilt,
          ownerId: property.owner?.id ?? null,
        }}
      />
    </>
  );
}
