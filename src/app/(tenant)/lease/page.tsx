import { LeaseAgreementList } from '@/components/lease-signing/LeaseAgreementList';
import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/RouteStates';
import { requireTenantRole } from '@/lib/auth/access';
import { formatUsd } from '@/lib/ledger/core';
import { formatBytes, formatDate } from '@/lib/properties/format';
import { statusLabel } from '@/lib/leases/format';
import { canPreview, fileBadge, loadTenantLease } from '@/lib/tenant-portal';
import { TenantPhoto } from '../TenantPhoto';
import { PortalIcon } from '../home/PortalIcon';
import styles from '../portal.module.css';

export const dynamic = 'force-dynamic';

export default async function TenantLeasePage({
  searchParams,
}: {
  searchParams?: Promise<{ lease?: string }>;
}) {
  const session = await requireTenantRole();
  const agreements = await LeaseAgreementList({ session, tenantPortal: true });
  const selected = (await searchParams)?.lease;
  const view = await loadTenantLease(session, { leaseId: selected });

  if (!view) {
    return (
      <div className={styles.homeLease}>
        <h1 style={{ fontSize: 'var(--rr-h1)' }}>Your lease</h1>
        {agreements}
        <EmptyState
          title="No active lease yet"
          description="Your property manager will add it here once it is set up."
          action="Check again"
          href="/lease"
        />
      </div>
    );
  }

  const others = [...view.coTenants, ...view.occupants.filter((n) => n !== view.tenantName)];

  return (
    <div className={styles.homeLease}>
      <div>
        <h1 style={{ fontSize: 'var(--rr-h1)' }}>
          Your lease
          <span className={styles.spark} aria-hidden="true">
            ✳
          </span>
        </h1>
        <p className="muted" style={{ fontSize: 13, marginTop: 2 }}>
          {view.premises} · Managed by {view.managerName}
        </p>
      </div>

      {agreements}
      <a className="btn btn-primary" href={`/sign/leases/${view.leaseId}`}>
        Review agreement & signatures
      </a>
      <section
        className={`card ${styles.currentLease}`}
        id="overview"
        aria-labelledby="current-lease"
      >
        <div className={styles.currentHeader}>
          <div className="card-header">
            <h2 id="current-lease" style={{ fontSize: 18 }}>
              {selected ? 'Selected lease' : 'Current lease'}
            </h2>
            <Badge tone={view.status === 'ACTIVE' ? 'success' : 'neutral'}>
              {statusLabel(view.status)}
            </Badge>
          </div>
          <div className={styles.property}>
            <span className={styles.building}>
              <PortalIcon name="building" />
            </span>
            <div>
              <small>Property</small>
              <strong>{view.premises.replace(' · ', ' — ')}</strong>
            </div>
          </div>
        </div>
        <dl className="kv" style={{ gridTemplateColumns: '88px minmax(0, 1fr)' }}>
          {others.length > 0 && (
            <>
              <dt>Occupants</dt>
              <dd>{[view.tenantName, ...others].join(', ')}</dd>
            </>
          )}
          <dt>Term</dt>
          <dd>
            {formatDate(view.term.start)} – {formatDate(view.term.end)}
            {view.notice?.kind === 'renewal' && (
              <small className="muted" style={{ display: 'block', marginTop: 4 }}>
                Renewal pending
              </small>
            )}
          </dd>
          <dt>Rent</dt>
          <dd>{formatUsd(view.monthlyRentCents)} / month</dd>
          <dt>Deposit</dt>
          <dd>{formatUsd(view.depositCents)} · Held</dd>
          {view.notice?.kind === 'move-out' && (
            <>
              <dt>Notice given</dt>
              <dd>{formatDate(view.notice.noticeGivenAt)}</dd>
              <dt>Move-out</dt>
              <dd>{formatDate(view.notice.moveOutDate)}</dd>
            </>
          )}
          <dt>Autopay</dt>
          <dd>
            {view.autopayOn ? (
              'On'
            ) : (
              <>
                Off — <Link href="/pay">set up in Pay</Link>
              </>
            )}
          </dd>
        </dl>
      </section>

      {view.notice?.kind === 'move-out' && (
        <section
          className={view.notice.kind === 'move-out' ? 'alert warning' : 'alert'}
          role="status"
        >
          <p>
            <strong>{view.notice.title}</strong>
            <br />
            {view.notice.body}
          </p>
        </section>
      )}

      <section
        className={`card ${styles.documents}`}
        id="documents"
        aria-labelledby="lease-documents"
      >
        <div className="card-header">
          <h2 id="lease-documents" style={{ fontSize: 18 }}>
            Lease &amp; documents
          </h2>
          <span className="muted" style={{ fontSize: 13 }}>
            {view.documents.length} {view.documents.length === 1 ? 'file' : 'files'}
          </span>
        </div>
        {view.documents.length === 0 && (
          <p className="muted">
            Your lease and notices will appear here when your manager adds them.
          </p>
        )}
        {view.documents.map((doc) => {
          const badge = fileBadge(doc.mimeType);
          return (
            <div className={styles.document} key={doc.id}>
              <span className={styles.fileBadge}>
                {badge === 'doc' ? 'DOC' : badge.toUpperCase()}
              </span>
              <span className="file-meta">
                <strong>{doc.name}</strong>
                <small>
                  {formatDate(doc.createdAt)} · {formatBytes(doc.sizeBytes)}
                </small>
              </span>
              <span className={styles.documentActions}>
                {canPreview(doc.mimeType) && (
                  <a
                    className={`btn btn-ghost ${styles.fileAction}`}
                    href={doc.previewUrl}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Preview ${doc.name} (opens in a new tab)`}
                  >
                    <PortalIcon name="eye" />
                  </a>
                )}
                <a
                  className={`btn btn-ghost ${styles.fileAction}`}
                  href={doc.downloadUrl}
                  aria-label={`Download ${doc.name}`}
                >
                  <PortalIcon name="download" />
                </a>
              </span>
            </div>
          );
        })}
      </section>

      {view.photos.length > 0 && (
        <section id="photos" aria-labelledby="unit-photos">
          <h2 id="unit-photos" style={{ fontSize: 'var(--rr-h3)', marginBottom: 8 }}>
            Unit photos
          </h2>
          <div className={styles.photos}>
            {view.photos.map((photo) => (
              <TenantPhoto
                key={photo.id}
                src={photo.url}
                alt={photo.caption ?? photo.name}
                caption={photo.caption}
              />
            ))}
          </div>
          <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
            Photos of your unit from {view.managerName}.
          </p>
        </section>
      )}
    </div>
  );
}
