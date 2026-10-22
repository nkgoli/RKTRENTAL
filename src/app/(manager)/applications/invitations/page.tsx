import Link from 'next/link';
import { db } from '@/lib/db/client';
import { requireManagerRole } from '@/lib/auth/access';
import { Pagination, PAGE_SIZE, pageFrom } from '@/components/ui/Pagination';
import { scopeFilterFrom, unitScopeWhere } from '@/lib/workspace/scope';
import { invitationStatus } from '@/lib/applications/invitation-policy';
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
    include: { unit: { include: { property: true } } },
    orderBy: { createdAt: 'desc' },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });
  const params = new URLSearchParams({
    ...(scope.propertyId ? { propertyId: scope.propertyId } : {}),
    ...(scope.unitId ? { unitId: scope.unitId } : {}),
  });
  return (
    <section className={styles.page}>
      <Link href={`/applications?${params}`}>← Back to applications</Link>
      <h1 className={styles.title}>Application invitations</h1>
      <div className={styles.card}>
        <ul className={styles.rows}>
          {rows.map((row) => (
            <li key={row.id} className={styles.row}>
              <div>
                <Link href={`/applications/invitations/${row.id}`}>
                  <strong>{row.draftName ?? row.applicantName}</strong>
                </Link>
                <small>
                  {row.applicantEmail} · {row.unit.property.name} ·{' '}
                  {row.unit.isImplicit ? 'Whole property' : `Unit ${row.unit.number}`}
                </small>
              </div>
              <span className={styles.state}>{invitationStatus(row)}</span>
            </li>
          ))}
        </ul>
        {!rows.length && <p>No invitations in this scope.</p>}
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
