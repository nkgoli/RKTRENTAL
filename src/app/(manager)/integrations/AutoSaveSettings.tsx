'use client';

import { useActionState, useEffect, type ReactNode } from 'react';
import { useToast } from '@/components/ui';
import { saveSettingsInlineAction } from './actions';
import styles from '@/components/integrations/integrations.module.css';

export function AutoSaveSettings({ group, title, description, children }: {
  group: string; title: string; description: string; children: ReactNode;
}) {
  const [state, action, pending] = useActionState(saveSettingsInlineAction, null);
  const toast = useToast();
  useEffect(() => {
    if (state) toast.push({ message: state.message, tone: state.ok ? 'success' : 'error' });
  }, [state, toast]);
  return <form action={action} onChange={(event) => event.currentTarget.requestSubmit()} className={`card ${styles.settings}`} aria-label={title} id={`${group}-settings`} aria-busy={pending}>
    <input type="hidden" name="group" value={group} />
    <div className="card-header"><div><h3>{title}</h3><p className="muted">{description} Changes save automatically.</p></div></div>
    <fieldset disabled={pending} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }} className="form">{children}</fieldset>
    <span className="muted" role="status">{pending ? 'Saving…' : state?.ok ? 'Saved' : ''}</span>
  </form>;
}
