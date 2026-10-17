import Link from 'next/link';
import { EmptyState } from '@/components/RouteStates';
import { db } from '@/lib/db/client';
import { requireManagerRole } from '@/lib/auth/access';
import { PageHeader } from '@/components/shell/PageHeader';
import { ScopedWorkspace } from '@/components/workspace/ScopedWorkspace';
import { scopeFilterFrom } from '@/lib/workspace/scope';
import {
  Badge,
  Card,
  CardHeader,
  Chip,
  Chips,
  FileRow,
  Gallery,
  Pagination,
  Progress,
  pageFrom,
  paginate,
  TrendChip,
} from '@/components/ui';
import { PhotoImage, fileKind } from '@/app/(manager)/properties/_components/Media';
import { formatBytes, formatDate } from '@/lib/properties/format';
import {
  DOCUMENT_KINDS,
  documentProperty,
  documentUnit,
  filterLibraryDocuments,
  groupLeaseDocuments,
  photoDocuments,
  propertyDocuments,
  type LibraryDocument,
  type LibraryDocumentKind,
} from '@/lib/documents/library';
import { UploadDocumentForm } from './UploadDocumentForm';
import styles from './documents.module.css';

const STORAGE_LIMIT = 10 * 1024 ** 3;
const KIND_LABELS: Record<LibraryDocumentKind, string> = {
  LEASE: 'Lease',
  ADDENDUM: 'Addendum',
  DISCLOSURE: 'Disclosure',
  NOTICE: 'Notice',
  INSPECTION: 'Inspection',
  ID: 'ID',
  PHOTO: 'Photo',
  OTHER: 'Other',
};

type KindFilter = LibraryDocumentKind | 'ALL';
type SearchParams = {
  q?: string;
  kind?: string;
  propertyId?: string;
  unitId?: string;
  sort?: string;
  leasePage?: string;
  filesPage?: string;
  photoPage?: string;
};

const LEASE_GROUPS_PER_PAGE = 10;
const PAGE_KEYS = ['leasePage', 'filesPage', 'photoPage'] as const;

function kindFromParam(value?: string): KindFilter {
  return value && DOCUMENT_KINDS.includes(value as (typeof DOCUMENT_KINDS)[number])
    ? (value as LibraryDocumentKind)
    : 'ALL';
}

function documentsHref(filters: SearchParams, overrides: Partial<SearchParams> = {}) {
  const next = { ...filters, ...overrides };
  const params = new URLSearchParams();
  if (next.q?.trim()) params.set('q', next.q.trim());
  if (next.kind && next.kind !== 'ALL') params.set('kind', next.kind);
  if (next.propertyId) params.set('propertyId', next.propertyId);
  if (next.unitId) params.set('unitId', next.unitId);
  if (next.sort && next.sort !== 'newest') params.set('sort', next.sort);
  for (const key of PAGE_KEYS) if (overrides[key] && overrides[key] !== '1') params.set(key, overrides[key]!);
  const query = params.toString();
  return query ? `/documents?${query}` : '/documents';
}

function leaseTitle(file: LibraryDocument) {
  const property = documentProperty(file);
  const unit = documentUnit(file);
  const unitName = unit?.isImplicit ? 'Whole property' : unit ? `Unit ${unit.number}` : '';
  const tenant =
    file.lease?.tenants.find((entry) => entry.isPrimary)?.name ??
    file.lease?.tenants[0]?.name ??
    'No tenant';
  return `Lease: ${property?.name ?? 'Property'}${unitName ? ` · ${unitName}` : ''} — ${tenant}`;
}

