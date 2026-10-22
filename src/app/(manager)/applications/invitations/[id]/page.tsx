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
import { reminderTransport } from '@/lib/notifications/reminder-transport';
import { InvitationDelivery } from '@/components/applications/InvitationForms';
import styles from '@/components/applications/invitations.module.css';

export default async function InvitationPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireManagerRole();
  const row = await getManagerInvitation(session, (await params).id).catch((error) => {
    if (error instanceof InvitationError && error.status === 404) notFound();
    throw error;
  });
  const expired = row.expiresAt <= new Date();
  const latest = row.attempts.find((a) => a.generation === row.generation);
  const blocked = Boolean(latest && ['SENDING', 'UNCERTAIN'].includes(latest.status));
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
  let readiness =
    'Email unavailable. Configure an organization email provider, or copy the private link.';
  try {
    const transport = await reminderTransport(session.organizationId, 'EMAIL', db);
    readiness =
      transport.name === 'mock'
        ? 'Sandbox mode: sending records a test attempt. No email leaves the application.'
        : 'Email is configured. Sending requests provider acceptance; inbox delivery is not confirmed.';
  } catch {
    /* Unconfigured transport is an expected product state. */
  }
  const scope = new URLSearchParams({ propertyId: row.unit.propertyId, unitId: row.unitId });
  return (
    <section className={styles.page}>
      <Link href={`/applications?${scope}`}>← Back to applications</Link>
      <p className={styles.eyebrow} style={{ marginTop: 24 }}>
        Application invitation
      </p>
      <h1 className={styles.title}>{row.applicantName}</h1>
      <p className={styles.intro}>
        {row.applicantEmail}
        <br />
        {row.unit.property.name} ·{' '}
        {row.unit.isImplicit ? 'Whole property' : `Unit ${row.unit.number}`}
      </p>
      <div className={styles.grid}>
        <section className={styles.card} aria-label="Invitation status">
          <h2>{invitationStatus(row)}</h2>
          <p className={styles.muted}>
            {row.submittedAt
              ? `Submitted ${row.submittedAt.toLocaleString('en-US', { timeZone: 'UTC' })} UTC`
              : `Link expires ${row.expiresAt.toLocaleString('en-US', { timeZone: 'UTC' })} UTC`}
          </p>
          {row.applicationId && (
            <>
              <p>
                The completed application is available for review. Screening has not been authorized
                by submitting this form.
              </p>
              <Link
                className="btn btn-primary"
                href={`/applications?${scope}&applicant=${row.applicationId}#selected-applicant`}
              >
                Review submitted application
              </Link>
            </>
          )}
          {!row.submittedAt && <p className={styles.notice}>{readiness}</p>}
          <p role="status">
            <strong>
              {latest
                ? (deliveryLabels[latest.status] ?? 'Email status unavailable')
                : 'No email attempt for this link'}
            </strong>
          </p>
          {configurationError && (
            <p role="alert" className={styles.error}>
              {configurationError}
            </p>
          )}
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
            <details style={{ marginTop: 24 }}>
              <summary>Recent email attempts</summary>
              <ul className={styles.history}>
                {row.attempts.map((a) => (
                  <li key={a.id}>
                    {deliveryLabels[a.status] ?? a.status}
                    <br />
                    {a.createdAt.toLocaleString('en-US', { timeZone: 'UTC' })} UTC · link version{' '}
                    {a.generation}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </section>
        <aside className={styles.card} aria-label="Email preview">
          <h2>Email preview</h2>
          {preview ? (
            <>
              <p className={styles.muted}>To: {row.applicantEmail}</p>
              <strong>{preview.subject}</strong>
              <p className={styles.preview}>{preview.body}</p>
            </>
          ) : (
            <p className={styles.muted}>
              {row.submittedAt
                ? 'This application is already submitted. No further invitation email is needed.'
                : 'Renew an expired link to preview its email.'}
            </p>
          )}
        </aside>
      </div>
    </section>
  );
}
