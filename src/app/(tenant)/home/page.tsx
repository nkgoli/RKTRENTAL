import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { Alert, Progress } from '@/components/ui/Feedback';
import { EmptyState } from '@/components/RouteStates';
import { requireTenantRole } from '@/lib/auth/access';
import { formatUsd } from '@/lib/ledger/core';
import { formatDate } from '@/lib/properties/format';
import {
  loadTenantHome,
  repairProgress,
  repairStatusLabel,
  type TenantHomeView,
} from '@/lib/tenant-portal';

export const dynamic = 'force-dynamic';

const shortDate = (date: Date) =>
  date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

const icon = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
};

function RentHero({ view }: { view: TenantHomeView }) {
  const { pay } = view;
  const due = pay.amountDue;
  const settled = due.totalDueCents <= 0;
  const autopay = pay.autopay.enabled
    ? 'Autopay is on.'
    : due.dueDate
      ? `Autopay is off — pay by ${shortDate(due.dueDate)} to avoid a late fee.`
      : 'Autopay is off.';
  return (
    <section className="phone-hero" aria-labelledby="rent-due">
      <p id="rent-due" className="eyebrow">
        {settled ? 'Rent' : `Rent due ${due.dueDate ? shortDate(due.dueDate) : ''}`}
      </p>
      <div className="amount">{settled ? 'All paid up' : formatUsd(due.totalDueCents)}</div>
      <p>
        {view.premises} · {autopay}
      </p>
      {!settled && (
        <Link
          className="btn btn-primary btn-block"
          href="/pay"
          style={{ marginTop: 12, color: '#fff' }}
        >
          Pay now
        </Link>
      )}
      {due.pendingCents > 0 && (
        <p style={{ fontSize: 13, marginTop: 8 }}>
          {formatUsd(due.pendingCents)} bank payment pending. Check Pay for its status.
        </p>
      )}
      {settled && (
        <Link href="/pay" className="btn btn-secondary btn-block" style={{ marginTop: 12 }}>
          View payments &amp; receipts
        </Link>
      )}
      <p style={{ fontSize: 12, marginTop: 10 }}>From {view.managerName}, your property manager</p>
    </section>
  );
}

export default async function TenantHomePage() {
  const session = await requireTenantRole();
  const view = await loadTenantHome(session);

  if (!view) {
    return (
      <>
        <div>
          <h1 style={{ fontSize: 'var(--rr-h1)' }}>Welcome home</h1>
        </div>
        <EmptyState
          title="No active lease yet"
          description="Your property manager will add it here once it is set up."
          action="Check again"
          href="/home"
        />
      </>
    );
  }

  const repair = view.openRepair;

  return (
    <>
      <div>
        <p className="muted" style={{ fontSize: 13 }}>
          Hi {view.tenantName} · {view.premises}
        </p>
        <h1 style={{ fontSize: 'var(--rr-h1)', marginTop: 2 }}>Welcome home</h1>
      </div>

      <RentHero view={view} />

      <section aria-labelledby="quick-actions">
        <h2 id="quick-actions" style={{ fontSize: 'var(--rr-h3)', marginBottom: 8 }}>
          Quick actions
        </h2>
        <div className="tile-grid">
          <Link className="tile" href="/pay">
            <span className="tile-icon">
              <svg {...icon}>
                <rect x="2.5" y="5" width="19" height="14" rx="2" />
                <path d="M2.5 10h19M6 15h4" />
              </svg>
            </span>
            Pay rent
            <small className="muted" style={{ fontWeight: 400 }}>
              Bank or card · autopay
            </small>
          </Link>
          <Link className="tile" href="/lease">
            <span className="tile-icon">
              <svg {...icon}>
                <path d="M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8zM14 3v5h5M9 13h6M9 17h6" />
              </svg>
            </span>
            My lease
            <small className="muted" style={{ fontWeight: 400 }}>
              {formatDate(view.term.start)} – {formatDate(view.term.end)}
            </small>
          </Link>
          <Link className="tile" href="/repairs">
            <span className="tile-icon">
              <svg {...icon}>
                <path d="M14.5 6.5a4 4 0 0 0 5 5L21 13l-8 8a2.1 2.1 0 0 1-3-3l8-8z" />
                <path d="M14.5 6.5a4 4 0 0 1 5-3.5l-2.5 2.5 1.5 1.5L21 4.5" />
              </svg>
            </span>
            Request repair
            <small className="muted" style={{ fontWeight: 400 }}>
              Photos &amp; priority
            </small>
          </Link>
          <Link className="tile" href="/lease#documents">
            <span className="tile-icon">
              <svg {...icon}>
                <path d="M3 6a1 1 0 0 1 1-1h5l2 2h8a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" />
              </svg>
            </span>
            Documents
            <small className="muted" style={{ fontWeight: 400 }}>
              Lease, inspection &amp; notices
            </small>
          </Link>
        </div>
      </section>

      {view.notice && (
        <Alert tone={view.notice.kind === 'move-out' ? 'warning' : 'info'}>
          <p>
            <strong>{view.notice.title}</strong>
            <br />
            <span className="muted">{view.notice.body}</span>
          </p>
        </Alert>
      )}

      {repair && (
        <section className="card" aria-labelledby="open-repair">
          <div className="card-header" style={{ marginBottom: 8 }}>
            <h2 id="open-repair" style={{ fontSize: 18 }}>
              Open repair request
            </h2>
            <Badge tone="warning">{repairStatusLabel(repair.status)}</Badge>
          </div>
          <p style={{ fontWeight: 600 }}>{repair.title}</p>
          <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
            Submitted {shortDate(repair.createdAt)}
            {repair.vendorName ? ' · Vendor assigned' : ''} · {view.managerName} will confirm a
            visit window.
          </p>
          <Progress
            value={repairProgress(repair.status)}
            label={`${repair.title} repair progress`}
            style={{ margin: '12px 0 8px' }}
          />
          <div className="row between">
            <small className="muted">Received → Scheduled → Done</small>
            <Link href="/repairs" style={{ fontSize: 13, fontWeight: 600 }}>
              View →
            </Link>
          </div>
        </section>
      )}

      <section aria-labelledby="announcements">
        <h2 id="announcements" style={{ fontSize: 'var(--rr-h3)', marginBottom: 8 }}>
          Announcements
        </h2>
        {view.activity.length === 0 ? (
          <p className="muted">Payments and notices will show up here.</p>
        ) : (
          // Announcements are a short list, not a stack of coloured banners.
          <ul
            className="card"
            style={{ listStyle: 'none', margin: 0, padding: '4px var(--rr-card-pad)' }}
          >
            {view.activity.slice(0, 4).map((item) => (
              <li key={item.id} className="list-item" style={{ padding: '8px 0' }}>
                <span className="file-meta">
                  <strong>{item.title}</strong>
                  <small>{item.detail}</small>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
