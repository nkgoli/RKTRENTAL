import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Alert, Progress } from '@/components/ui/Feedback';
import { requireTenantRole } from '@/lib/auth/access';
import { repairProgress, repairStatusLabel } from '@/lib/tenant-portal';
import { loadTenantRepairs } from './data';
import { MAX_PHOTOS, parseDescription } from './format';
import { RepairForm } from './RepairForm';
import { TenantPhoto } from '../TenantPhoto';
import portal from '../portal.module.css';
import styles from './repairs.module.css';
import { EmptyState } from '@/components/RouteStates';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<{ notice?: string }>;

const notices: Record<string, { tone: 'success' | 'warning' | 'error'; text: string }> = {
  submitted: {
    tone: 'success',
    text: 'Repair request sent. Your manager will assign a vendor and confirm timing.',
  },
  commented: { tone: 'success', text: 'Comment added.' },
  'comment-failed': { tone: 'error', text: 'Write a comment of up to 2000 characters.' },
  invalid: {
    tone: 'error',
    text: 'Choose a category, entry permission and urgency, and describe what needs fixing.',
  },
  'too-many-photos': { tone: 'error', text: `Add up to ${MAX_PHOTOS} photos.` },
  'bad-photo': { tone: 'error', text: 'Photos must be image files such as JPG or PNG.' },
  'photo-failed': {
    tone: 'warning',
    text: 'Your request was sent, but a photo could not be uploaded.',
  },
  'no-lease': { tone: 'warning', text: 'There is no active lease on your account.' },
};

const statusTone: Record<string, BadgeTone> = {
  NEW: 'info',
  ASSIGNED: 'info',
  IN_PROGRESS: 'warning',
  DONE: 'success',
  CANCELLED: 'neutral',
};

const shortDate = (date: Date) =>
  date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

export default async function TenantRepairsPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await requireTenantRole();
  const notice = notices[(await searchParams).notice ?? ''];
  const view = session.tenantId ? await loadTenantRepairs(session) : null;

  if (!view) {
    return (
      <div className={styles.repairs}>
        <h1 style={{ fontSize: 'var(--rr-h1)' }}>
          Repairs
          <span className={styles.spark} aria-hidden="true">
            {'\u2733'}
          </span>
        </h1>
        <EmptyState
          title="No active lease"
          description="There is no active lease on your account yet, so you cannot send a repair request."
          action="Check again"
          href="/repairs"
        />
      </div>
    );
  }

  // Only photos this tenant can open: their lease's uploads, or unit photos without a lease.
  const visiblePhotos = <T extends { document: { leaseId: string | null } | null }>(photos: T[]) =>
    photos.filter(
      ({ document }) => document && (!document.leaseId || document.leaseId === view.leaseId),
    );

  return (
    <div className={styles.repairs}>
      <header className={styles.heading}>
        <p className="eyebrow">Tenant portal / Repairs</p>
        <h1 style={{ fontSize: 'var(--rr-h1)' }}>
          Repairs
          <span className={styles.spark} aria-hidden="true">
            {'\u2733'}
          </span>
        </h1>
        <p className="muted" style={{ fontSize: 13, marginTop: 2 }}>
          {view.propertyName}
          {view.unitLabel ? ` · ${view.unitLabel}` : ''} · Your manager will assign a vendor and
          confirm timing.
        </p>
      </header>

      {notice && (
        <Alert tone={notice.tone}>
          <div>{notice.text}</div>
        </Alert>
      )}

      <nav className={portal.sectionLinks} aria-label="Repair sections">
        <a href="#new-request">New repair request</a>
        <a href="#your-requests">Your requests ({view.requests.length})</a>
      </nav>
      <section className="card" id="new-request" aria-labelledby="new-request-title">
        <div className={`card-header ${styles.formHeader}`}>
          <h2 id="new-request-title" style={{ fontSize: 20 }}>
            New repair request
          </h2>
          {view.unitLabel && <Badge tone="info">{view.unitLabel}</Badge>}
        </div>
        <RepairForm />
      </section>

      <section id="your-requests" aria-labelledby="your-requests-title">
        <div className={styles.sectionHeader}>
          <h2 id="your-requests-title">Your requests</h2>
          <span>
            {view.requests.length} {view.requests.length === 1 ? 'request' : 'requests'}
          </span>
        </div>
        <div className="stack" style={{ gap: 12 }}>
          {view.requests.length === 0 && (
            <p className="muted">
              No repair requests yet. Describe what needs fixing above and your manager will follow
              up.
            </p>
          )}
          {view.requests.map((request) => {
            const { category, text } = parseDescription(request.description);
            const own = request.tenantId === session.tenantId;
            return (
              <article
                className={`card ${styles.request}`}
                key={request.id}
                id={`request-${request.id}`}
              >
                <div className="row between">
                  <h3>{request.title}</h3>
                  <Badge tone={statusTone[request.status]}>
                    {repairStatusLabel(request.status)}
                  </Badge>
                </div>
                <p className="muted" style={{ fontSize: 13, margin: '6px 0 10px' }}>
                  {category} ·{' '}
                  {request.status === 'DONE' && request.completedAt
                    ? `Completed ${shortDate(request.completedAt)}`
                    : `Submitted ${shortDate(request.createdAt)}`}
                  {request.vendorName ? ` · Vendor: ${request.vendorName}` : ''}
                </p>
                {request.status !== 'CANCELLED' && (
                  <Progress
                    value={repairProgress(request.status)}
                    label={`${request.title} repair progress`}
                  />
                )}
                {text && (
                  <p style={{ fontSize: 13, marginTop: 8, whiteSpace: 'pre-wrap' }}>{text}</p>
                )}
                {visiblePhotos(request.photos).length > 0 && (
                  <div className={styles.photos}>
                    {visiblePhotos(request.photos).map(({ id, document }) =>
                      document ? (
                        <TenantPhoto
                          key={id}
                          alt={`${request.title} photo: ${document.name}`}
                          src={
                            document.leaseId
                              ? `/api/files/${document.id}/preview`
                              : `/lease/photos/${document.id}`
                          }
                        />
                      ) : null,
                    )}
                  </div>
                )}
                {request.events.length > 0 && (
                  <ul className={styles.timeline} aria-label="Updates">
                    {request.events.map((event) => (
                      <li key={event.id}>
                        {event.kind === 'COMMENT' ? (
                          <>
                            <strong>
                              {event.actorId === session.subjectId ? 'You' : 'Manager'}:
                            </strong>{' '}
                            {event.body}
                          </>
                        ) : (
                          <>Status: {event.toStatus ? repairStatusLabel(event.toStatus) : ''}</>
                        )}{' '}
                        <small>{shortDate(event.createdAt)}</small>
                      </li>
                    ))}
                  </ul>
                )}
                {own && (
                  <form className={styles.comment} method="post" action="/repairs/comment">
                    <input type="hidden" name="requestId" value={request.id} />
                    <label className="field" htmlFor={`comment-${request.id}`}>
                      Comment on {request.title}
                      <input
                        id={`comment-${request.id}`}
                        name="comment"
                        required
                        maxLength={2000}
                        aria-label={`Comment on ${request.title}`}
                        placeholder="Add a comment"
                      />
                    </label>
                    <button className="btn btn-secondary btn-sm" type="submit">
                      Send
                    </button>
                  </form>
                )}
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
