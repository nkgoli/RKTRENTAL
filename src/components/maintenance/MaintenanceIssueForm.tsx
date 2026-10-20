'use client';
import { useActionState, useEffect, useRef, useState, startTransition } from 'react';
import { FileUploader } from '@/components/upload';
import type { RequestActionResult, RequestAction } from './RequestActionForm';
import styles from './issue-form.module.css';
import { restoreIssueDraft } from './issue-draft';
export function MaintenanceIssueForm({
  action,
  scope,
  returnTo,
  units,
  selectedUnitId,
  request,
}: {
  action?: RequestAction;
  scope?: { requestId?: string; propertyId?: string; unitId?: string };
  returnTo: string;
  units: { id: string; number: string }[];
  selectedUnitId?: string;
  request?: { title: string; description: string | null; priority: string; location: string };
}) {
  const [result, submit, pending] = useActionState(
    async (_: RequestActionResult, data: FormData): Promise<RequestActionResult> => {
      if (action) return action(data);
      data.set('returnTo', returnTo);
      if (scope?.requestId) data.set('requestId', scope.requestId);
      if (scope?.propertyId) data.set('propertyId', scope.propertyId);
      if (scope?.unitId) data.set('scopeUnitId', scope.unitId);
      try {
        const response = await fetch('/maintenance/form', { method: 'POST', body: data });
        if (!response.ok) throw new Error('Save failed');
        return await response.json();
      } catch {
        return { error: 'The request could not be saved. Your changes are still here. Try again.' };
      }
    },
    {},
  );
  const feedback = useRef<HTMLParagraphElement>(null);
  const issueForm = useRef<HTMLFormElement>(null);
  const [restoredDraft, setRestoredDraft] = useState(false);
  useEffect(() => {
    if (!issueForm.current || !scope?.requestId || !scope.propertyId || !scope.unitId) return;
    try {
      if (
        restoreIssueDraft(issueForm.current, {
          requestId: scope.requestId,
          propertyId: scope.propertyId,
          unitId: scope.unitId,
        })
      )
        setRestoredDraft(true);
    } catch {
      /* Storage unavailable: activity navigation is prevented at its source. */
    }
  }, [scope?.requestId, scope?.propertyId, scope?.unitId]);
  useEffect(() => {
    if (result.error || result.message) feedback.current?.focus();
  }, [result]);
  return (
    <form
      ref={issueForm}
      data-maintenance-issue-id={scope?.requestId}
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        startTransition(() => submit(data));
      }}
      aria-label={request ? 'Edit repair request' : 'Create repair request'}
      aria-busy={pending}
      onReset={(e) => e.preventDefault()}
      className={styles.form}
    >
      {restoredDraft && !result.message && (
        <p role="status">Unsaved issue details restored. Save changes to apply them.</p>
      )}
      {result.error && (
        <p ref={feedback} tabIndex={-1} role="alert" className={styles.error}>
          {result.error}
        </p>
      )}
      {result.message && (
        <p ref={feedback} tabIndex={-1} role="status">
          {result.message} <a href={result.requestHref ?? returnTo}>Back to repair requests</a>
        </p>
      )}
      {!result.requestId && (
        <fieldset disabled={pending} className={styles.fields}>
          <section className="card">
            <h2>Location & context</h2>
            {request ? (
              <p>{request.location}</p>
            ) : (
              <label className="field">
                Property and unit
                <select
                  aria-label="Property and unit"
                  name="unitId"
                  required
                  defaultValue={selectedUnitId ?? (units.length === 1 ? units[0].id : '')}
                >
                  <option value="" disabled>
                    Select unit
                  </option>
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.number}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {!request && !units.length && <p>No active units available.</p>}
            {request && <p className="muted">The property and unit stay with this request.</p>}
          </section>
          <section className="card">
            <h2>Issue details</h2>
            <label className="field">
              Request title
              <input
                aria-label="Request title"
                name="title"
                required
                maxLength={160}
                defaultValue={request?.title}
                placeholder="e.g. Kitchen sink leak"
              />
            </label>
            <label className="field">
              Priority
              <select
                aria-label="Priority"
                name="priority"
                defaultValue={request?.priority ?? 'NORMAL'}
              >
                {['LOW', 'NORMAL', 'HIGH', 'URGENT'].map((p) => (
                  <option key={p} value={p}>
                    {p[0] + p.slice(1).toLowerCase()}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              Description
              <textarea
                aria-label="Description"
                name="description"
                maxLength={3000}
                defaultValue={request?.description ?? ''}
                rows={5}
                placeholder="What needs attention?"
              />
            </label>
          </section>
          {!request && (
            <section className="card">
              <h2>Photos</h2>
              <FileUploader kind="photo" formField="photo" multiple={false} label="Request photo" />
            </section>
          )}
          <div className={styles.actions}>
            <a className="btn btn-secondary" href={returnTo}>
              Cancel
            </a>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={pending || (!request && !units.length)}
            >
              {pending ? 'Saving...' : request ? 'Save changes' : 'Create request'}
            </button>
          </div>
        </fieldset>
      )}
    </form>
  );
}
