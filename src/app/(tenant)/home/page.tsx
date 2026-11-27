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
  return (
    <section className={styles.rentHero} aria-labelledby="rent-due">
      <p id="rent-due" className="eyebrow">
        {settled ? 'Rent' : `Rent due ${due.dueDate ? shortDate(due.dueDate) : ''}`}
      </p>
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
      <p className={styles.heroNote}>
        {pay.autopay.enabled ? 'Autopay is on.' : 'Autopay is off.'}
      </p>
      {due.pendingCents > 0 && (
        <p className={styles.pending}>{formatUsd(due.pendingCents)} bank payment pending.</p>
      )}
    </section>
  );
}

export default async function TenantHomePage() {
  const session = await requireTenantRole();
  const view = await loadTenantHome(session);

  if (!view) {
    return (
      <div className={styles.homeLease}>
        <h1 style={{ fontSize: 'var(--rr-h1)' }}>Welcome home</h1>
        <EmptyState
          title="No active lease yet"
          description="Your property manager will add it here."
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
        <h1 style={{ fontSize: 'var(--rr-h1)' }}>Welcome home</h1>
        <p className={styles.subline}>{view.premises}</p>
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
            </Link>
            <Link className="tile" href="/repairs">
              <span className="tile-icon">
                <PortalIcon name="repair" />
              </span>
              Request repair
            </Link>
            <Link className="tile" href="/lease#documents">
              <span className="tile-icon">
                <PortalIcon name="folder" />
              </span>
              Documents
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
            <p className={styles.emptyNote}>No announcements yet.</p>
          ) : (
            // One compact line per item: what happened, then amount and date.
            <ul className={styles.activity}>
              {view.activity.slice(0, 4).map((item) => (
                <li key={item.id}>
                  <span className={styles.activityMark} data-tone={item.tone} aria-hidden="true">
                    {item.tone === 'success' ? '\u2713' : item.tone === 'warning' ? '!' : '\u2026'}
                  </span>
                  <strong>{item.title}</strong>
                  <span className={styles.activityDetail}>{item.detail}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
