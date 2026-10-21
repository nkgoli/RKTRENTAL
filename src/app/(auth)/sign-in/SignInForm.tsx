'use client';

import Link from 'next/link';
import { useActionState, useEffect, useRef, useState, type FormEvent } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/Button';
import {
  INVALID_CREDENTIALS,
  validateSignIn,
  type SignInErrors,
  type SignInState,
} from '@/lib/auth/sign-in';
import { signInAction } from './actions';
import styles from '../auth.module.css';

function Submit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" block disabled={pending} aria-busy={pending}>
      {pending ? (
        <>
          <span className={styles.spinner} aria-hidden="true" />
          Signing in…
        </>
      ) : (
        'Sign in'
      )}
    </Button>
  );
}

export function SignInForm({
  next,
  invalid = false,
  email: initialEmail = '',
}: {
  next: string;
  invalid?: boolean;
  email?: string;
}) {
  const [state, action] = useActionState<SignInState, FormData>(signInAction, {
    email: initialEmail,
    message: invalid ? INVALID_CREDENTIALS : undefined,
    attempt: 0,
  });
  const [email, setEmail] = useState(state.email);
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [clientErrors, setClientErrors] = useState<SignInErrors | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const errors = clientErrors ?? state.errors ?? {};
  const credentialError = clientErrors === null && state.message;

  useEffect(() => {
    if (!state.message && !state.errors) return;
    setPassword('');
    setVisible(false);
    if (state.errors?.email) emailRef.current?.focus();
    else passwordRef.current?.focus();
  }, [state]);

  function validate(event: FormEvent<HTMLFormElement>) {
    const nextErrors = validateSignIn(email, password);
    if (Object.keys(nextErrors).length) {
      event.preventDefault();
      setClientErrors(nextErrors);
      if (nextErrors.email) emailRef.current?.focus();
      else passwordRef.current?.focus();
    } else setClientErrors(null);
  }

  return (
    <form className={styles.form} action={action} onSubmit={validate} noValidate>
      <input type="hidden" name="next" value={next} />
      {credentialError && (
        <p id="sign-in-error" className={styles.error} role="alert">
          {credentialError}
        </p>
      )}
      {(errors.email || errors.password) && (
        <div className={styles.error} role="alert">
          <p>Check your sign-in details.</p>
          <ul>
            {errors.email && (
              <li>
                <a href="#email">{errors.email}</a>
              </li>
            )}
            {errors.password && (
              <li>
                <a href="#password">{errors.password}</a>
              </li>
            )}
          </ul>
        </div>
      )}
      <div className={styles.field}>
        <label htmlFor="email">Email address</label>
        <input
          id="email"
          ref={emailRef}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          name="email"
          type="email"
          required
          maxLength={254}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-invalid={Boolean(errors.email)}
          aria-describedby={
            errors.email ? 'email-error' : credentialError ? 'sign-in-error' : undefined
          }
        />
        {errors.email && (
          <p id="email-error" className={styles.fieldError}>
            {errors.email}
          </p>
        )}
      </div>
      <div className={styles.field}>
        <div className={styles.labelRow}>
          <label htmlFor="password">Password</label>
          <Link href="/recover">Forgot password?</Link>
        </div>
        <div className={styles.password}>
          <input
            id="password"
            ref={passwordRef}
            autoComplete="current-password"
            name="password"
            type={visible ? 'text' : 'password'}
            required
            maxLength={1024}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-invalid={Boolean(errors.password || credentialError)}
            aria-describedby={
              errors.password ? 'password-error' : credentialError ? 'sign-in-error' : undefined
            }
          />
          <button
            className={styles.reveal}
            type="button"
            aria-label={visible ? 'Hide characters' : 'Show characters'}
            aria-controls="password"
            aria-pressed={visible}
            onClick={() => setVisible(!visible)}
          >
            {visible ? 'Hide' : 'Show'}
          </button>
        </div>
        {errors.password && (
          <p id="password-error" className={styles.fieldError}>
            {errors.password}
          </p>
        )}
      </div>
      <Submit />
    </form>
  );
}
