import Link from 'next/link';
import { db } from '@/lib/db/client';
import { deliveryLabels, invitationStatus } from '@/lib/applications/invitation-policy';
import { unitScopeWhere, type ScopeFilter } from '@/lib/workspace/scope';
import styles from './invitations.module.css';

export async function InvitationList({
  organizationId,
  scope,
}: {
  organizationId: string;
  scope: ScopeFilter;
}) {
  const invitations = await db.applicationInvitation.findMany({
    where: { organizationId, ...unitScopeWhere(scope) },
    include: {
      unit: { include: { property: true } },
      attempts: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });
  const query = new URLSearchParams({
    ...(scope.propertyId ? { propertyId: scope.propertyId } : {}),
    ...(scope.unitId ? { unitId: scope.unitId } : {}),
  });
  return (
    <section className={styles.list} aria-label="Application invitations">
      <div className={styles.listHead}>
        <h2>Invitations</h2>
        <Link href={`/applications/send${query.size ? `?${query}` : ''}`}>Send application</Link>
      </div>
      <p className={styles.muted}>
        Invitations and saved drafts appear here. Submitted applications appear in the review list
        below.
      </p>
      {invitations.length ? (
        <ul className={styles.rows}>
          {invitations.map((row) => {
            const latest =
              row.attempts[0]?.generation === row.generation ? row.attempts[0] : undefined;
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
                    {latest
                      ? (deliveryLabels[latest.status] ?? 'Email status unavailable')
                      : 'No email attempted for this link'}
                  </small>
                </div>
                <span className={styles.state}>{invitationStatus(row)}</span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className={styles.muted}>No invitations yet. Invite an applicant to get started.</p>
      )}
      {invitations.length === 10 && (
        <Link href={`/applications/invitations?${query}`}>View all invitations</Link>
      )}
    </section>
  );
}
