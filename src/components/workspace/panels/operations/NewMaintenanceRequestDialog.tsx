'use client';

import { useRef, useState, useId } from 'react';
import { FileUploader } from '@/components/upload/FileUploader';
import { RequestActionForm, type RequestAction } from '@/components/maintenance/RequestActionForm';
import styles from './operations.module.css';

export function NewMaintenanceRequestDialog({
  action,
  propertyName,
  units,
  selectedUnitId,
  triggerLabel = '+ New request',
}: {
  action: RequestAction;
  propertyName: string;
  units: Array<{ id: string; number: string }>;
  selectedUnitId?: string;
  triggerLabel?: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [generation, setGeneration] = useState(0);
  const headingId = useId();
  const defaultUnitId = selectedUnitId ?? (units.length === 1 ? units[0]?.id : undefined);

  return (
    <>
      <button
        className="btn btn-primary"
        type="button"
        onClick={() => {
          setGeneration((value) => value + 1);
          dialogRef.current?.showModal();
        }}
        disabled={units.length === 0}
      >
        {triggerLabel}
      </button>
      {units.length === 0 && (
        <p className="muted">Add an active unit to this property before creating a request.</p>
      )}
      <dialog
        ref={dialogRef}
        className={styles.requestDialog}
        aria-labelledby={headingId}
        onClick={(event) => {
          if ((event.target as HTMLElement).closest('a[href^="#request-"]'))
            dialogRef.current?.close();
        }}
      >
        <div className={styles.dialogHeader}>
          <h2 id={headingId}>New repair request</h2>
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            onClick={() => dialogRef.current?.close()}
            aria-label="Close new request dialog"
          >
            Close
          </button>
        </div>
        <RequestActionForm
          key={generation}
          action={action}
          className="form"
          label="Create repair request"
        >
          <label className="field">
            Property
            <span className={styles.readonlyField}>{propertyName}</span>
          </label>
          <label className="field">
            Unit
            <select name="unitId" required defaultValue={defaultUnitId ?? ''} autoFocus>
              <option value="" disabled>
                Select unit
              </option>
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.number}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Priority
            <select name="priority" defaultValue="NORMAL">
              <option value="LOW">Low</option>
              <option value="NORMAL">Normal</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
          </label>
          <label className="field">
            Request title
            <input name="title" required maxLength={160} placeholder="e.g. Kitchen sink leak" />
          </label>
          <label className="field">
            Description
            <textarea name="description" maxLength={3000} placeholder="What needs attention?" />
          </label>
          <div className="field">
            <span id="new-request-photo">Photo</span>
            <FileUploader kind="photo" formField="photo" multiple={false} label="Request photo" />
          </div>
          <div className={styles.dialogActions}>
            <button
              className="btn btn-secondary"
              type="button"
              onClick={() => dialogRef.current?.close()}
            >
              Cancel
            </button>
            <button className="btn btn-primary" type="submit">
              Create request
            </button>
          </div>
        </RequestActionForm>
      </dialog>
    </>
  );
}
