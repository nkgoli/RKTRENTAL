import Link from 'next/link';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { Alert, Progress } from '@/components/ui/Feedback';
import { requireTenantRole } from '@/lib/auth/access';
import { repairProgress, repairStatusLabel } from '@/lib/tenant-portal';
import { commentRepairAction } from './actions';
import { loadTenantRepairs } from './data';
import { CATEGORIES, ENTRY_OPTIONS, MAX_PHOTOS, parseDescription, URGENCY_OPTIONS } from './format';
import styles from './repairs.module.css';

export const dynamic = 'force-dynamic';

type SearchParams = Promise<{ notice?: string }>;

const notices: Record<string, { tone: 'success' | 'warning'; text: string }> = {
  submitted: {
    tone: 'success',
    text: 'Repair request sent. Your manager will assign a vendor and confirm timing.',
  },
  commented: { tone: 'success', text: 'Comment added.' },
  'comment-failed': { tone: 'warning', text: 'Write a comment of up to 2000 characters.' },
  invalid: {
    tone: 'warning',
    text: 'Choose a category, entry permission and urgency, and describe what needs fixing.',
  },
  'too-many-photos': { tone: 'warning', text: `Add up to ${MAX_PHOTOS} photos.` },
  'bad-photo': { tone: 'warning', text: 'Photos must be image files such as JPG or PNG.' },
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
      <>
        <h1 style={{ fontSize: 22 }}>Repairs</h1>
        <section className="card">
          <h3 style={{ fontSize: 15 }}>No active lease</h3>
          <p className="muted" style={{ fontSize: 13, marginTop: 6 }}>
            There is no active lease on your account yet, so you cannot send a repair request.
          </p>
        </section>
      </>
    );
  }

  return (
    <>
      <div>
        <p className="eyebrow">
          {view.propertyName} · Unit {view.unitNumber}
        </p>
        <h1 style={{ fontSize: 22 }}>Repairs</h1>
        <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
          {view.tenantName} · Your manager will assign a vendor and confirm timing.
        </p>
      </div>

      {notice && (
        <Alert tone={notice.tone}>
          <div>{notice.text}</div>
        </Alert>
      )}

      <section className="card" aria-labelledby="new-request-title">
        <div className="card-header">
          <h3 id="new-request-title" style={{ fontSize: 15 }}>
            New repair request
          </h3>
          <Badge tone="info">Unit {view.unitNumber}</Badge>
        </div>
        <form className="form" method="post" action="/repairs/submit" encType="multipart/form-data">
          <label className="field">
            Category
            <select name="category" defaultValue={CATEGORIES[0]}>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="field">
            What needs fixing?
            <textarea
              name="description"
              required
              maxLength={2800}
              placeholder="e.g. Kitchen faucet leaks under the sink…"
            />
            <span className="hint">
              Add where it is and when it started, so the vendor brings the right parts.
            </span>
          </label>
          <label className={styles.upload}>
            <p>
              <strong>+ Add photos</strong>
            </p>
            <p style={{ fontSize: 13, marginTop: 4 }}>
              Tap to take or upload photos · JPG/PNG · Up to {MAX_PHOTOS}
            </p>
            <input type="file" name="photos" accept="image/*" multiple aria-label="Photos" />
          </label>
          <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
            <legend style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
              Entry permission
            </legend>
            <div className="stack" style={{ gap: 8 }}>
              {Object.entries(ENTRY_OPTIONS).map(([value, label], index) => (
                <label className={styles.option} key={value}>
                  <input type="radio" name="entry" value={value} defaultChecked={index === 0} />
                  <span style={{ flex: 1, fontSize: 14 }}>{label}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <label className="field">
            Urgency
            <select name="urgency" defaultValue="NORMAL">
              {URGENCY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <span className="hint">
              For emergencies (burst pipe, no heat) also call your property manager.
            </span>
          </label>
          <button className="btn btn-primary btn-block" type="submit">
            Submit request
          </button>
        </form>
      </section>

      <section aria-labelledby="your-requests-title">
        <h2 id="your-requests-title" style={{ fontSize: 16, marginBottom: 12 }}>
          Your requests
        </h2>
        <div className="stack" style={{ gap: 12 }}>
          {view.requests.length === 0 && (
            <p className="muted" style={{ fontSize: 13 }}>
              No repair requests for your unit yet.
            </p>
          )}
          {view.requests.map((request) => {
            const { category, text } = parseDescription(request.description);
            const own = request.tenantId === session.tenantId;
            return (
              <article className="card" key={request.id} id={`request-${request.id}`}>
                <div className="row between">
                  <strong style={{ fontSize: 14 }}>{request.title}</strong>
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
                  <Progress value={repairProgress(request.status)} />
                )}
                {text && (
                  <p style={{ fontSize: 13, marginTop: 8, whiteSpace: 'pre-wrap' }}>{text}</p>
                )}
                {request.photos.length > 0 && (
                  <div className={styles.photos}>
                    {request.photos.map(({ id, document }) =>
                      document ? (
                        <div
                          key={id}
                          role="img"
                          aria-label={`${request.title} photo: ${document.name}`}
                          className={styles.photo}
                          style={{
                            backgroundImage: `url(${
                              document.leaseId
                                ? `/api/files/${document.id}/preview`
                                : `/lease/photos/${document.id}`
                            })`,
                          }}
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
                  <form className={styles.comment} action={commentRepairAction}>
                    <input type="hidden" name="requestId" value={request.id} />
                    <input
                      name="comment"
                      required
                      maxLength={2000}
                      aria-label={`Comment on ${request.title}`}
                      placeholder="Add a comment"
                    />
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

      <p style={{ textAlign: 'center' }}>
        <Link href="/home" style={{ fontSize: 13 }}>
          ← Back to home
        </Link>{' '}
        ·{' '}
        <Link href="/pay" style={{ fontSize: 13 }}>
          Pay rent
        </Link>
      </p>
    </>
  );
}
