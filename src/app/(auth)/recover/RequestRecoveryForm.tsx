'use client';

import Link from 'next/link';
import { useActionState, useEffect, useRef, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { validateRecoveryEmail, type RecoveryRequestState } from '@/lib/auth/recovery-fields';
import { requestRecoveryAction } from './actions';
import styles from '../auth.module.css';

export function RequestRecoveryForm() {
  const [state, action, pending] = useActionState<RecoveryRequestState, FormData>(
    requestRecoveryAction,
    { email: '', attempt: 0 },
  );
  const [clientError, setClientError] = useState<string>();
  const [dismissedAttempt, setDismissedAttempt] = useState(-1);
  const input = useRef<HTMLInputElement>(null);
  const notice = useRef<HTMLDivElement>(null);
  const error = clientError ?? state.error;
  useEffect(() => {
    if (state.sent && state.attempt !== dismissedAttempt) notice.current?.focus();
    else if (state.error || state.attempt === dismissedAttempt) input.current?.focus();
  }, [state, dismissedAttempt]);
  function validate(event: FormEvent<HTMLFormElement>) {
    const error = validateRecoveryEmail(input.current?.value ?? '');
    setClientError(error);
    if (error) {
      event.preventDefault();
      input.current?.focus();
    }
  }
  if (state.sent && state.attempt !== dismissedAttempt)
    return (
      <div className={styles.form}>
        <div className={styles.confirmation} ref={notice} tabIndex={-1} role="status">
          <h2>Check your inbox</h2>
          <p>
            If an account uses <strong>{state.email}</strong>, you’ll receive a link to reset your
            password. The link expires in 15 minutes.
          </p>
          <p>
            If it does not arrive, check your spam folder or ask your property manager for help.
          </p>
        </div>
        <Button href="/sign-in" variant="primary" block>
          Back to sign in
        </Button>
        <Button variant="ghost" block onClick={() => setDismissedAttempt(state.attempt)}>
          Try another email
        </Button>
      </div>
    );
  return (
    <form className={styles.form} action={action} noValidate onSubmit={validate}>
      {error && (
        <p id="recovery-error" className={styles.error} role="alert">
          {error}
        </p>
      )}
      <div className={styles.field}>
        <label htmlFor="recovery-email">Email address</label>
        <input
          ref={input}
          id="recovery-email"
          name="email"
          type="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={254}
          required
          defaultValue={state.email}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? 'recovery-error' : undefined}
        />
      </div>
      <Button type="submit" variant="primary" block disabled={pending} aria-busy={pending}>
        {pending ? 'Sending reset link…' : 'Send reset link'}
      </Button>
      <Link className={styles.textLink} href="/sign-in">
        Back to sign in
      </Link>
    </form>
  );
}
