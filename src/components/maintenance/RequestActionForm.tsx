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
  transport,
  children,
  className,
  label,
}: {
  action: RequestAction;
  transport?: { operation: string; propertyId: string; unitId: string };
  children: ReactNode;
  className?: string;
  label: string;
}) {
  const router = useRouter();
  const [result, submit, pending] = useActionState(
    async (_: RequestActionResult, form: FormData): Promise<RequestActionResult> => {
      if (!transport) return action(form);
      form.set('operation', transport.operation);
      form.set('propertyId', transport.propertyId);
      form.set('scopeUnitId', transport.unitId);
      try {
        const response = await fetch('/maintenance/form', { method: 'POST', body: form });
        if (!response.ok) throw new Error('Save failed');
        const result: RequestActionResult = await response.json();
        if (result.message) {
          const destination = new URL(window.location.href);
          destination.searchParams.set('notice', transport.operation);
          window.location.assign(destination.href);
          return {};
        }
        return result;
      } catch {
        return { error: 'The request could not be saved. Your changes are still here. Try again.' };
      }
    },
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
          Savingâ€¦
        </p>
      )}
    </form>
  );
}
