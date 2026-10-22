import Link from 'next/link';
import { EmptyState } from '@/components/RouteStates';
import { db } from '@/lib/db/client';
import { requireManagerRole } from '@/lib/auth/access';
import { PageHeader } from '@/components/shell/PageHeader';
import { ScopedWorkspace } from '@/components/workspace/ScopedWorkspace';
import { scopeFilterFrom } from '@/lib/workspace/scope';
import { Badge, Card, Gallery, Pagination, Tabs, pageFrom, paginate } from '@/components/ui';
import type { BadgeTone } from '@/components/ui';
import { SummaryBand } from '@/components/ui/SummaryBand';
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
  type LeaseDocumentGroup,
  type LibraryDocument,
  type LibraryDocumentKind,
} from '@/lib/documents/library';
import { UploadDocumentForm } from './UploadDocumentForm';
import { UploadDialog } from './UploadDialog';
import { Icon } from '@/components/shell/Icons';
import { DocumentFilters } from './DocumentFilters';
import {
  KIND_FILTERS,
  isRestrictedDocument,
  isSignedDocument,
  leaseFileSections,
  leaseLocation,
  librarySummary,
  photoSummary,
  previewDocument,
  primaryTenant,
  sortByName,
  sortFromParam,
  unitLabel,
} from './library-view';
import styles from './documents.module.css';

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

const TYPE_TONES: Record<'pdf' | 'img' | 'doc', BadgeTone> = {
  pdf: 'danger',
  img: 'info',
  doc: 'neutral',
};

