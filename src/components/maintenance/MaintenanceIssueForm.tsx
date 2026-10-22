'use client';
import { useActionState, useEffect, useRef, useState, startTransition } from 'react';
import type { RequestActionResult, RequestAction } from './RequestActionForm';
import styles from './issue-form.module.css';
import { restoreIssueDraft } from './issue-draft';
import { useToast } from '@/components/ui/Toast';

export type IssuePropertyOption = {
  id: string;
  name: string;
  units: { id: string; number: string }[];
};
export type IssueVendorOption = { id: string; name: string };

const PRIORITIES = ['LOW', 'NORMAL', 'HIGH', 'URGENT'];
const PHOTO_PATTERN = /\.(jpe?g|png|hei[cf])$/i;
const MAX_PHOTO_BYTES = 25 * 1024 * 1024;

/** The property that owns the scoped unit, else the scoped property, else the only property. */
export function initialPropertyId(
  properties: IssuePropertyOption[],
  scope: { propertyId?: string; unitId?: string } = {},
) {
  if (scope.unitId) {
    const owner = properties.find((p) => p.units.some((u) => u.id === scope.unitId));
    if (owner) return owner.id;
  }
  if (scope.propertyId && properties.some((p) => p.id === scope.propertyId))
    return scope.propertyId;
  return properties.length === 1 ? properties[0].id : '';
}

