import type { AuthSession } from '@/lib/auth/session';
import { db } from '@/lib/db/client';
import { formatDate } from '@/lib/properties/format';
import styles from './signing.module.css';
import { DocumentLinks } from './AgreementContent';

/** Discovery is separate from the current lease used for rent and billing. */
export async function LeaseAgreementList({
  session,
  tenantPortal = false,
}: {
  session: AuthSession;
  tenantPortal?: boolean;
}) {
  if (session.role !== 'OWNER' && session.role !== 'TENANT') return null;
  if (session.role === 'TENANT' && !session.tenantId) return null;
  const leases = await db.lease.findMany({
    where: {
      organizationId: session.organizationId,
      ...(session.role === 'TENANT'
        ? {
            tenants: {
              some: { tenantId: session.tenantId, organizationId: session.organizationId },
            },
          }
        : {
            unit: {
              property: { ownerId: session.subjectId, organizationId: session.organizationId },
            },
          }),
      OR: [{ status: { not: 'DRAFT' } }, { agreements: { some: {} } }],
    },
    include: {
      unit: { include: { property: true } },
      agreements: { orderBy: { version: 'desc' }, take: 1 },
      documents: { where: { agreementFiles: { some: {} } }, orderBy: { createdAt: 'desc' } },
    },
    orderBy: { startDate: 'desc' },
  });
  return (
    <section className={styles.panel} aria-label="Current, upcoming and previous agreements">
      <h2>Your agreements</h2>
      <p className={styles.muted}>Current, upcoming and previous leases stay available here.</p>
      {!leases.length && <p>No agreements are available yet.</p>}
      {leases.map((lease) => {
        const agreement = lease.agreements[0];
        return (
          <div className={styles.file} key={lease.id}>
            <div>
              <strong>
                {lease.unit.property.name} · {lease.unit.number}
              </strong>
              <p>
                {formatDate(lease.startDate)} – {formatDate(lease.endDate)}
              </p>
              <small>
                {lease.startDate > new Date()
                  ? 'Upcoming'
                  : lease.endDate < new Date()
                    ? 'Previous'
                    : 'Current'}{' '}
                ·{' '}
                {agreement?.supersededAt
                  ? 'Agreement changed · awaiting a new version'
                  : agreement?.archiveStatus === 'ARCHIVED'
                    ? 'Documents ready'
                    : agreement?.signedAt
                      ? 'All signed · document processing'
                      : agreement
                        ? 'Awaiting signatures'
                        : 'Not sent for signing'}
              </small>
              {!tenantPortal &&
                lease.documents.map((file) => (
                  <div key={file.id} className={styles.file}>
                    <span>{file.name}</span>
                    <DocumentLinks
                      id={file.id}
                      name={file.name}
                      preview={
                        file.mimeType === 'application/pdf' || file.mimeType.startsWith('image/')
                      }
                    />
                  </div>
                ))}
            </div>
            <div className={styles.actions}>
              {agreement && (
                <a className="btn btn-secondary" href={`/sign/leases/${lease.id}`}>
                  Review &amp; sign
                </a>
              )}
              {tenantPortal && (
                <a className="btn btn-secondary" href={`/lease?lease=${lease.id}#documents`}>
                  Lease &amp; documents
                </a>
              )}
            </div>
          </div>
        );
      })}
    </section>
  );
}
