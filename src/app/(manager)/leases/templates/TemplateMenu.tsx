'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Alert, ConfirmDialog, RowMenu, useToast } from '@/components/ui';
import type { TemplateDefinition } from '@/lib/lease-create/templates';
import { deleteLeaseTemplateAction, saveLeaseTemplateAction } from './actions';
import styles from './templates.module.css';

/**
 * A template card's "⋯" menu: Duplicate opens the copy in the editor; Delete is offered only for
 * a template no lease or property default uses, and the server checks that again.
 */
export function TemplateMenu({
  template,
  canDelete,
}: {
  template: TemplateDefinition;
  canDelete: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');

  const duplicate = async () => {
    setBusy(true);
    try {
      const result = await saveLeaseTemplateAction({
        name: `${template.name} copy`,
        items: template.items,
        defaultFees: template.defaultFees,
      });
      if ('error' in result || !result.template) {
        toast.error(('error' in result && result.error) || 'Could not duplicate template.');
        return;
      }
      router.push(`/leases/templates/${result.template.id}`);
    } catch {
      toast.error('The template could not be duplicated. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    setError('');
    try {
      const result = await deleteLeaseTemplateAction(template.id);
      if ('error' in result) {
        setError(result.error ?? 'Could not delete template.');
        return;
      }
      setConfirming(false);
      toast.success(`${template.name} deleted.`);
      router.refresh();
    } catch {
      setError('The template could not be deleted. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <RowMenu label={`More actions for ${template.name}`} className={styles.menu}>
      <button type="button" disabled={busy} onClick={() => void duplicate()}>
        Duplicate
      </button>
      {canDelete && (
        <>
          <button
            type="button"
            className="danger"
            disabled={busy}
            onClick={() => setConfirming(true)}
          >
            Delete
          </button>
          <ConfirmDialog
            open={confirming}
            onClose={() => {
              if (busy) return;
              setConfirming(false);
              setError('');
            }}
            title={`Delete ${template.name}?`}
            description="Removes this unused template. This can’t be undone."
            confirmLabel={busy ? 'Deleting…' : 'Delete template'}
            pending={busy}
            onConfirm={() => void remove()}
          >
            {error && <Alert tone="error">{error}</Alert>}
          </ConfirmDialog>
        </>
      )}
    </RowMenu>
  );
}