function DocumentRow({
  file,
  owner,
}: {
  file: LibraryDocument;
  owner?: { href: string; label: string };
}) {
  const meta = [
    KIND_LABELS[file.kind],
    formatDate(file.createdAt),
    formatBytes(file.sizeBytes),
    ...(file.kind === 'ID' ? ['Restricted access'] : []),
  ].join(' · ');

  return (
    <FileRow
      kind={fileKind(file.mimeType)}
      name={file.name}
      meta={meta}
      action={
        <div
          className={`row ${styles.documentActions}`}
          style={{ flexWrap: 'wrap', justifyContent: 'flex-end' }}
        >
          {owner && (
            <Link className="badge" href={owner.href}>
              {owner.label}
            </Link>
          )}
          <a
            className="btn btn-ghost btn-sm"
            href={`/api/files/${file.id}/preview`}
            target="_blank"
            rel="noreferrer"
          >
            Preview
          </a>
          <a className="btn btn-secondary btn-sm" href={`/api/files/${file.id}/download`}>
            Download
          </a>
        </div>
      }
    />
  );
}

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await requireManagerRole();
  const params = await searchParams;
  const kind = kindFromParam(params.kind);
  const sort = params.sort === 'oldest' ? 'oldest' : 'newest';
  const query = params.q?.trim() ?? '';
  const filters = { ...params, kind, sort };

  const [rows, leaseTargets, propertyTargets, unitTargets] = await Promise.all([
    db.document.findMany({
      where: { organizationId: session.organizationId },
      include: {
        lease: {
          include: {
            unit: { include: { property: { select: { id: true, name: true } } } },
            tenants: {
              include: { tenant: { select: { id: true, name: true } } },
              orderBy: { isPrimary: 'desc' },
            },
          },
        },
        property: { select: { id: true, name: true } },
        unit: { include: { property: { select: { id: true, name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    db.lease.findMany({
      where: { organizationId: session.organizationId },
      include: {
        unit: { include: { property: { select: { id: true, name: true } } } },
        tenants: {
          include: { tenant: { select: { id: true, name: true } } },
          orderBy: { isPrimary: 'desc' },
        },
      },
      orderBy: [{ endDate: 'desc' }, { createdAt: 'desc' }],
    }),
    db.property.findMany({
      where: { organizationId: session.organizationId, archivedAt: null },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    db.unit.findMany({
      where: {
        organizationId: session.organizationId,
        status: { not: 'ARCHIVED' },
        property: { archivedAt: null },
      },
      include: { property: { select: { id: true, name: true } } },
      orderBy: [{ property: { name: 'asc' } }, { number: 'asc' }],
    }),
  ]);

  const libraryFiles: LibraryDocument[] = rows.map((row) => ({
    id: row.id,
    name: row.name,
    kind: row.kind,
    mimeType: row.mimeType,
    sizeBytes: Number(row.sizeBytes),
    createdAt: row.createdAt,
    leaseId: row.leaseId,
    propertyId: row.propertyId,
    unitId: row.unitId,
    property: row.property,
    unit: row.unit,
    lease: row.lease
      ? {
          id: row.lease.id,
          unit: row.lease.unit,
          tenants: row.lease.tenants.map(({ tenant, isPrimary }) => ({
            id: tenant.id,
            name: tenant.name,
            isPrimary,
          })),
        }
      : null,
  }));
  const matchingFiles = filterLibraryDocuments(libraryFiles, {
    query,
    kind,
    propertyId: params.propertyId,
    unitId: params.unitId,
    sort,
  });
  const allLeaseGroups = groupLeaseDocuments(matchingFiles);
  const allPropertyFiles = propertyDocuments(matchingFiles);
  const allPhotos = photoDocuments(matchingFiles);
  const leasePage = pageFrom(params.leasePage, allLeaseGroups.length, LEASE_GROUPS_PER_PAGE);
  const filesPage = pageFrom(params.filesPage, allPropertyFiles.length);
  const photoPage = pageFrom(params.photoPage, allPhotos.length);
  const leaseGroups = paginate(allLeaseGroups, leasePage, LEASE_GROUPS_PER_PAGE);
  const propertyFiles = paginate(allPropertyFiles, filesPage);
  const photos = paginate(allPhotos, photoPage);
  const pageHref = (key: (typeof PAGE_KEYS)[number]) => (page: number) =>
    documentsHref(filters, {
      leasePage: String(key === 'leasePage' ? page : leasePage),
      filesPage: String(key === 'filesPage' ? page : filesPage),
      photoPage: String(key === 'photoPage' ? page : photoPage),
    });
  const usedBytes = libraryFiles.reduce((total, file) => total + file.sizeBytes, 0);
  const storagePercent = Math.min(100, (usedBytes / STORAGE_LIMIT) * 100);

  const leaseOptions = leaseTargets.map((lease) => {
    const tenant =
      lease.tenants.find((entry) => entry.isPrimary)?.tenant ?? lease.tenants[0]?.tenant;
    const unit = lease.unit;
    const unitLabel = unit.isImplicit ? 'Whole property' : `Unit ${unit.number}`;
    return {
      id: lease.id,
      label: `${unit.property.name} · ${unitLabel} — ${tenant?.name ?? 'No tenant'}`,
    };
  });
  const propertyOptions = propertyTargets.map((property) => ({
    id: property.id,
    label: property.name,
  }));
  const unitOptions = unitTargets.map((unit) => ({
    id: unit.id,
    label: `${unit.property.name} · ${unit.isImplicit ? 'Whole property' : `Unit ${unit.number}`}`,
  }));

  return (
    <>
      <ScopedWorkspace
        organizationId={session.organizationId}
        filter={scopeFilterFrom(params)}
        activeTab="documents"
      />
      <PageHeader
        title="Documents and photos"
        eyebrow="Files"
        actions={[{ label: 'Upload files', href: '#upload', primary: true }]}
      />
      <div className="stack">
        <section className="split">
          <Card id="upload">
            <CardHeader title="Upload files" />
            <UploadDocumentForm
              leases={leaseOptions}
              properties={propertyOptions}
              units={unitOptions}
            />
          </Card>
          <Card>
            <div className={styles.storageHeading}>
              <span className="eyebrow">Storage</span>
            </div>
            <div className="row between" style={{ marginTop: 4 }}>
              <strong>{formatBytes(usedBytes)} of 10 GB</strong>
              <TrendChip>{libraryFiles.length} files</TrendChip>
            </div>
            <Progress
              value={storagePercent}
              label="Portfolio storage used"
              style={{ marginTop: 10 }}
            />
            <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>
              Documents and photos stored for your portfolio
            </p>
          </Card>
        </section>

        <section className={styles.documentToolbar}>
          <div className="stack" style={{ gap: 12, flex: 1 }}>
            <Chips>
              {[
                { value: 'ALL', label: 'All files' },
                { value: 'LEASE', label: 'Leases' },
                { value: 'NOTICE', label: 'Notices' },
                { value: 'INSPECTION', label: 'Inspections' },
                { value: 'ID', label: 'IDs' },
                { value: 'PHOTO', label: 'Photos' },
              ].map((item) => (
                <Link
                  key={item.value}
                  href={documentsHref(filters, { kind: item.value })}
                  style={{ display: 'contents' }}
                >
                  <Chip active={kind === item.value}>{item.label}</Chip>
                </Link>
              ))}
            </Chips>
            <form action="/documents" method="get" role="search" className={styles.documentFilters}>
              {kind !== 'ALL' && <input type="hidden" name="kind" value={kind} />}
              {params.unitId && <input type="hidden" name="unitId" value={params.unitId} />}
              <label className="search document-search">
                <span aria-hidden="true">⌕</span>
                <input
                  name="q"
                  defaultValue={query}
                  aria-label="Search files, leases or properties"
                  placeholder="Search files, leases or properties"
                />
              </label>
              <label className={styles.documentSelect}>
                <select
                  name="propertyId"
                  defaultValue={params.propertyId ?? ''}
                  aria-label="Property"
                >
                  <option value="">All properties</option>
                  {propertyTargets.map((property) => (
                    <option key={property.id} value={property.id}>
                      {property.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.documentSelect}>
                <select name="sort" defaultValue={sort} aria-label="Sort order">
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                </select>
              </label>
              <button className="btn btn-secondary btn-sm" type="submit">
                Apply
              </button>
            </form>
          </div>
        </section>

        <Card>
          <CardHeader
            title="Lease documents"
            action={
              <span className="muted">
                Grouped by lease · {allLeaseGroups.length}{' '}
                {allLeaseGroups.length === 1 ? 'lease' : 'leases'}
              </span>
            }
          />
          {leaseGroups.length ? (
            leaseGroups.map((group) => {
              const representative = group.files[0]!;
              const property = documentProperty(representative);
              const unit = documentUnit(representative);
              const tenants = group.lease?.tenants ?? [];
              return (
                <section key={group.leaseId} className={styles.leaseDocumentGroup}>
                  <div className={`row between ${styles.leaseDocumentHeading}`}>
                    <div>
                      <strong>
                        <Link href={`/leases/${group.leaseId}`}>{leaseTitle(representative)}</Link>
                      </strong>
                      <div className={`muted ${styles.documentRelatedLinks}`}>
                        {property && (
                          <Link href={`/properties/${property.id}`}>{property.name}</Link>
                        )}
                        {unit && property && <span aria-hidden="true"> · </span>}
                        {unit && property && (
                          <Link href={`/properties/${property.id}/units/${unit.id}`}>
                            {unit.isImplicit ? 'Whole property' : `Unit ${unit.number}`}
                          </Link>
                        )}
                        {tenants.map((tenant, index) => (
                          <span key={tenant.id}>
                            {(property || index > 0) && <span aria-hidden="true"> · </span>}
                            <Link href={`/tenants/${tenant.id}`}>{tenant.name}</Link>
                          </span>
                        ))}
                        <span> · {group.files.length} files</span>
                      </div>
                    </div>
                    <Link className="btn btn-secondary btn-sm" href={`/leases/${group.leaseId}`}>
                      Open lease
                    </Link>
                  </div>
                  {group.files.map((file) => (
                    <DocumentRow key={file.id} file={file} />
                  ))}
                </section>
              );
            })
          ) : (
            <EmptyState
              title="No lease documents in this view"
              description="Lease documents will appear here after they are added."
              action="View leases"
              href="/leases"
            />
          )}
          <Pagination page={leasePage} total={allLeaseGroups.length} size={LEASE_GROUPS_PER_PAGE} noun="leases" href={pageHref('leasePage')} />
        </Card>

        <Card>
          <CardHeader
            title="Property files"
            action={<span className="muted">Not tied to a single lease</span>}
          />
          {propertyFiles.length ? (
            propertyFiles.map((file) => {
              const property = documentProperty(file);
              const unit = documentUnit(file);
              const owner = property
                ? {
                    href: unit
                      ? `/properties/${property.id}/units/${unit.id}`
                      : `/properties/${property.id}`,
                    label: unit
                      ? `${property.name} · ${unit.isImplicit ? 'Whole property' : `Unit ${unit.number}`}`
                      : property.name,
                  }
                : undefined;
              return <DocumentRow key={file.id} file={file} owner={owner} />;
            })
          ) : (
            <EmptyState
              title="Nothing uploaded for properties yet"
              description="Upload a file from a property to keep it with the portfolio."
              action="View properties"
              href="/properties"
            />
          )}
          <Pagination page={filesPage} total={allPropertyFiles.length} noun="files" href={pageHref('filesPage')} />
        </Card>

        <Card>
          <CardHeader
            title="Photos"
            action={<span className="muted">Property and unit photos · {allPhotos.length} files</span>}
          />
          {photos.length ? (
            <Gallery>
              {photos.map((photo, index) => {
                const property = documentProperty(photo);
                const unit = documentUnit(photo);
                return (
                  <div key={photo.id} className={styles.documentPhotoCard}>
                    <Link
                      href={
                        property && unit
                          ? `/properties/${property.id}/units/${unit.id}`
                          : property
                            ? `/properties/${property.id}`
                            : '/documents'
                      }
                      aria-label={`Open ${property?.name ?? 'property'} photo`}
                    >
                      <PhotoImage photo={photo} index={index} />
                    </Link>
                    <div className={`muted ${styles.documentPhotoMeta}`}>
                      {property?.name ?? 'Portfolio photo'}
                      {unit && ` · ${unit.isImplicit ? 'Whole property' : `Unit ${unit.number}`}`}
                      {' · '}
                      {formatDate(photo.createdAt)}
                    </div>
                    <div className={styles.documentPhotoActions}>
                      <a href={`/api/files/${photo.id}/preview`} target="_blank" rel="noreferrer">
                        Preview
                      </a>
                      <a href={`/api/files/${photo.id}/download`}>Download</a>
                    </div>
                  </div>
                );
              })}
            </Gallery>
          ) : (
            <EmptyState
              title="No photos in this view"
              description="Add property or unit photos to make them available here."
              action="View properties"
              href="/properties"
            />
          )}
          <Pagination page={photoPage} total={allPhotos.length} noun="photos" href={pageHref('photoPage')} />
        </Card>
        <Badge tone="info">{matchingFiles.length} matching files</Badge>
      </div>
    </>
  );
}
