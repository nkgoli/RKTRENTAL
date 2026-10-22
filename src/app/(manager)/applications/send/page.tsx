import { randomUUID } from 'node:crypto';
import { PageHeader } from '@/components/shell/PageHeader';
import { notFound } from 'next/navigation';
import { requireManagerWriteRole } from '@/lib/auth/access';
import { db } from '@/lib/db/client';
import {
  createInvitationToken,
  invitationOrigin,
  InvitationError,
} from '@/lib/applications/invitation-policy';
import { CreateInvitationForm } from '@/components/applications/InvitationForms';
import styles from '@/components/applications/invitations.module.css';

export default async function SendApplicationPage({
  searchParams,
}: {
  searchParams: Promise<{ propertyId?: string; unitId?: string }>;
}) {
  const [session, query] = await Promise.all([requireManagerWriteRole(), searchParams]);
  const properties = await db.property.findMany({
    where: { organizationId: session.organizationId, archivedAt: null },
    select: {
      id: true,
      name: true,
      units: { select: { id: true, number: true, isImplicit: true }, orderBy: { number: 'asc' } },
    },
    orderBy: { name: 'asc' },
  });
  const selected = query.propertyId
    ? properties.find((p) => p.id === query.propertyId)
    : query.unitId
      ? properties.find((p) => p.units.some((u) => u.id === query.unitId))
      : undefined;
  if (
    (query.propertyId && !selected) ||
    (query.unitId && !selected?.units.some((u) => u.id === query.unitId))
  )
    notFound();
  let configurationError = '';
  try {
    invitationOrigin();
    createInvitationToken();
  } catch (error) {
    configurationError =
      error instanceof InvitationError ? error.message : 'Application links are unavailable.';
  }
  return (
    <section className={styles.page}>
      <PageHeader
        eyebrow="Leasing"
        title="Send application"
        back={{
          href: `/applications${selected ? `?${new URLSearchParams({ propertyId: selected.id, ...(query.unitId ? { unitId: query.unitId } : {}) })}` : ''}`,
          label: 'Applications',
        }}
      />
      <p className={styles.intro}>
        Invite someone to apply for a property. Review their invitation, then send an email or share
        a private link.
      </p>
      {configurationError && (
        <p role="alert" className={styles.error}>
          {configurationError} Ask your administrator to configure application invitations.
        </p>
      )}
      {!properties.length && (
        <p className={styles.notice}>
          Add an active property and unit before creating an invitation.
        </p>
      )}
      <div className={styles.grid}>
        <CreateInvitationForm
          properties={properties}
          propertyId={selected?.id}
          unitId={query.unitId ?? (selected?.units.length === 1 ? selected.units[0].id : '')}
          requestKey={randomUUID()}
          disabled={Boolean(configurationError) || !properties.length}
        />
        <aside className={styles.card}>
          <h2>From invitation to review</h2>
          <ol className={styles.steps}>
            <li>
              <strong>Create & review</strong>
              <br />
              Check the applicant and property before sharing.
            </li>
            <li>
              <strong>Send or copy the link</strong>
              <br />
              The private link stays valid for seven days. Email status is tracked separately.
            </li>
            <li>
              <strong>Applicant submits</strong>
              <br />
              Their completed application appears in Applications for review. Screening
              authorization remains a separate step.
            </li>
          </ol>
        </aside>
      </div>
    </section>
  );
}
