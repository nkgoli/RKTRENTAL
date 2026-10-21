'use client';

import { useActionState, useEffect, useState, startTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import styles from './maintenance.module.css';
import { preserveIssueDraft } from './issue-draft';
import { useToast } from '@/components/ui/Toast';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

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
  confirmCancellation = false,
}: {
  action: RequestAction;
  transport?: { operation: string; propertyId: string; unitId: string };
  children: ReactNode;
  className?: string;
  label: string;
  confirmCancellation?: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [cancellation, setCancellation] = useState<FormData | null>(null);
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
          try {
            preserveIssueDraft({
              requestId: String(form.get('requestId') ?? ''),
              propertyId: transport.propertyId,
              unitId: transport.unitId,
            });
          } catch {
            return {
              error:
                'Activity saved. Your issue draft is still here. Save or cancel issue details before refreshing.',
            };
          }
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
    if (result.message) {
      toast.success(result.message);
      router.refresh();
    }
  }, [result, router, toast]);
  return (
    <>
      <form
        action={submit}
        className={className}
        aria-label={label}
        aria-busy={pending}
        onReset={(event) => event.preventDefault()}
        onSubmit={(event) => {
          if (!confirmCancellation) return;
          const data = new FormData(event.currentTarget);
          if (data.get('status') === 'CANCELLED') {
            event.preventDefault();
            setCancellation(data);
          }
        }}
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
            Saving...
          </p>
        )}
      </form>
      <ConfirmDialog
        open={Boolean(cancellation)}
        onClose={() => setCancellation(null)}
        title="Cancel this repair request?"
        description="This closes the request as cancelled. Its photos, comments and history remain available."
        confirmLabel="Cancel request"
        onConfirm={() => {
          if (cancellation) {
            const data = cancellation;
            setCancellation(null);
            startTransition(() => submit(data));
          }
        }}
      />
    </>
  );
}
