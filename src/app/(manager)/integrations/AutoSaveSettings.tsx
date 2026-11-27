'use client';

import { startTransition, useActionState, useEffect, type ReactNode } from 'react';
import { useToast } from '@/components/ui';
import { saveSettingsInlineAction } from './actions';
import styles from '@/components/integrations/integrations.module.css';

export function AutoSaveSettings({
  group,
  title,
  description,
  children,
}: {
  group: string;
  title: string;
  /** Optional one-line scope note under the title. */
  description?: string;
  children: ReactNode;
}) {
  const [state, action, pending] = useActionState(saveSettingsInlineAction, null);
  const toast = useToast();
  useEffect(() => {
    if (state && !pending)
      toast.push({ message: state.message, tone: state.ok ? 'success' : 'error' });
  }, [state, pending, toast]);
  return (
    <form
      action={action}
      onChange={(event) => {
        // Capture each edit without a form reset; useActionState queues these snapshots in order.
        const snapshot = new FormData(event.currentTarget);
        startTransition(() => action(snapshot));
      }}
      className={`card ${styles.settings}`}
      aria-label={title}
      id={`${group}-settings`}
      aria-busy={pending}
    >
      <input type="hidden" name="group" value={group} />
      <div className="card-header">
        <div>
          <h3>{title}</h3>
          {description && <p className="muted">{description}</p>}
        </div>
        <span className={styles.saveState} role="status">
          {pending ? 'Saving…' : state?.ok ? 'Saved' : ''}
        </span>
      </div>
      <fieldset style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }} className="form">
        {children}
      </fieldset>
    </form>
  );
}
