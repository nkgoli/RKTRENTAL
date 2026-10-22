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
import { Alert, Badge, Steps } from '@/components/ui';
import { InvitationDelivery } from '@/components/applications/InvitationForms';
import { INVITATION_STEPS } from '@/components/applications/InvitationList';
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
  const home = `${row.unit.property.name} · ${row.unit.isImplicit ? 'Whole property' : `Unit ${row.unit.number}`}`;
  const step = row.submittedAt ? 3 : expired ? 0 : 1;
  const emailStatus = latest
    ? (deliveryLabels[latest.status] ?? 'Email status unavailable')
    : 'No email attempt for this link';
  return (
    <section className={styles.page} aria-label="Application invitation">
      <PageHeader
        eyebrow="Leasing · Application invitation"
        title={row.applicantName}
        meta={`${row.applicantEmail} · ${home}`}
        back={{ href: `/applications?${scope}`, label: 'Applications' }}
      />
      <div className={styles.stepsWrap}>
        <Steps steps={INVITATION_STEPS} current={step} />
      </div>
      <div className={styles.grid}>
        <section className={`card ${styles.formCard}`} aria-labelledby="invitation-status-title">
          <div className={styles.cardHead}>
            <p className={styles.eyebrow}>Invitation</p>
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
              <p>
                The completed application is available for review. Screening has not been authorized
                by submitting this form.
              </p>
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
          {!row.submittedAt && <p className={styles.notice}>{readiness}</p>}
          <p role="status">
            <strong>{emailStatus}</strong>
          </p>
          {configurationError && (
            <Alert tone="error">
              <div>
                <strong>Secure application links are unavailable</strong>
                <p>{configurationError}</p>
              </div>
            </Alert>
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
            <p className={styles.eyebrow}>Review before sending</p>
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
                    ? 'Expired · renew to issue a new seven-day link'
                    : link
                      ? `Active until ${utc(row.expiresAt)}`
                      : 'Unavailable · check invitation configuration'}
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
            <p className={styles.muted}>
              {row.submittedAt
                ? 'This application is already submitted. No further invitation email is needed.'
                : configurationError
                  ? 'The email preview appears once secure application links are available.'
                  : 'Renew an expired link to preview its email.'}
            </p>
          )}
          <p className={styles.caption}>
            A private link lasts seven days. Provider acceptance does not confirm delivery.
          </p>
        </aside>
      </div>
    </section>
  );
}
