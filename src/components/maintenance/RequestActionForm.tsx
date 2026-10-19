'use client';

import { useActionState, useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import styles from './maintenance.module.css';

export type RequestActionResult = {
  error?: string;
  message?: string;
  requestId?: string;
  requestHref?: string;
};
export type RequestAction = (form: FormData) => Promise<RequestActionResult>;

/** Keep failures beside the fields, and refresh the current scope after a successful action. */
export function RequestActionForm({
  action,
  children,
  className,
  label,
}: {
  action: RequestAction;
  children: ReactNode;
  className?: string;
  label: string;
}) {
  const router = useRouter();
  const [result, submit, pending] = useActionState(
    async (_: RequestActionResult, form: FormData) => action(form),
    {},
  );
  useEffect(() => {
    if (result.message) router.refresh();
  }, [result, router]);
  return (
    <form
      action={submit}
      className={className}
      aria-label={label}
      aria-busy={pending}
      onReset={(event) => event.preventDefault()}
    >
      {result.error && (
        <p className={styles.error} role="alert">
          {result.error}
        </p>
      )}
      {result.message && (
        <p className={styles.notice} role="status">
          {result.message}
        </p>
      )}
      {result.requestId ? (
        <a
          className="btn btn-secondary"
          href={result.requestHref ?? `#request-${result.requestId}`}
        >
          Request created
        </a>
      ) : (
        <fieldset className={styles.fields} disabled={pending}>
          {children}
        </fieldset>
      )}
      {pending && (
        <p className="muted" role="status">
          Saving…
        </p>
      )}
    </form>
  );
}
