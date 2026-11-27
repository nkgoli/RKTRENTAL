import type { AuthSession } from '@/lib/auth/session';
import { db } from '@/lib/db/client';
import { formatDate } from '@/lib/properties/format';
import styles from './signing.module.css';
import { DocumentLinks } from './AgreementContent';

/** Discovery is separate from the current lease used for rent and billing. */
export async function LeaseAgreementList({
  session,
  tenantPortal = false,
  currentLeaseId,
}: {
  session: AuthSession;
  tenantPortal?: boolean;
  /** Tenant portal: the lease whose documents the page already shows; its row links nowhere. */
  currentLeaseId?: string;
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
      {!leases.length && <p>No agreements yet.</p>}
      {leases.map((lease) => {
        const agreement = lease.agreements[0];
        const documentsLink = tenantPortal && lease.id !== currentLeaseId;
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
            {(documentsLink || agreement) && (
              <div className={styles.actions}>
                {documentsLink && (
                  <a className={styles.quietLink} href={`/lease?lease=${lease.id}#documents`}>
                    View documents
                  </a>
                )}
                {agreement && (
                  <a
                    className={
                      !agreement.signedAt && !agreement.supersededAt
                        ? 'btn btn-primary'
                        : 'btn btn-secondary'
                    }
                    href={`/sign/leases/${lease.id}`}
                  >
                    Review &amp; sign
                  </a>
                )}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
