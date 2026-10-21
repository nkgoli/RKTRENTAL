'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import type { EsignEnvelope } from '@/lib/esign/types';
import { AgreementContent, DocumentLinks } from './AgreementContent';
import styles from './signing.module.css';

export type SigningView = EsignEnvelope & {
  snapshot: unknown;
  myPartyId: string | null;
  consentText: string;
  consentVersion: string;
};
export function signingTitle(view: EsignEnvelope) {
  if (view.archiveStatus === 'ARCHIVED') return 'All signed · Documents ready';
  if (view.archiveStatus === 'PDF_FAILED') return 'All signed · Document needs another attempt';
  if (view.status === 'SIGNED') return 'All signed · Preparing your documents';
  return 'Awaiting signatures';
}

export function SigningPanel({
  leaseId,
  documentsHref,
}: {
  leaseId: string;
  documentsHref?: string;
}) {
  const [view, setView] = useState<SigningView | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [error, setError] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [consent, setConsent] = useState(false);
  const alert = useRef<HTMLDivElement>(null);
  const endpoint = `/api/leases/${encodeURIComponent(leaseId)}/signing`;
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(endpoint, { cache: 'no-store' });
      const body = await response.json();
      if (!response.ok) {
        setUnavailable(true);
        setError(body.error || 'The agreement could not be loaded.');
        return;
      }
      setView((previous) => {
        if (previous && (previous.id !== body.id || previous.snapshotHash !== body.snapshotHash))
          setConsent(false);
        return body;
      });
      setUnavailable(false);
      setError('');
    } catch {
      setUnavailable(true);
      setError('The agreement could not be loaded. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [endpoint]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    if (error) alert.current?.focus();
  }, [error]);
  useEffect(() => {
    if (!view || view.archiveStatus === 'ARCHIVED' || unavailable) return;
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible' && !pending) void refresh();
    }, 15000);
    return () => clearInterval(timer);
  }, [view, unavailable, pending, refresh]);
  const me = view?.signers.find((party) => party.id === view.myPartyId);

  async function sign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!view || !me || pending || unavailable) return;
    const invalid: Record<string, string> = {};
    if (
      fullName.trim().length < 2 ||
      fullName.trim().length > 200 ||
      !/\p{L}/u.test(fullName) ||
      /[\x00-\x1f\x7f]/.test(fullName)
    )
      invalid.fullName = 'Enter your full name.';
    if (
      !/^\+?[\d\s().-]+$/.test(phone.trim()) ||
      !/^\d{7,15}$/.test(phone.replace(/\D/g, '')) ||
      phone.trim().length > 40
    )
      invalid.phone = 'Enter a valid phone number with 7–15 digits.';
    if (!consent) invalid.consent = 'Confirm that you agree to sign electronically.';
    setFields(invalid);
    if (Object.keys(invalid).length) {
      setError('Check the highlighted fields before signing.');
      alert.current?.focus();
      return;
    }
    setPending(true);
    setError('');
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agreementId: view.id,
          snapshotHash: view.snapshotHash,
          fullName,
          email: me.email,
          phone,
          consent,
          consentVersion: view.consentVersion,
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        setError(
          body.error || 'Your signature could not be confirmed. Check status before retrying.',
        );
        if (body.field) setFields({ [body.field]: body.error });
        if ([401, 404, 409].includes(response.status)) {
          setUnavailable(true);
          setConsent(false);
        }
        return;
      }
      setView((current) => (current ? { ...current, ...body } : current));
      setConsent(false);
      await refresh();
    } catch {
      setError(
        'Your signature could not be confirmed. Check status before retrying; your saved signature will not be duplicated.',
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={styles.panel} aria-label="Lease signing">
      {error && (
        <div className={styles.alert} role="alert" tabIndex={-1} ref={alert}>
          {error}
        </div>
      )}
      {!view && loading && <p role="status">Loading agreement…</p>}
      <div className={styles.actions}>
        <button
          className="btn btn-secondary"
          type="button"
          disabled={loading || pending}
          onClick={() => void refresh()}
        >
          {loading ? 'Checking…' : 'Check status'}
        </button>
        {documentsHref && (
          <a className="btn btn-secondary" href={documentsHref}>
            Documents
          </a>
        )}
      </div>
      {view && (
        <>
          <header className={styles.header}>
            <p className={styles.muted}>Agreement version {view.version}</p>
            <h2>{signingTitle(view)}</h2>
            <p>Each person signs from their own account. You can leave and return to this page.</p>
          </header>
          <ul className={styles.roster} aria-label="Designated signing parties">
            {view.signers.map((party) => (
              <li className={styles.party} key={party.id}>
                <div>
                  <strong>
                    {party.name}
                    {party.id === view.myPartyId ? ' (you)' : ''}
                  </strong>
                  <small>
                    {party.role === 'OWNER' ? 'Owner / lessor' : 'Tenant'} · {party.email}
                  </small>
                </div>
                <span className={party.signedAt ? styles.signed : styles.waiting}>
                  {party.signedAt
                    ? `Signed · ${new Date(party.signedAt).toLocaleString()}`
                    : 'Awaiting signature'}
                </span>
              </li>
            ))}
          </ul>
          {view.status === 'SIGNED' && view.archiveStatus !== 'ARCHIVED' && (
            <div
              className={view.archiveStatus === 'PDF_FAILED' ? styles.alert : styles.notice}
              role="status"
            >
              <p>Your signatures are saved. No one needs to sign again.</p>
              <p>
                {view.archiveStatus === 'PDF_FAILED'
                  ? view.archiveError ||
                    'The document could not be stored. We will retry automatically.'
                  : 'The final PDF is processing. This page checks automatically.'}
              </p>
              {view.archiveNextAttemptAt && (
                <p>
                  Next retry after {new Date(view.archiveNextAttemptAt).toLocaleString()}. Use Check
                  status to retry when due.
                </p>
              )}
            </div>
          )}
          {view.archiveStatus === 'ARCHIVED' && view.archiveDocumentId && (
            <section id="documents" className={styles.notice}>
              <h3>Documents</h3>
              <div className={styles.file}>
                <strong>Signed lease agreement.pdf</strong>
                <DocumentLinks id={view.archiveDocumentId} name="Signed lease agreement.pdf" />
              </div>
              <p>Each addendum is available separately below.</p>
            </section>
          )}
          <AgreementContent snapshot={view.snapshot} />
          {me?.signedAt ? (
            <p className={styles.notice} role="status">
              You have already signed this agreement. Your signature is saved.
            </p>
          ) : !me ? (
            <p className={styles.notice}>
              You can review this agreement, but only the designated owner / lessor and tenants can
              sign. Share this page link with them; no notification is sent automatically.
            </p>
          ) : (
            <form
              onSubmit={sign}
              noValidate
              className={styles.form}
              aria-label="Your electronic signature"
            >
              <h2>Your electronic signature</h2>
              <p>
                Signing as {me.name} · {me.email}. Enter your own contact details.
              </p>
              <label className={styles.field}>
                Full name
                <input
                  name="fullName"
                  autoComplete="name"
                  required
                  maxLength={200}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  disabled={pending || unavailable}
                  aria-invalid={Boolean(fields.fullName)}
                  aria-describedby={fields.fullName ? 'signature-name-error' : undefined}
                />
                {fields.fullName && (
                  <small className={styles.error} id="signature-name-error">
                    {fields.fullName}
                  </small>
                )}
              </label>
              <label className={styles.field}>
                Email
                <input
                  name="email"
                  type="email"
                  value={me.email}
                  readOnly
                  required
                  aria-describedby="signature-email-hint"
                />
                <small className={styles.muted} id="signature-email-hint">
                  Your signing account email. Contact your manager if it is incorrect.
                </small>
              </label>
              <label className={styles.field}>
                Phone
                <input
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  required
                  maxLength={40}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={pending || unavailable}
                  aria-invalid={Boolean(fields.phone)}
                  aria-describedby={fields.phone ? 'signature-phone-error' : undefined}
                />
                {fields.phone && (
                  <small className={styles.error} id="signature-phone-error">
                    {fields.phone}
                  </small>
                )}
              </label>
              <label className={styles.consent}>
                <input
                  name="consent"
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  disabled={pending || unavailable}
                  required
                  aria-invalid={Boolean(fields.consent)}
                  aria-describedby={fields.consent ? 'signature-consent-error' : undefined}
                />
                <span>{view.consentText}</span>
              </label>
              {fields.consent && (
                <small className={styles.error} id="signature-consent-error">
                  {fields.consent}
                </small>
              )}
              <button
                className="btn btn-primary"
                type="submit"
                disabled={pending || unavailable || loading}
              >
                {pending ? 'Saving your signature…' : 'Sign this agreement'}
              </button>
            </form>
          )}
        </>
      )}
    </div>
  );
}
