import Link from 'next/link';
import { db } from '@/lib/db/client';
import { invitationStatus } from '@/lib/applications/invitation-policy';
import { invitationDeliveryState } from '@/lib/applications/pipeline';
import { unitScopeWhere, type ScopeFilter } from '@/lib/workspace/scope';
import { Alert, Badge, Button } from '@/components/ui';
import styles from './invitations.module.css';

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
      <div className={styles.listHead}>
        <h2 id="invitations-title">Invitations · {open ? `${open} open` : 'none open'}</h2>
        <Button href={sendHref} variant="secondary" size="sm" icon="arrow-right">
          Send application
        </Button>
      </div>
      {linksUnavailable && (
        <Alert tone="warning">
          Secure application links are unavailable. Ask your administrator to set them up.
        </Alert>
      )}
      {invitations.length > 0 && (
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
      )}
      {invitations.length > 0 && (
        <Link
          className={styles.viewAll}
          href={`/applications/invitations${query.size ? `?${query}` : ''}`}
        >
          {open > invitations.length ? `View all ${open} open invitations` : 'View all invitations'}
        </Link>
      )}
    </section>
  );
}