type KindFilter = LibraryDocumentKind | 'ALL';
type SearchParams = {
  q?: string;
  kind?: string;
  propertyId?: string;
  unitId?: string;
  sort?: string;
  file?: string;
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

function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

function documentsHref(filters: SearchParams, overrides: Partial<SearchParams> = {}) {
  const next = { ...filters, ...overrides };
  const params = new URLSearchParams();
  if (next.q?.trim()) params.set('q', next.q.trim());
  if (next.kind && next.kind !== 'ALL') params.set('kind', next.kind);
  if (next.propertyId) params.set('propertyId', next.propertyId);
  if (next.unitId) params.set('unitId', next.unitId);
  if (next.sort && next.sort !== 'newest') params.set('sort', next.sort);
  for (const key of PAGE_KEYS)
    if (overrides[key] && overrides[key] !== '1') params.set(key, overrides[key]!);
  if (next.file) params.set('file', next.file);
  const query = params.toString();
  return query ? `/documents?${query}` : '/documents';
}

function leaseTitle(group: LeaseDocumentGroup) {
  return `Lease: ${leaseLocation(group)} — ${primaryTenant(group)?.name ?? 'No tenant'}`;
}

/** Decorative lock beside restricted files; the visible "Restricted access" text carries meaning. */
function LockIcon() {
  return (
    <svg
      className={styles.lock}
      viewBox="0 0 16 16"
      width="14"
      height="14"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="3" y="7" width="10" height="7" rx="1.5" fill="none" stroke="currentColor" />
      <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" fill="none" stroke="currentColor" />
    </svg>
  );
}

function FileMeta({ file, withKind = true }: { file: LibraryDocument; withKind?: boolean }) {
  const type = fileKind(file.mimeType);
  const meta = [
    ...(withKind ? [KIND_LABELS[file.kind]] : []),
    formatDate(file.createdAt),
    formatBytes(file.sizeBytes),
    ...(isRestrictedDocument(file) ? ['Restricted access'] : []),
  ].join(' · ');
  return (
    <span className={styles.fileMeta}>
      <Badge tone={TYPE_TONES[type]}>{type.toUpperCase()}</Badge>
      <small>{meta}</small>
      {isSignedDocument(file) && <Badge tone="success">Signed</Badge>}
      {isRestrictedDocument(file) && <LockIcon />}
    </span>
  );
}

function DocumentRow({
  file,
  selectHref,
  review,
  owner,
}: {
  file: LibraryDocument;
  selectHref: string;
  review?: { href: string; label: string };
  owner?: { href: string; label: string };
}) {
  return (
    <div className={styles.fileRow} data-document-row>
      <div className={styles.fileMain}>
        <Link className={styles.fileName} href={selectHref}>
          {file.name}
        </Link>
        <FileMeta file={file} />
      </div>
      <div className={styles.documentActions}>
        {owner && (
          <Link className="badge" href={owner.href}>
            {owner.label}
          </Link>
        )}
        {review && (
          <Link className="btn btn-ghost btn-sm" href={review.href}>
            {review.label}
          </Link>
        )}
        <a
          className="icon-btn"
          href={`/api/files/${file.id}/preview`}
          target="_blank"
          rel="noreferrer"
          aria-label={`Preview ${file.name} (opens in a new tab)`}
        >
          <Icon name="eye" />
        </a>
        <a
          className="btn btn-ghost btn-sm"
          aria-label={`Download ${file.name}`}
          href={`/api/files/${file.id}/download`}
        >
          <Icon name="download" />
          Download
        </a>
      </div>
    </div>
  );
}

function fileOwner(file: LibraryDocument) {
  const property = documentProperty(file);
  const unit = documentUnit(file);
  if (!property) return undefined;
  return {
    href: unit ? `/properties/${property.id}/units/${unit.id}` : `/properties/${property.id}`,
    label: unit ? `${property.name} · ${unitLabel(unit)}` : property.name,
  };
}

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await requireManagerRole();
  const params = await searchParams;
  const kind = kindFromParam(params.kind);
  const sort = sortFromParam(params.sort);
  const query = params.q?.trim() ?? '';
  const filters: SearchParams = { ...params, kind, sort, file: undefined };

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
        // Signing proof: only an executed agreement that pins the file marks it Signed.
        agreementFiles: {
          select: {
            agreementId: true,
            slot: true,
            sha256: true,
            agreement: {
              select: { version: true, signedAt: true, supersededAt: true, archiveStatus: true },
            },
          },
        },
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
    agreementFiles: row.agreementFiles,
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
  const filtered = filterLibraryDocuments(libraryFiles, {
    query,
    kind,
    propertyId: params.propertyId,
    unitId: params.unitId,
    sort: sort === 'oldest' ? 'oldest' : 'newest',
  });
  const matchingFiles = sort === 'name' ? sortByName(filtered) : filtered;
  const allLeaseGroups = groupLeaseDocuments(matchingFiles);
  const allPropertyFiles = propertyDocuments(matchingFiles);
  const allPhotos = photoDocuments(matchingFiles);
  const leasePage = pageFrom(params.leasePage, allLeaseGroups.length, LEASE_GROUPS_PER_PAGE);
  const filesPage = pageFrom(params.filesPage, allPropertyFiles.length);
  const photoPage = pageFrom(params.photoPage, allPhotos.length);
  const leaseGroups = paginate(allLeaseGroups, leasePage, LEASE_GROUPS_PER_PAGE);
  const propertyFiles = paginate(allPropertyFiles, filesPage);
  const photos = paginate(allPhotos, photoPage);
  const pages = {
    leasePage: String(leasePage),
    filesPage: String(filesPage),
    photoPage: String(photoPage),
  };
  const pageHref = (key: (typeof PAGE_KEYS)[number]) => (page: number) =>
    documentsHref(filters, { ...pages, [key]: String(page) });
  const selectHref = (file: LibraryDocument) =>
    `${documentsHref(filters, { ...pages, file: file.id })}#preview`;

  const summary = librarySummary(libraryFiles);
  const latestTenant = summary.latestLease ? primaryTenant(summary.latestLease) : null;
  const signedFirst = summary.signed.first;
  const restrictedFirst = summary.restricted.first;
  const leaseFilesInView = leaseGroups.flatMap((group) => group.files);
  const preview = previewDocument(matchingFiles, params.file, [
    ...leaseFilesInView,
    ...propertyFiles,
  ]);
  const previewGroup = preview?.leaseId
    ? allLeaseGroups.find((group) => group.leaseId === preview.leaseId)
    : undefined;
  const previewTenant = previewGroup ? primaryTenant(previewGroup) : null;
  const previewOwner = preview && !preview.leaseId ? fileOwner(preview) : undefined;
  const previewIsPdf = preview ? fileKind(preview.mimeType) === 'pdf' : false;
  const photoOverview = photoSummary(matchingFiles);
  const leaseFileCount = allLeaseGroups.reduce((total, group) => total + group.files.length, 0);

  const leaseOptions = leaseTargets.map((lease) => {
    const tenant =
      lease.tenants.find((entry) => entry.isPrimary)?.tenant ?? lease.tenants[0]?.tenant;
    return {
      id: lease.id,
      label: `${lease.unit.property.name} · ${unitLabel(lease.unit)} — ${tenant?.name ?? 'No tenant'}`,
    };
  });
  const propertyOptions = propertyTargets.map((property) => ({
    id: property.id,
    label: property.name,
  }));
  const unitOptions = unitTargets.map((unit) => ({
    id: unit.id,
    label: `${unit.property.name} · ${unitLabel(unit)}`,
  }));

  return (
    <>
      <ScopedWorkspace
        organizationId={session.organizationId}
        filter={scopeFilterFrom(params)}
        activeTab="documents"
      />
      <PageHeader
        title="Documents"
        eyebrow="Operations"
        meta="Documents and photos · open a lease or property to rename, share or delete its files"
        actions={[{ label: 'Upload files', href: '#upload', primary: true }]}
      />
      <div className={`stack ${styles.library}`}>
        <SummaryBand
          eyebrow="Portfolio files"
          value={plural(summary.total, 'file')}
          detail={`${formatBytes(summary.bytes)} stored · ${plural(summary.leaseDocuments, 'lease document')} · ${plural(summary.propertyFiles, 'property file')}`}
          footer={
            <>
              <a className="btn btn-primary btn-sm" href="#upload">
                Upload files
              </a>
              {summary.latestLease && (
                <Link
                  className="btn btn-ghost btn-sm"
                  href={`/leases/${summary.latestLease.leaseId}?tab=documents`}
                >
                  {latestTenant
                    ? `Open ${latestTenant.name}’s lease`
                    : `Open the ${leaseLocation(summary.latestLease)} lease`}
                  <Icon name="arrow-right" />
                </Link>
              )}
            </>
          }
          stats={[
            {
              label: 'Signed lease agreements',
              value: summary.signed.count,
              detail: signedFirst
                ? [leaseLocation(signedFirst), primaryTenant(signedFirst)?.name]
                    .filter(Boolean)
                    .join(' · ')
                : 'No signed agreement stored yet',
              href: signedFirst ? `/leases/${signedFirst.leaseId}?tab=agreement` : undefined,
            },
            {
              label: 'Restricted access',
              value: summary.restricted.count,
              detail: restrictedFirst
                ? `${restrictedFirst.name} · tenant identity`
                : 'No identity documents stored',
              href: summary.restricted.count ? '/documents?kind=ID' : undefined,
            },
          ]}
        />
        <UploadDialog>
          <UploadDocumentForm
            leases={leaseOptions}
            properties={propertyOptions}
            units={unitOptions}
            propertyId={params.propertyId}
            unitId={params.unitId}
          />
        </UploadDialog>

        <section className={styles.documentToolbar} aria-label="Find files">
          <DocumentFilters
            key={`${params.propertyId ?? ''}:${params.unitId ?? ''}`}
            query={query}
            kind={kind}
            sort={sort}
            propertyId={params.propertyId}
            unitId={params.unitId}
            properties={propertyTargets}
            units={unitTargets.map((unit) => ({
              id: unit.id,
              propertyId: unit.property.id,
              label: `${unit.property.name} · ${unitLabel(unit)}`,
            }))}
            tabs={
              <Tabs
                label="File type"
                items={KIND_FILTERS.map((item) => ({
                  label: item.label,
                  href: documentsHref(filters, { kind: item.value }),
                  active: kind === item.value,
                }))}
              />
            }
            caption={
              <span className={styles.caption} role="status">
                {plural(matchingFiles.length, 'matching file')}
              </span>
            }
          />
        </section>

        {matchingFiles.length === 0 && (
          <Card>
            <EmptyState
              title={
                libraryFiles.length ? 'No files match these filters' : 'No documents or photos yet'
              }
              description={
                libraryFiles.length
                  ? 'Try a different name, file type or property. Clear filters to see the full library.'
                  : 'Upload a signed lease, inspection or photo and keep it with the right property or unit.'
              }
              action={libraryFiles.length ? 'Clear filters' : 'Upload files'}
              href={libraryFiles.length ? '/documents' : '#upload'}
            />
          </Card>
        )}
        {matchingFiles.length > 0 && (
          <>
            <div className={styles.leaseGrid}>
              <Card className={styles.panel}>
                <div className={styles.panelHead}>
                  <h2 className={styles.panelTitle}>Lease documents</h2>
                  <span className={styles.caption}>
                    Grouped by lease · {plural(allLeaseGroups.length, 'lease')} ·{' '}
                    {plural(leaseFileCount, 'file')}
                  </span>
                </div>
                {leaseGroups.length ? (
                  leaseGroups.map((group) => {
                    const representative = group.files[0]!;
                    const property = documentProperty(representative);
                    const unit = documentUnit(representative);
                    const tenants = group.lease?.tenants ?? [];
                    const leaseHref = `/leases/${group.leaseId}?tab=documents`;
                    const sections = leaseFileSections(group.files);
                    const review = { href: leaseHref, label: 'Review lease' };
                    const row = (file: LibraryDocument) => (
                      <DocumentRow
                        key={file.id}
                        file={file}
                        selectHref={selectHref(file)}
                        review={review}
                      />
                    );
                    const missing = (text: string) =>
                      kind === 'ALL' && (
                        <div className={styles.missing}>
                          <span>{text}</span>
                          <Link href={leaseHref}>Add from the lease →</Link>
                        </div>
                      );
                    return (
                      <section
                        key={group.leaseId}
                        className={styles.leaseDocumentGroup}
                        aria-label={leaseTitle(group)}
                      >
                        <div className={styles.leaseDocumentHeading}>
                          <div>
                            <Link className={styles.leaseLink} href={leaseHref}>
                              {leaseTitle(group)}
                            </Link>
                            <div className={styles.documentRelatedLinks}>
                              {property && (
                                <Link href={`/properties/${property.id}`}>{property.name}</Link>
                              )}
                              {unit && property && <span aria-hidden="true"> · </span>}
                              {unit && property && (
                                <Link href={`/properties/${property.id}/units/${unit.id}`}>
                                  {unitLabel(unit)}
                                </Link>
                              )}
                              {tenants.map((tenant, index) => (
                                <span key={tenant.id}>
                                  {(property || index > 0) && <span aria-hidden="true"> · </span>}
                                  <Link href={`/tenants/${tenant.id}`}>{tenant.name}</Link>
                                </span>
                              ))}
                              <span> · {plural(group.files.length, 'file')}</span>
                            </div>
                          </div>
                          <Link className="btn btn-secondary btn-sm" href={leaseHref}>
                            Manage files
                          </Link>
                        </div>
                        {(sections.agreement.length > 0 || kind === 'ALL') && (
                          <div className={styles.fileSection}>
                            <h3 className="eyebrow">
                              {sections.agreement.some(isSignedDocument)
                                ? 'Signed agreement'
                                : 'Lease agreement'}
                            </h3>
                            {sections.agreement.length
                              ? sections.agreement.map(row)
                              : missing('No lease agreement uploaded for this lease')}
                          </div>
                        )}
                        {(sections.addendums.length > 0 || kind === 'ALL') && (
                          <div className={styles.fileSection}>
                            <h3 className="eyebrow">Addendums</h3>
                            {sections.addendums.length
                              ? sections.addendums.map(row)
                              : missing('No separate addendum uploaded for this lease')}
                          </div>
                        )}
                        {sections.inspections.length > 0 && (
                          <div className={styles.fileSection}>
                            <h3 className="eyebrow">Inspections &amp; IDs</h3>
                            {sections.inspections.map(row)}
                          </div>
                        )}
                        {sections.other.length > 0 && (
                          <div className={styles.fileSection}>
                            <h3 className="eyebrow">Notices &amp; other files</h3>
                            {sections.other.map(row)}
                          </div>
                        )}
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
                <Pagination
                  page={leasePage}
                  total={allLeaseGroups.length}
                  size={LEASE_GROUPS_PER_PAGE}
                  noun="leases"
                  href={pageHref('leasePage')}
                />
              </Card>

              <Card
                id="preview"
                className={`${styles.panel} ${styles.previewCard} ${params.file ? '' : styles.previewOptional}`}
                role="region"
                aria-labelledby="preview-heading"
              >
                <p className="eyebrow">Preview</p>
                {preview ? (
                  <>
                    <h2 id="preview-heading" className={styles.previewTitle}>
                      {preview.name}
                    </h2>
                    <div className={styles.inset}>
                      <Icon name="documents" />
                      <strong>
                        {preview.name} · {formatBytes(preview.sizeBytes)}
                      </strong>
                      <small>
                        {isRestrictedDocument(preview)
                          ? 'Restricted access · tenant identity. Open it only when you need to verify the tenant.'
                          : previewIsPdf
                            ? 'No page preview here. Open the PDF in a new tab or download it to read it.'
                            : 'No inline preview here. Open the file in a new tab or download it.'}
                      </small>
                      <a
                        href={`/api/files/${preview.id}/preview`}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`Open ${preview.name} (opens in a new tab)`}
                      >
                        Open in a new tab
                      </a>
                    </div>
                    <ul className={styles.metaList}>
                      {previewGroup && (
                        <li>
                          <span>Lease</span>
                          <Link href={`/leases/${previewGroup.leaseId}?tab=documents`}>
                            {leaseLocation(previewGroup)}
                          </Link>
                        </li>
                      )}
                      {previewTenant && (
                        <li>
                          <span>Tenant</span>
                          <Link href={`/tenants/${previewTenant.id}`}>{previewTenant.name}</Link>
                        </li>
                      )}
                      {previewOwner && (
                        <li>
                          <span>Property</span>
                          <Link href={previewOwner.href}>{previewOwner.label}</Link>
                        </li>
                      )}
                      <li>
                        <span>Uploaded</span>
                        <span>
                          {formatDate(preview.createdAt)} · {formatBytes(preview.sizeBytes)}
                        </span>
                      </li>
                      <li>
                        <span>Type</span>
                        <span>{KIND_LABELS[preview.kind]}</span>
                      </li>
                    </ul>
                    <div className={styles.previewActions}>
                      {previewGroup && preview.kind === 'LEASE' ? (
                        <Link
                          className="btn btn-primary"
                          href={`/leases/${previewGroup.leaseId}?tab=agreement`}
                        >
                          Review signatures
                        </Link>
                      ) : previewGroup ? (
                        <Link
                          className="btn btn-primary"
                          href={`/leases/${previewGroup.leaseId}?tab=documents`}
                        >
                          Review lease
                        </Link>
                      ) : previewOwner ? (
                        <Link className="btn btn-primary" href={previewOwner.href}>
                          Open property
                        </Link>
                      ) : null}
                      <a
                        className="btn btn-secondary"
                        href={`/api/files/${preview.id}/download`}
                        aria-label={`Download ${preview.name}`}
                      >
                        <Icon name="download" />
                        {previewIsPdf ? 'Download PDF' : 'Download file'}
                      </a>
                    </div>
                  </>
                ) : (
                  <>
                    <h2 id="preview-heading" className={styles.previewTitle}>
                      No file selected
                    </h2>
                    <p className="muted">Choose a lease or property file to see its details.</p>
                  </>
                )}
              </Card>
            </div>

            <div className={styles.secondaryGrid}>
              <Card className={styles.panel} role="region" aria-labelledby="property-files-heading">
                <div className={styles.panelHeadIcon}>
                  <Icon name="documents" />
                  <h2 id="property-files-heading" className={styles.panelTitle}>
                    Property files
                  </h2>
                </div>
                <span className={styles.caption}>Not tied to a single lease</span>
                {propertyFiles.length ? (
                  propertyFiles.map((file) => (
                    <DocumentRow
                      key={file.id}
                      file={file}
                      selectHref={selectHref(file)}
                      owner={fileOwner(file)}
                    />
                  ))
                ) : (
                  <div className={styles.emptyPanel}>
                    <h3>Nothing uploaded for properties yet</h3>
                    <p className="muted">
                      Upload a file from a property to keep it with the portfolio.
                    </p>
                    <Link className="btn btn-secondary btn-sm" href="/properties">
                      View properties
                      <Icon name="arrow-right" />
                    </Link>
                  </div>
                )}
                <Pagination
                  page={filesPage}
                  total={allPropertyFiles.length}
                  noun="files"
                  href={pageHref('filesPage')}
                />
              </Card>
              <Card className={styles.panel} role="region" aria-labelledby="photos-heading">
                <div className={styles.panelHead}>
                  <h2 id="photos-heading" className={styles.panelTitle}>
                    Photos
                  </h2>
                  <span className={styles.caption}>
                    Property and unit photos · {allPhotos.length}
                  </span>
                </div>
                {photos.length ? (
                  <>
                    <div className={styles.inset}>
                      <strong>
                        {plural(photoOverview.total, 'photo')} · {photoOverview.text}
                      </strong>
                      <small>Open a property to rename, reorder or delete its photos.</small>
                    </div>
                    <div className={styles.photoGrid}>
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
                              <div className={styles.documentPhotoMeta}>
                                {property?.name ?? 'Portfolio photo'}
                                {unit && ` · ${unitLabel(unit)}`}
                                {' · '}
                                {formatDate(photo.createdAt)}
                              </div>
                              <div className={styles.documentPhotoActions}>
                                <a
                                  className="icon-btn"
                                  aria-label={`Preview ${photo.name} (opens in a new tab)`}
                                  href={`/api/files/${photo.id}/preview`}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  <Icon name="eye" />
                                </a>
                                <a
                                  className="icon-btn"
                                  aria-label={`Download ${photo.name}`}
                                  href={`/api/files/${photo.id}/download`}
                                >
                                  <Icon name="download" />
                                </a>
                              </div>
                            </div>
                          );
                        })}
                      </Gallery>
                    </div>
                  </>
                ) : (
                  <EmptyState
                    title="No photos in this view"
                    description="Add property or unit photos to make them available here."
                    action="View properties"
                    href="/properties"
                  />
                )}
                <Pagination
                  page={photoPage}
                  total={allPhotos.length}
                  noun="photos"
                  href={pageHref('photoPage')}
                />
              </Card>
            </div>
          </>
        )}
      </div>
    </>
  );
}
