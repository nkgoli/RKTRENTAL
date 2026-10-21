import Link from 'next/link';
import { Alert } from '@/components/ui/Feedback';
import { EmptyState } from '@/components/RouteStates';
import { requireTenantRole } from '@/lib/auth/access';
import { formatUsd } from '@/lib/ledger/core';
import { loadTenantHome, type TenantHomeView } from '@/lib/tenant-portal';

import styles from '../portal.module.css';
import { PortalIcon } from './PortalIcon';
import { RenewalNotice } from './RenewalNotice';
import { RepairRequestCard } from '../_components/RepairRequestCard';

export const dynamic = 'force-dynamic';

const shortDate = (date: Date) =>
  date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

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
    <section className={styles.rentHero} aria-labelledby="rent-due">
      <div className={styles.heroTop}>
        <p id="rent-due" className="eyebrow">
          {settled ? 'Rent' : `Rent due ${due.dueDate ? shortDate(due.dueDate) : ''}`}
        </p>
        <span>
          <PortalIcon name="pay" />
        </span>
      </div>
      <div className={styles.paymentRow}>
        <div className={`amount ${settled ? styles.settled : ''}`}>
          {settled ? 'All paid up' : formatUsd(due.totalDueCents)}
        </div>
        {!settled && (
          <Link className="btn btn-primary btn-block" href="/pay">
            Pay now <PortalIcon name="arrow" />
          </Link>
        )}
        {settled && (
          <Link href="/pay" className="btn btn-primary btn-block">
            View payments &amp; receipts
          </Link>
        )}
      </div>
      <p>
        {view.premises} · {autopay}
      </p>
      {due.pendingCents > 0 && (
        <p className={styles.pending}>
          {formatUsd(due.pendingCents)} bank payment pending. Check Pay for its status.
        </p>
      )}
      <p className={styles.manager}>From {view.managerName}, your property manager</p>
    </section>
  );
}

export default async function TenantHomePage() {
  const session = await requireTenantRole();
  const view = await loadTenantHome(session);

  if (!view) {
    return (
      <div className={styles.homeLease}>
        <div>
          <h1 style={{ fontSize: 'var(--rr-h1)' }}>
            Welcome home
            <span className={styles.spark} aria-hidden="true">
              ✳
            </span>
          </h1>
        </div>
        <EmptyState
          title="No active lease yet"
          description="Your property manager will add it here once it is set up."
          action="Check again"
          href="/home"
        />
      </div>
    );
  }

  const repair = view.openRepair;

  return (
    <div className={`${styles.homeLease} ${styles.homeGrid}`}>
      <div className={styles.homeHeading}>
        <p className="muted" style={{ fontSize: 13 }}>
          Hi {view.tenantName} · {view.premises}
        </p>
        <h1 style={{ fontSize: 'var(--rr-h1)', marginTop: 2 }}>
          Welcome home
          <span className={styles.spark} aria-hidden="true">
            ✳
          </span>
        </h1>
      </div>

      <div className={styles.homePrimary}>
        <RentHero view={view} />

        <section aria-labelledby="quick-actions">
          <h2 id="quick-actions" style={{ fontSize: 'var(--rr-h3)', marginBottom: 8 }}>
            Quick actions
          </h2>
          <div className={styles.quickActions}>
            <Link className="tile" href="/lease">
              <span className="tile-icon">
                <PortalIcon name="lease" />
              </span>
              My lease
              <small className="muted" style={{ fontWeight: 400 }}>
                Terms &amp; details
              </small>
            </Link>
            <Link className="tile" href="/repairs">
              <span className="tile-icon">
                <PortalIcon name="repair" />
              </span>
              Request repair
              <small className="muted" style={{ fontWeight: 400 }}>
                Photos &amp; priority
              </small>
            </Link>
            <Link className="tile" href="/lease#documents">
              <span className="tile-icon">
                <PortalIcon name="folder" />
              </span>
              Documents
              <small className="muted" style={{ fontWeight: 400 }}>
                Lease &amp; notices
              </small>
            </Link>
          </div>
        </section>

        {view.notice?.kind === 'renewal' && (
          <RenewalNotice
            notice={view.notice}
            storageKey={`renewal:${view.leaseId}:${view.term.end.toISOString()}`}
            contactEmail={view.managerEmail}
            managerName={view.managerName}
          />
        )}
        {view.notice?.kind === 'move-out' && (
          <Alert tone="warning">
            <p>
              <strong>{view.notice.title}</strong>
              <br />
              <span className="muted">{view.notice.body}</span>
            </p>
          </Alert>
        )}
      </div>

      <div className={styles.homeSecondary}>
        {repair && (
          <section aria-labelledby="open-repair">
            <h2 id="open-repair" style={{ fontSize: 18, marginBottom: 8 }}>
              Open repair request
            </h2>
            <RepairRequestCard
              request={repair}
              action={<Link href="/repairs">View request →</Link>}
            />
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
            <ul className={styles.activity}>
              {view.activity.slice(0, 4).map((item) => (
                <li key={item.id} className="list-item" style={{ padding: '8px 0' }}>
                  <span className={styles.activityMark} aria-hidden="true">
                    {item.tone === 'success' ? '\u2713' : item.tone === 'warning' ? '!' : '\u2026'}
                  </span>
                  <span className="file-meta">
                    <strong>{item.title}</strong>
                    <small>{item.detail}</small>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
