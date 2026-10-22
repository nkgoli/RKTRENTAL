'use client';

import { useActionState, useEffect, useState } from 'react';
import { deleteDraftLeaseAction, type DeleteDraftState } from '@/app/(manager)/leases/actions';
import { Action, Alert } from '@/components/ui';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

export type DeleteDraftReturn = 'leases' | 'property' | 'unit';

const initial: DeleteDraftState = {};

/**
 * "Delete draft" for an unsent draft lease: a danger action that opens the shared confirmation.
 * The server re-checks eligibility; a refusal stays in the dialog, success redirects to a fresh
 * load of the list the manager came from so every count and section reflects the deletion.
 */
export function DeleteDraftButton({
  leaseId,
  placeLabel,
  tenantName,
  renewal = false,
  fileCount = 0,
  returnTo = 'leases',
  text = 'Delete draft',
  disabled = false,
  onPendingChange,
  className,
}: {
  leaseId: string;
  /** Property and unit, as shown in the surrounding list ("18 Elm Street · Unit 2"). */
  placeLabel: string;
  tenantName?: string;
  /** The draft renews another lease; the dialog says that lease is kept. */
  renewal?: boolean;
  /** Uploaded files removed with the draft, when known. */
  fileCount?: number;
  returnTo?: DeleteDraftReturn;
  /** Visible text; null renders an icon-only action named by the full label. */
  text?: string | null;
  /** Another operation on the draft (a save or send) is in flight; the action cannot open. */
  disabled?: boolean;
  /** Reports the confirmed delete starting and settling, so the host can hold its own writes. */
  onPendingChange?: (pending: boolean) => void;
  className?: string;
}) {
  const [state, action, pending] = useActionState(deleteDraftLeaseAction, initial);
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState<DeleteDraftState>(initial);
  // Success redirects on the server, so `pending` lasts until the next page loads.
  const busy = pending;
  useEffect(() => {
    onPendingChange?.(busy);
  }, [busy, onPendingChange]);
  const error = state.message && state !== dismissed ? state.message : null;
  const subject = `draft lease for ${placeLabel}`;
  const files =
    fileCount > 0 ? ` and ${fileCount} uploaded ${fileCount === 1 ? 'file' : 'files'}` : '';
  return (
    <>
      <Action
        icon="trash"
        tone="danger"
        text={text ?? undefined}
        label={`Delete ${subject}`}
        className={className}
        disabled={disabled}
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
      />
      <ConfirmDialog
        open={open}
        onClose={() => {
          if (busy) return;
          setDismissed(state);
          setOpen(false);
        }}
        title={`Delete ${subject}?`}
        description={
          <>
            Removes this unsent draft{tenantName ? ` for ${tenantName}` : ''} with its saved wizard
            progress{files}. {renewal && 'The lease it renews stays active and unchanged. '}
            Tenants, the property and other leases aren’t changed. This can’t be undone.
          </>
        }
        confirmLabel={busy ? 'Deleting…' : 'Delete draft'}
        pending={busy}
        action={action}
        fields={{ leaseId, returnTo }}
      >
        {error && <Alert tone="error">{error}</Alert>}
      </ConfirmDialog>
    </>
  );
}