export function MaintenanceIssueForm({
  action,
  scope,
  returnTo,
  properties = [],
  vendors = [],
  selectedUnitId,
  request,
}: {
  action?: RequestAction;
  scope?: { requestId?: string; propertyId?: string; unitId?: string };
  returnTo: string;
  properties?: IssuePropertyOption[];
  vendors?: IssueVendorOption[];
  selectedUnitId?: string;
  request?: { title: string; description: string | null; priority: string; location: string };
}) {
  const toast = useToast();
  const [result, submit, pending] = useActionState(
    async (_: RequestActionResult, data: FormData): Promise<RequestActionResult> => {
      if (action) return action(data);
      data.set('returnTo', returnTo);
      if (scope?.requestId) data.set('requestId', scope.requestId);
      if (scope?.propertyId) data.set('propertyId', scope.propertyId);
      if (scope?.unitId) data.set('scopeUnitId', scope.unitId);
      const vendorId = String(data.get('vendorId') ?? '');
      data.delete('vendorId');
      let saved: RequestActionResult;
      try {
        const response = await fetch('/maintenance/form', { method: 'POST', body: data });
        if (!response.ok) throw new Error('Save failed');
        saved = await response.json();
      } catch {
        return { error: 'The request could not be saved. Your changes are still here. Try again.' };
      }
      if (!saved.requestId || !vendorId) return saved;
      // Vendor is optional: assign it with the existing request action once the request exists.
      const assign = new FormData();
      assign.set('operation', 'assign');
      assign.set('requestId', saved.requestId);
      assign.set('vendorId', vendorId);
      if (scope?.propertyId) assign.set('propertyId', scope.propertyId);
      if (scope?.unitId) assign.set('scopeUnitId', scope.unitId);
      try {
        const response = await fetch('/maintenance/form', { method: 'POST', body: assign });
        const assigned: RequestActionResult = response.ok ? await response.json() : {};
        if (assigned.error || !assigned.message) throw new Error(assigned.error);
        return { ...saved, message: `${saved.message} Vendor assigned.` };
      } catch {
        return {
          ...saved,
          message: `${saved.message} The vendor could not be assigned. Open the request to assign one.`,
        };
      }
    },
    {},
  );
  const feedback = useRef<HTMLParagraphElement>(null);
  const issueForm = useRef<HTMLFormElement>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const [restoredDraft, setRestoredDraft] = useState(false);
  const [propertyId, setPropertyId] = useState(() =>
    initialPropertyId(properties, { propertyId: scope?.propertyId, unitId: selectedUnitId }),
  );
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoError, setPhotoError] = useState('');
  const property = properties.find((p) => p.id === propertyId);
  const units = (property?.units ?? []).filter((u) => !selectedUnitId || u.id === selectedUnitId);
  const scopedProperties = scope?.propertyId
    ? properties.filter((p) => p.id === scope.propertyId)
    : properties;
  const noUnits = !request && !properties.some((p) => p.units.length);
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
    if (result.message) toast.success(result.message);
  }, [result, toast]);
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
      className={`card ${styles.form}`}
    >
      <h2 className={styles.title}>Request details</h2>
      {restoredDraft && !result.message && (
        <p role="status">Unsaved issue details restored. Save changes to apply them.</p>
      )}
      {result.error && (
        <p ref={feedback} tabIndex={-1} role="alert" className={styles.error}>
          {result.error}
        </p>
      )}
      {result.message && (
        <p ref={feedback} tabIndex={-1} role="status" className={styles.success}>
          {result.message} <a href={result.requestHref ?? returnTo}>Back to repair requests</a>
        </p>
      )}
      {!result.requestId && (
        <fieldset disabled={pending} className={styles.fields}>
          {request ? (
            <div>
              <p className={styles.location}>{request.location}</p>
              <p className={styles.caption}>The property and unit stay with this request.</p>
            </div>
          ) : (
            <div className={styles.pair}>
              <label className="field">
                Property
                <select
                  value={propertyId}
                  onChange={(event) => setPropertyId(event.target.value)}
                  disabled={Boolean(scope?.propertyId && scopedProperties.length === 1)}
                >
                  <option value="" disabled>
                    Choose a property
                  </option>
                  {scopedProperties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Unit
                <select
                  key={propertyId}
                  name="unitId"
                  required
                  disabled={!property || !units.length}
                  defaultValue={selectedUnitId ?? (units.length === 1 ? units[0].id : '')}
                >
                  <option value="" disabled>
                    {property ? 'Choose a unit' : 'Choose a property first'}
                  </option>
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.number}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
          {noUnits && <p className={styles.caption}>No active units available.</p>}
          <label className="field">
            Title
            <input
              name="title"
              required
              maxLength={160}
              defaultValue={request?.title}
              placeholder="e.g. Kitchen sink leak"
            />
          </label>
          <label className="field">
            Description
            <textarea
              name="description"
              maxLength={3000}
              defaultValue={request?.description ?? ''}
              rows={5}
              placeholder="Symptoms, when it started and access instructions for the vendor"
            />
          </label>
          <div className={styles.pair}>
            <label className="field">
              Priority
              <select name="priority" defaultValue={request?.priority ?? 'NORMAL'}>
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p[0] + p.slice(1).toLowerCase()}
                  </option>
                ))}
              </select>
            </label>
            {!request && (
              <label className="field">
                Vendor (optional)
                <select name="vendorId" defaultValue="" disabled={!vendors.length}>
                  <option value="">Unassigned</option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          {!request && (
            <div className={styles.photoRow}>
              <span className={styles.photoSummary}>
                <PhotoGlyph />
                <span>
                  Photos · {photo ? photo.name : 'none added'}
                  {photoError && (
                    <span role="alert" className={styles.photoError}>
                      {photoError}
                    </span>
                  )}
                </span>
              </span>
              <span className={styles.photoActions}>
                {photo && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      setPhoto(null);
                      if (photoInput.current) photoInput.current.value = '';
                    }}
                  >
                    Remove
                  </button>
                )}
                <label className={`btn btn-secondary btn-sm ${styles.filePicker}`}>
                  {photo ? 'Change photo' : 'Add photos'}
                  <input
                    ref={photoInput}
                    type="file"
                    name="photo"
                    accept=".jpg,.jpeg,.png,.heic,.heif"
                    aria-label="Request photo"
                    onChange={(event) => {
                      const selected = event.target.files?.[0] ?? null;
                      setPhotoError('');
                      if (
                        selected &&
                        (selected.size > MAX_PHOTO_BYTES || !PHOTO_PATTERN.test(selected.name))
                      ) {
                        setPhotoError('Choose a JPG, PNG or HEIC photo up to 25 MB.');
                        event.target.value = '';
                        setPhoto(null);
                        return;
                      }
                      setPhoto(selected);
                    }}
                  />
                </label>
              </span>
            </div>
          )}
          <div className={styles.actions}>
            <a className="btn btn-secondary" href={returnTo}>
              Cancel
            </a>
            <button type="submit" className="btn btn-primary" disabled={pending || noUnits}>
              {pending ? 'Saving…' : request ? 'Save changes' : 'Save request'}
            </button>
          </div>
        </fieldset>
      )}
    </form>
  );
}

function PhotoGlyph() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true" focusable="false">
      <rect x="2.5" y="4" width="15" height="12" rx="2" fill="none" stroke="currentColor" />
      <circle cx="7.5" cy="8.5" r="1.5" fill="none" stroke="currentColor" />
      <path d="m3 14 4.5-4 3.5 3 2.5-2 4 3.5" fill="none" stroke="currentColor" />
    </svg>
  );
}
