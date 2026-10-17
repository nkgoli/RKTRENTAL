import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/RouteStates';
import { requireTenantRole } from '@/lib/auth/access';
import { formatUsd } from '@/lib/ledger/core';
import { formatBytes, formatDate } from '@/lib/properties/format';
import { statusLabel } from '@/lib/leases/format';
import { canPreview, fileBadge, loadTenantLease } from '@/lib/tenant-portal';

export const dynamic = 'force-dynamic';

export default async function TenantLeasePage() {
  const session = await requireTenantRole();
  const view = await loadTenantLease(session);

  if (!view) {
    return (
      <>
        <h1 style={{ fontSize: 'var(--rr-h1)' }}>My lease</h1>
        <EmptyState title="No active lease yet" description="Your property manager will add it here once it is set up." action="Check again" href="/lease" />
      </>
    );
  }

  const others = [...view.coTenants, ...view.occupants.filter((n) => n !== view.tenantName)];

  return (
    <>
      <div>
        <h1 style={{ fontSize: 'var(--rr-h1)' }}>{view.tenantName}</h1>
        <p className="muted" style={{ fontSize: 13, marginTop: 2 }}>
          Managed by {view.managerName}
        </p>
      </div>

      <section className="card" aria-labelledby="current-lease">
        <div className="card-header">
          <h3 id="current-lease" style={{ fontSize: 15 }}>
            Current lease
          </h3>
          <Badge tone={view.status === 'ACTIVE' ? 'success' : 'neutral'}>
            {statusLabel(view.status)}
          </Badge>
        </div>
        <dl className="kv" style={{ gridTemplateColumns: '110px 1fr' }}>
          <dt>Property</dt>
          <dd>{view.premises.replace(' · ', ' — ')}</dd>
          {others.length > 0 && (
            <>
              <dt>Occupants</dt>
              <dd>{[view.tenantName, ...others].join(', ')}</dd>
            </>
          )}
          <dt>Term</dt>
          <dd>
            {formatDate(view.term.start)} – {formatDate(view.term.end)}
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

      {view.notice && (
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

      <section className="card" id="documents" aria-labelledby="lease-documents">
        <div className="card-header">
          <h3 id="lease-documents" style={{ fontSize: 15 }}>
            Lease &amp; documents
          </h3>
          <Badge tone="info">
            {view.documents.length} {view.documents.length === 1 ? 'file' : 'files'}
          </Badge>
        </div>
        {view.documents.length === 0 && <p className="muted">Your lease and notices will appear here when your manager adds them.</p>}
        {view.documents.map((doc) => {
          const badge = fileBadge(doc.mimeType);
          return (
            <div className="file" key={doc.id}>
              <span className={badge === 'doc' ? 'file-icon' : `file-icon ${badge}`}>
                {badge === 'doc' ? 'DOC' : badge.toUpperCase()}
              </span>
              <span className="file-meta">
                <strong>{doc.name}</strong>
                <small>
                  {formatDate(doc.createdAt)} · {formatBytes(doc.sizeBytes)}
                </small>
              </span>
              <span className="row" style={{ gap: 6 }}>
                {canPreview(doc.mimeType) && (
                  <a
                    className="btn btn-ghost btn-sm"
                    href={doc.previewUrl}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Preview ${doc.name}`}
                  >
                    Preview
                  </a>
                )}
                <a
                  className="btn btn-secondary btn-sm"
                  href={doc.downloadUrl}
                  aria-label={`Download ${doc.name}`}
                >
                  Download
                </a>
              </span>
            </div>
          );
        })}
      </section>

      {view.photos.length > 0 && (
        <section aria-labelledby="unit-photos">
          <h2 id="unit-photos" style={{ fontSize: 'var(--rr-h3)', marginBottom: 8 }}>
            Unit photos
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {view.photos.map((photo) => (
              <div className="photo" key={photo.id}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.url}
                  alt={photo.caption ?? photo.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
                {photo.caption && <span className="caption">{photo.caption}</span>}
              </div>
            ))}
          </div>
          <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
            Photos of your unit from {view.managerName}.
          </p>
        </section>
      )}

    </>
  );
}
