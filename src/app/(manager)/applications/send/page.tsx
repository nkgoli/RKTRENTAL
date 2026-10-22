import { randomUUID } from 'node:crypto';
import { PageHeader } from '@/components/shell/PageHeader';
import { notFound } from 'next/navigation';
import { requireManagerWriteRole } from '@/lib/auth/access';
import { db } from '@/lib/db/client';
import { invitationLinkConfigurationError } from '@/lib/applications/link-config';
import { CreateInvitationForm } from '@/components/applications/InvitationForms';
import { INVITATION_STEPS } from '@/components/applications/InvitationList';
import { Alert, Steps } from '@/components/ui';
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
  const configurationError = invitationLinkConfigurationError();
  const backHref = `/applications${selected ? `?${new URLSearchParams({ propertyId: selected.id, ...(query.unitId ? { unitId: query.unitId } : {}) })}` : ''}`;
  return (
    <section className={styles.page} aria-label="Send application">
      <PageHeader
        eyebrow="Leasing"
        title="Send application"
        meta="Invite someone to apply for a property · nothing is emailed until you review and send"
        back={{ href: backHref, label: 'Applications' }}
      />
      {configurationError && (
        <Alert tone="warning">
          <div>
            <strong>Secure application links are unavailable</strong>
            <p>
              Secure application links must be configured before an invitation can be created.
              Nothing has been emailed. Ask your administrator to configure application invitations.
            </p>
          </div>
        </Alert>
      )}
      {!properties.length && (
        <p className={styles.notice}>
          Add an active property and unit before creating an invitation.
        </p>
      )}
      <div className={styles.stepsWrap}>
        <Steps steps={INVITATION_STEPS} current={0} />
      </div>
      <p className={styles.caption}>
        Step 1 of 4 · The private link stays valid for seven days. A submitted application appears
        in Applications for review; screening authorization remains a separate step.
      </p>
      <div className={styles.grid}>
        <CreateInvitationForm
          properties={properties}
          propertyId={selected?.id}
          unitId={query.unitId ?? (selected?.units.length === 1 ? selected.units[0].id : '')}
          requestKey={randomUUID()}
          disabled={Boolean(configurationError) || !properties.length}
          linksAvailable={!configurationError}
          cancelHref={backHref}
        />
      </div>
    </section>
  );
}
