import type { Metadata } from 'next';
import { getApplicantInvitation } from '@/lib/applications/invitations';
import { ApplicantForm } from '@/components/applications/InvitationForms';
import styles from '@/components/applications/invitations.module.css';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'Your rental application | RocketRental',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default async function ApplyPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const row = await getApplicantInvitation(token);
  return (
    <main className={styles.public}>
      <div className={styles.brand}>RocketRental</div>
      {!row ? (
        <section className={styles.card}>
          <h1 className={styles.title}>This invitation is unavailable</h1>
          <p>
            The private link is invalid, expired, or no longer active. Ask the property manager for
            a current invitation.
          </p>
        </section>
      ) : row.submittedAt ? (
        <section className={styles.card}>
          <p className={styles.eyebrow}>Application received</p>
          <h1 className={styles.title}>You’re all set</h1>
          <p>
            Your application for {row.unit.property.name} ·{' '}
            {row.unit.isImplicit ? 'Whole property' : `Unit ${row.unit.number}`} has been submitted
            to the property manager.
          </p>
          <p>
            They will contact you about next steps. Opening this link again will not create another
            application.
          </p>
          <p className={styles.muted}>
            This submission does not authorize screening or guarantee approval.
          </p>
        </section>
      ) : (
        <>
          <p className={styles.eyebrow}>Rental application</p>
          <h1 className={styles.title}>Make your next move</h1>
          <p className={styles.intro}>
            Review your details and submit your application. You can save a draft and return before
            your invitation expires.
          </p>
          <section className={styles.card}>
            <h2>{row.unit.property.name}</h2>
            <p>
              {row.unit.isImplicit ? 'Whole property' : `Unit ${row.unit.number}`} ·{' '}
              {row.unit.property.street}, {row.unit.property.city}
            </p>
            <p className={styles.muted}>
              Invited by {row.unit.property.name}. Link expires{' '}
              {row.expiresAt.toLocaleDateString('en-US', {
                timeZone: 'UTC',
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
              .
            </p>
            <hr style={{ border: 0, borderTop: '1px solid var(--rr-border)', margin: '24px 0' }} />
            <ApplicantForm
              token={token}
              name={row.draftName ?? row.applicantName}
              email={row.applicantEmail}
              saved={Boolean(row.draftSavedAt)}
            />
          </section>
        </>
      )}
    </main>
  );
}
