import Link from 'next/link';
import { db } from '@/lib/db/client';
import { requireManagerRole } from '@/lib/auth/access';
import { Pagination, PAGE_SIZE, pageFrom } from '@/components/ui/Pagination';
import { Badge } from '@/components/ui';
import { PageHeader } from '@/components/shell/PageHeader';
import { scopeFilterFrom, unitScopeWhere } from '@/lib/workspace/scope';
import { invitationStatus } from '@/lib/applications/invitation-policy';
import { invitationDeliveryState } from '@/lib/applications/pipeline';
import styles from '@/components/applications/invitations.module.css';

export default async function InvitationsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; propertyId?: string; unitId?: string }>;
}) {
  const [session, query] = await Promise.all([requireManagerRole(), searchParams]);
  const scope = scopeFilterFrom(query);
  const where = { organizationId: session.organizationId, ...unitScopeWhere(scope) };
  const total = await db.applicationInvitation.count({ where });
  const page = pageFrom(query.page, total);
  const rows = await db.applicationInvitation.findMany({
    where,
    include: {
      unit: { include: { property: true } },
      attempts: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
    orderBy: { createdAt: 'desc' },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });
  const params = new URLSearchParams({
    ...(scope.propertyId ? { propertyId: scope.propertyId } : {}),
    ...(scope.unitId ? { unitId: scope.unitId } : {}),
  });
  const now = new Date();
  return (
    <section className={styles.page} aria-label="Application invitations">
      <PageHeader
        eyebrow="Leasing"
        title="Application invitations"
        meta={`${total} ${total === 1 ? 'invitation' : 'invitations'} · newest first`}
        back={{ href: `/applications${params.size ? `?${params}` : ''}`, label: 'Applications' }}
        actions={[
          {
            label: 'Send application',
            href: `/applications/send${params.size ? `?${params}` : ''}`,
            primary: true,
            icon: 'arrow-right',
          },
        ]}
      />
      <div className={`card ${styles.invitationsCard}`}>
        <ul className={styles.rows}>
          {rows.map((row) => {
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
                  <small>{invitationStatus(row, now)}</small>
                </div>
                <Badge tone={delivery.tone}>{delivery.label}</Badge>
              </li>
            );
          })}
        </ul>
        {!rows.length && <p className={styles.muted}>No invitations in this scope.</p>}
        <Pagination
          page={page}
          total={total}
          noun="invitations"
          href={(n) => {
            const p = new URLSearchParams(params);
            p.set('page', String(n));
            return `/applications/invitations?${p}`;
          }}
        />
      </div>
    </section>
  );
}
