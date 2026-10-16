'use client';

import { useRef } from 'react';
import { FileUploader } from '@/components/upload/FileUploader';
import styles from './operations.module.css';

type CreateAction = (formData: FormData) => void | Promise<void>;

export function NewMaintenanceRequestDialog({
  action,
  propertyName,
  units,
  selectedUnitId,
  triggerLabel = '+ New request',
}: {
  action: CreateAction;
  propertyName: string;
  units: Array<{ id: string; number: string }>;
  selectedUnitId?: string;
  triggerLabel?: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const defaultUnitId = selectedUnitId ?? (units.length === 1 ? units[0]?.id : undefined);

  return (
    <>
      <button
        className="btn btn-primary"
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        disabled={units.length === 0}
      >
        {triggerLabel}
      </button>
      <dialog
        ref={dialogRef}
        className={styles.requestDialog}
        aria-labelledby="new-request-heading"
      >
        <div className={styles.dialogHeader}>
          <h2 id="new-request-heading">New repair request</h2>
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            onClick={() => dialogRef.current?.close()}
            aria-label="Close new request dialog"
          >
            Close
          </button>
        </div>
        <form action={action} className="form">
          <label className="field">
            Property
            <span className={styles.readonlyField}>{propertyName}</span>
          </label>
          <label className="field">
            Unit
            <select name="unitId" required defaultValue={defaultUnitId ?? ''}>
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
        </form>
      </dialog>
    </>
  );
}
