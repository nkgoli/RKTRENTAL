import Link from 'next/link';
import { db } from '@/lib/db/client';
import { invitationStatus } from '@/lib/applications/invitation-policy';
import { invitationDeliveryState } from '@/lib/applications/pipeline';
import { unitScopeWhere, type ScopeFilter } from '@/lib/workspace/scope';
import { Alert, Badge, Button, Steps } from '@/components/ui';
import styles from './invitations.module.css';

export const INVITATION_STEPS = [
  'Create & review',
  'Send or copy link',
  'Applicant submits',
  'You review',
];
const SHOWN = 6;

function shortDate(value: Date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(value);
}

/** Open invitations (not yet submitted) and saved drafts. Submitted applications are reviewed below. */
export async function InvitationList({
  organizationId,
  scope,
  linksUnavailable,
}: {
  organizationId: string;
  scope: ScopeFilter;
  /** Reason secure application links cannot be issued, or empty when they can. */
  linksUnavailable?: string;
}) {
  const where = { organizationId, ...unitScopeWhere(scope), submittedAt: null };
  const [open, invitations] = await Promise.all([
    db.applicationInvitation.count({ where }),
    db.applicationInvitation.findMany({
      where,
      include: {
        unit: { include: { property: true } },
        attempts: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { createdAt: 'desc' },
      take: SHOWN,
    }),
  ]);
  const query = new URLSearchParams({
    ...(scope.propertyId ? { propertyId: scope.propertyId } : {}),
    ...(scope.unitId ? { unitId: scope.unitId } : {}),
  });
  const sendHref = `/applications/send${query.size ? `?${query}` : ''}`;
  const now = new Date();
  return (
    <section
      className={`card ${styles.invitationsCard}`}
      aria-labelledby="invitations-title"
      id="invitations"
    >
      <div className={styles.cardHead}>
        <h2 id="invitations-title">Invitations · {open ? `${open} open` : 'none open'}</h2>
        <p className={styles.caption}>
          Invitations and saved drafts appear here. Submitted applications appear in the review list
          below.
        </p>
      </div>
      {linksUnavailable && (
        <Alert tone="warning">
          <div>
            <strong>Secure application links are unavailable</strong>
            <p>
              Ask your administrator to configure application invitations. You can still prepare an
              invitation; nothing is emailed until you review and send it.
            </p>
          </div>
        </Alert>
      )}
      <div className={styles.stepsWrap}>
        <Steps steps={INVITATION_STEPS} current={0} />
      </div>
      <p className={styles.caption}>
        The private link stays valid for seven days. Email status is tracked separately.
      </p>
      {invitations.length ? (
        <ul className={styles.rows}>
          {invitations.map((row) => {
            const delivery = invitationDeliveryState(row, row.attempts[0], now);
            return (
              <li key={row.id} className={styles.row}>
                <div>
                  <Link href={`/applications/invitations/${row.id}`}>
                    <strong>{row.draftName ?? row.applicantName}</strong>
                  </Link>
                  <small>
                    {row.applicantEmail} · {row.unit.property.name} ·{' '}
                    {row.unit.isImplicit ? 'Whole property' : `Unit ${row.unit.number}`}
                  </small>
                  <small>
                    {invitationStatus(row, now)}
                    {delivery.key === 'expired'
                      ? ` · expired ${shortDate(row.expiresAt)}`
                      : ` · link valid until ${shortDate(row.expiresAt)}`}
                  </small>
                </div>
                <Badge tone={delivery.tone}>{delivery.label}</Badge>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className={styles.emptyLine}>
          <p className={styles.muted}>No invitations yet. Invite an applicant to get started.</p>
          <Button href={sendHref} variant="secondary" size="sm" icon="arrow-right">
            Send application
          </Button>
        </div>
      )}
      {invitations.length > 0 && (
        <div className={styles.cardFoot}>
          <Link href={`/applications/invitations${query.size ? `?${query}` : ''}`}>
            {open > invitations.length
              ? `View all ${open} open invitations`
              : 'View all invitations'}
          </Link>
          <Button href={sendHref} variant="secondary" size="sm" icon="arrow-right">
            Send application
          </Button>
        </div>
      )}
    </section>
  );
}

const GUIDE = [
  {
    title: 'Invitation · not sent yet',
    body: 'A private link exists; no email attempted. Copying the link doesn’t change this.',
  },
  {
    title: 'Invitation · accepted by provider',
    body: 'Email handed off; delivery is unconfirmed.',
  },
  {
    title: 'Invitation · uncertain or failed',
    body: 'Failed can be retried. Uncertain blocks retry to prevent duplicate mail.',
  },
  {
    title: 'Invitation · link expired',
    body: 'Renew to issue a new 7-day link; the old one stops working.',
  },
  {
    title: 'Application · submitted',
    body: 'Moves into review below. Screening still needs FCRA consent.',
  },
];

/** Explains the invitation and application states shown on this screen. */
export function InvitationGuide() {
  return (
    <section className={styles.guide} aria-labelledby="invitation-guide-title">
      <h2 id="invitation-guide-title">Invitation or application?</h2>
      <div className={styles.accordion}>
        {GUIDE.map((item) => (
          <details key={item.title}>
            <summary>{item.title}</summary>
            <p>{item.body}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
