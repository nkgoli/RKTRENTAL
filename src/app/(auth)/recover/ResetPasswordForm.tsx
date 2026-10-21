'use client';

import Link from 'next/link';
import { useActionState, useEffect, useRef, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import {
  validateResetPassword,
  type ResetPasswordState,
  type ResetErrors,
} from '@/lib/auth/recovery-fields';
import { resetPasswordAction } from './actions';
import styles from '../auth.module.css';

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<ResetPasswordState, FormData>(
    resetPasswordAction,
    { attempt: 0 },
  );
  const [clientErrors, setClientErrors] = useState<ResetErrors | null>(null);
  const [visible, setVisible] = useState(false);
  const password = useRef<HTMLInputElement>(null);
  const confirmation = useRef<HTMLInputElement>(null);
  const alert = useRef<HTMLParagraphElement>(null);
  const errors = clientErrors ?? state.errors ?? {};
  useEffect(() => {
    if (!state.attempt) return;
    if (password.current) password.current.value = '';
    if (confirmation.current) confirmation.current.value = '';
    if (state.error) alert.current?.focus();
    else if (state.errors?.password) password.current?.focus();
    else confirmation.current?.focus();
  }, [state]);
  function validate(event: FormEvent<HTMLFormElement>) {
    const errors = validateResetPassword(
      password.current?.value ?? '',
      confirmation.current?.value ?? '',
    );
    if (Object.keys(errors).length) {
      event.preventDefault();
      setClientErrors(errors);
      if (errors.password) password.current?.focus();
      else confirmation.current?.focus();
    } else setClientErrors(null);
  }
  return (
    <form className={styles.form} action={action} noValidate onSubmit={validate}>
      <input type="hidden" name="token" value={token} />
      {state.error && (
        <p className={styles.error} ref={alert} role="alert" tabIndex={-1}>
          {state.error}
        </p>
      )}
      {(errors.password || errors.confirmation) && (
        <div className={styles.error} role="alert">
          <p>Check your new password.</p>
          <ul>
            {errors.password && (
              <li>
                <a href="#new-password">{errors.password}</a>
              </li>
            )}
            {errors.confirmation && (
              <li>
                <a href="#confirm-password">{errors.confirmation}</a>
              </li>
            )}
          </ul>
        </div>
      )}
      <div className={styles.field}>
        <label htmlFor="new-password">New password</label>
        <input
          ref={password}
          id="new-password"
          name="password"
          type={visible ? 'text' : 'password'}
          autoComplete="new-password"
          required
          minLength={12}
          maxLength={128}
          aria-invalid={Boolean(errors.password)}
          aria-describedby={errors.password ? 'new-password-error password-hint' : 'password-hint'}
        />
        <p id="password-hint" className={styles.inputHint}>
          Use at least 12 characters.
        </p>
        {errors.password && (
          <p id="new-password-error" className={styles.fieldError}>
            {errors.password}
          </p>
        )}
      </div>
      <div className={styles.field}>
        <label htmlFor="confirm-password">Confirm new password</label>
        <input
          ref={confirmation}
          id="confirm-password"
          name="confirmation"
          type={visible ? 'text' : 'password'}
          autoComplete="new-password"
          required
          maxLength={128}
          aria-invalid={Boolean(errors.confirmation)}
          aria-describedby={errors.confirmation ? 'confirm-password-error' : undefined}
        />
        {errors.confirmation && (
          <p id="confirm-password-error" className={styles.fieldError}>
            {errors.confirmation}
          </p>
        )}
      </div>
      <label className={styles.showPasswords}>
        <input
          type="checkbox"
          checked={visible}
          onChange={(event) => setVisible(event.target.checked)}
        />
        Show passwords
      </label>
      <Button type="submit" variant="primary" block disabled={pending} aria-busy={pending}>
        {pending ? 'Changing password…' : 'Change password'}
      </Button>
      <Link className={styles.textLink} href="/recover">
        Request a new reset link
      </Link>
    </form>
  );
}
