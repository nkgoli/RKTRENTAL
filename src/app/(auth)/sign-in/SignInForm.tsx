'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Button } from '@/components/ui/Button';
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

export function SignInForm({ next, invalid = false }: { next: string; invalid?: boolean }) {
  const [visible, setVisible] = useState(false);
  return (
    <form className={styles.form} action={signInAction}>
      <input type="hidden" name="next" value={next} />
      <label className={styles.field}>
        <span>Email address</span>
        <input
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          name="email"
          type="email"
          required
          aria-describedby={invalid ? 'sign-in-error' : undefined}
        />
      </label>
      <div className={styles.field}>
        <label htmlFor="password">Password</label>
        <div className={styles.password}>
          <input
            id="password"
            autoComplete="current-password"
            name="password"
            type={visible ? 'text' : 'password'}
            required
            aria-describedby={invalid ? 'sign-in-error' : undefined}
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
      </div>
      <Submit />
    </form>
  );
}
