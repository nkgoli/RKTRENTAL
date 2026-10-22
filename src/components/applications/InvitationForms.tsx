'use client';

import { useRef, useState, type FormEvent } from 'react';
import styles from './invitations.module.css';

async function post(url: string, body: unknown) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error ?? 'Request failed. Reload to check its status.');
  return result;
}
function message(error: unknown) {
  return error instanceof Error
    ? error.message
    : 'Unable to complete the request. Reload to check its status.';
}
type PropertyOption = {
  id: string;
  name: string;
  units: { id: string; number: string; isImplicit: boolean }[];
};

export function CreateInvitationForm({
  properties,
  propertyId = '',
  unitId = '',
  requestKey,
  disabled,
}: {
  properties: PropertyOption[];
  propertyId?: string;
  unitId?: string;
  requestKey: string;
  disabled?: boolean;
}) {
  const [property, setProperty] = useState(propertyId);
  const [unit, setUnit] = useState(unitId);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [error, setError] = useState('');
  const units = properties.find((p) => p.id === property)?.units ?? [];
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    const data = new FormData(event.currentTarget);
    try {
      const result = await post('/api/applications/invitations', {
        fullName: data.get('fullName'),
        email: data.get('email'),
        propertyId: property,
        unitId: unit,
        requestKey,
      });
      window.location.assign(result.href);
    } catch (e) {
      setError(message(e));
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <form onSubmit={submit} className={styles.card}>
      <h2>Applicant details</h2>
      <div className={styles.fields}>
        <label className={styles.field}>
          Full name
          <input
            name="fullName"
            autoComplete="name"
            required
            minLength={2}
            maxLength={120}
            placeholder="e.g. Jordan Lee"
          />
        </label>
        <label className={styles.field}>
          Email address
          <input
            name="email"
            aria-label="Email address"
            aria-describedby="invitation-email-help"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            placeholder="jordan@example.com"
          />
          <small id="invitation-email-help">One applicant per invitation.</small>
        </label>
        <label className={styles.field}>
          Property
          <select
            name="propertyId"
            required
            value={property}
            onChange={(e) => {
              setProperty(e.target.value);
              const options = properties.find((p) => p.id === e.target.value)?.units ?? [];
              setUnit(options.length === 1 ? options[0].id : '');
            }}
          >
            <option value="">Choose a property</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          Unit
          <select
            name="unitId"
            required
            value={unit}
            disabled={!property}
            onChange={(e) => setUnit(e.target.value)}
          >
            <option value="">Choose a unit</option>
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.isImplicit ? 'Whole property' : `Unit ${u.number}`}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <div className={styles.actions}>
        <button className="btn btn-primary" disabled={busy || disabled}>
          {busy ? 'Creating invitation…' : 'Create invitation & preview'}
        </button>
        <a href="/applications" className="btn btn-ghost">
          Cancel
        </a>
      </div>
      <p className={styles.muted}>
        Creating an invitation does not send email. Review the message next, then send it or copy
        the private link.
      </p>
    </form>
  );
}

export function InvitationDelivery({
  id,
  generation,
  requestKey,
  link,
  expired,
  submitted,
  blocked,
  latestStatus,
}: {
  id: string;
  generation: number;
  requestKey: string;
  link?: string;
  expired: boolean;
  submitted: boolean;
  blocked: boolean;
  latestStatus?: string;
}) {
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  async function send(intent: 'send' | 'renew') {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      await post(`/api/applications/invitations/${id}`, { intent, generation, requestKey });
      window.location.reload();
    } catch (e) {
      setError(message(e));
      setBusy(false);
      pending.current = false;
    }
  }
  if (submitted) return null;
  return (
    <>
      {!expired && link && (
        <label className={styles.field}>
          Private application link
          <input
            aria-label="Private application link"
            readOnly
            value={link}
            onFocus={(e) => e.target.select()}
          />
          <small>
            Expires in seven days from creation or renewal. Share only with this applicant.
          </small>
        </label>
      )}
      <div className={styles.actions}>
        {expired ? (
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy || blocked}
            onClick={() => send('renew')}
          >
            {busy ? 'Renewing…' : 'Renew expired link'}
          </button>
        ) : (
          <>
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy || blocked || !link}
              onClick={() => send('send')}
            >
              {busy
                ? 'Recording email attempt…'
                : latestStatus === 'FAILED' || latestStatus === 'UNCONFIGURED'
                  ? 'Retry email'
                  : latestStatus === 'MOCK_RECORDED' || latestStatus === 'ACCEPTED'
                    ? 'Resend invitation email'
                    : 'Send invitation email'}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={!link}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(link!);
                  setCopied(true);
                } catch {
                  setError('Select and copy the private link above.');
                }
              }}
            >
              Copy link
            </button>
          </>
        )}
      </div>
      {copied && <p role="status">Link copied. No email was sent by copying.</p>}
      {blocked && (
        <p className={styles.notice}>
          The provider outcome is pending or unknown. Further email attempts are blocked to avoid
          duplicates. Contact your administrator to reconcile the provider record. The active link
          can still be copied.
        </p>
      )}
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
    </>
  );
}

export function ApplicantForm({
  token,
  name,
  email,
  saved,
}: {
  token: string;
  name: string;
  email: string;
  saved: boolean;
}) {
  const [fullName, setName] = useState(name);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState(saved ? 'Your saved draft is ready to finish.' : '');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    const intent =
      (event.nativeEvent as SubmitEvent).submitter?.getAttribute('value') === 'save'
        ? 'save'
        : 'submit';
    if (intent === 'submit' && !confirmed) {
      setError('Confirm that your application details are accurate.');
      return;
    }
    pending.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await post('/api/applications/submit', { token, fullName, intent, confirmed });
      if (result.submitted) {
        window.location.reload();
        return;
      }
      setNotice('Draft saved. Return using this private link before it expires.');
    } catch (e) {
      setError(message(e));
    }
    pending.current = false;
    setBusy(false);
  }
  return (
    <form onSubmit={submit}>
      <div className={styles.fields}>
        <label className={styles.field}>
          Full name
          <input
            name="fullName"
            autoComplete="name"
            required
            minLength={2}
            maxLength={120}
            value={fullName}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className={styles.field}>
          Email address
          <input
            name="email"
            type="email"
            aria-label="Email address"
            aria-describedby="applicant-email-help"
            autoComplete="email"
            value={email}
            readOnly
          />
          <small id="applicant-email-help">
            This invitation is for this email address. Contact the property manager if it needs to
            change.
          </small>
        </label>
      </div>
      <label className={styles.check}>
        <input
          type="checkbox"
          checked={confirmed}
          onChange={(e) => setConfirmed(e.target.checked)}
        />
        <span>
          I confirm these details are accurate and want to submit my application for this property
          and unit.
        </span>
      </label>
      <p className={styles.muted}>
        Submitting shares these details with the property manager. Screening requires separate
        authorization; this form does not authorize a credit or background check.
      </p>
      {error && (
        <p role="alert" className={styles.error}>
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className={styles.notice}>
          {notice}
        </p>
      )}
      <div className={styles.actions}>
        <button className="btn btn-primary" name="intent" value="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Submit application'}
        </button>
        <button className="btn btn-secondary" name="intent" value="save" disabled={busy}>
          Save draft
        </button>
      </div>
    </form>
  );
}
