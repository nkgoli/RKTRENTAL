import { randomUUID } from 'node:crypto';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requireManagerRole } from '@/lib/auth/access';
import { db } from '@/lib/db/client';
import { getManagerInvitation, invitationMessage } from '@/lib/applications/invitations';
import {
  deliveryLabels,
  invitationLink,
  invitationStatus,
  InvitationError,
} from '@/lib/applications/invitation-policy';
import { invitationDeliveryState } from '@/lib/applications/pipeline';
import { reminderTransport } from '@/lib/notifications/reminder-transport';
import { PageHeader } from '@/components/shell/PageHeader';
import { Alert, Badge } from '@/components/ui';
import { InvitationDelivery } from '@/components/applications/InvitationForms';
import styles from '@/components/applications/invitations.module.css';

function utc(value: Date) {
  return `${value.toLocaleString('en-US', { timeZone: 'UTC' })} UTC`;
}

export default async function InvitationPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireManagerRole();
  const row = await getManagerInvitation(session, (await params).id).catch((error) => {
    if (error instanceof InvitationError && error.status === 404) notFound();
    throw error;
  });
  const now = new Date();
  const expired = row.expiresAt <= now;
  const latest = row.attempts.find((a) => a.generation === row.generation);
  const blocked = Boolean(latest && ['SENDING', 'UNCERTAIN'].includes(latest.status));
  const delivery = invitationDeliveryState(row, latest, now);
  let link: string | undefined;
  let preview: { subject: string; body: string } | undefined;
  let configurationError = '';
  if (!expired && !row.submittedAt)
    try {
      link = invitationLink(row.tokenCipher);
      preview = invitationMessage(row);
    } catch (e) {
      configurationError = e instanceof Error ? e.message : 'Application link unavailable.';
    }
  let readiness: string | undefined = 'Email isn’t set up. Copy the private link instead.';
  try {
    const transport = await reminderTransport(session.organizationId, 'EMAIL', db);
    readiness = transport.name === 'mock' ? 'Sandbox · sending records a test attempt' : undefined;
  } catch {
    /* Unconfigured transport is an expected product state. */
  }
  const scope = new URLSearchParams({ propertyId: row.unit.propertyId, unitId: row.unitId });
  const home = `${row.unit.property.name} · ${row.unit.isImplicit ? 'Whole property' : `Unit ${row.unit.number}`}`;
  const emailStatus = latest
    ? (deliveryLabels[latest.status] ?? 'Email status unavailable')
    : 'No email attempt for this link';
  return (
    <section className={styles.page} aria-label="Application invitation">
      <PageHeader
        title={row.applicantName}
        meta={`${row.applicantEmail} · ${home}`}
        back={{ href: `/applications?${scope}`, label: 'Applications' }}
      />
      <div className={styles.grid}>
        <section className={`card ${styles.formCard}`} aria-labelledby="invitation-status-title">
          <div className={styles.cardHead}>
            <h2 id="invitation-status-title">{invitationStatus(row, now)}</h2>
            <p className={styles.caption}>
              {row.submittedAt
                ? `Submitted ${utc(row.submittedAt)}`
                : `${expired ? 'Link expired' : 'Link expires'} ${utc(row.expiresAt)}`}
            </p>
          </div>
          <p className={styles.statusLine}>
            <Badge tone={delivery.tone}>{delivery.label}</Badge>
          </p>
          {row.applicationId && (
            <>
              <p className={styles.caption}>Submitting does not authorize screening.</p>
              <div className={styles.actions}>
                <Link
                  className="btn btn-primary"
                  href={`/applications?${scope}&applicant=${row.applicationId}#selected-applicant`}
                >
                  Review submitted application
                </Link>
              </div>
            </>
          )}
          {!row.submittedAt && readiness && <p className={styles.notice}>{readiness}</p>}
          {configurationError && <Alert tone="error">{configurationError}</Alert>}
          <InvitationDelivery
            id={row.id}
            generation={row.generation}
            requestKey={randomUUID()}
            link={link}
            expired={expired}
            submitted={Boolean(row.submittedAt)}
            blocked={blocked || Boolean(row.unit.property.archivedAt)}
            latestStatus={latest?.status}
          />
          {row.attempts.length > 0 && (
            <details>
              <summary>Recent email attempts</summary>
              <ul className={styles.history}>
                {row.attempts.map((a) => (
                  <li key={a.id}>
                    {deliveryLabels[a.status] ?? a.status}
                    <br />
                    {utc(a.createdAt)} · link version {a.generation}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>
        <aside className={`card ${styles.formCard}`} aria-labelledby="invitation-preview-title">
          <div className={styles.cardHead}>
            <h2 id="invitation-preview-title">Invitation preview</h2>
          </div>
          <dl className={styles.summaryList}>
            <div>
              <dt>Applicant</dt>
              <dd>
                {row.draftName ?? row.applicantName} · {row.applicantEmail}
              </dd>
            </div>
            <div>
              <dt>Home</dt>
              <dd>{home}</dd>
            </div>
            <div>
              <dt>Private link</dt>
              <dd>
                {row.submittedAt
                  ? 'Used · application submitted'
                  : expired
                    ? 'Expired'
                    : link
                      ? `Active until ${utc(row.expiresAt)}`
                      : 'Unavailable'}
              </dd>
            </div>
            <div>
              <dt>Email status</dt>
              <dd>{emailStatus}</dd>
            </div>
          </dl>
          {preview ? (
            <>
              <p className={styles.muted}>To: {row.applicantEmail}</p>
              <strong>{preview.subject}</strong>
              <p className={styles.preview}>{preview.body}</p>
            </>
          ) : (
            !row.submittedAt && (
              <p className={styles.muted}>
                {configurationError
                  ? 'No preview until secure links are set up.'
                  : 'Renew the link to preview its email.'}
              </p>
            )
          )}
        </aside>
      </div>
    </section>
  );
}
