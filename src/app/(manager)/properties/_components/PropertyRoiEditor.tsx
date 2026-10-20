'use client';
import Link from 'next/link';
import { useActionState, useEffect, useRef, useState } from 'react';
import { Alert, Button } from '@/components/ui';
import { valuesFrom } from '@/components/analysis/fields';
import type { PropertyRoiInputs } from '@/lib/properties/roi-inputs';
import { updatePropertyRoiAction, type FormState } from '../actions';
import { PropertyRoiFields } from './PropertyRoiFields';
import styles from '../properties.module.css';

export function PropertyRoiEditor({
  propertyId,
  initial,
}: {
  propertyId: string;
  initial: PropertyRoiInputs;
}) {
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  function close(didSave = false) {
    setSaved(didSave);
    setEditing(false);
    requestAnimationFrame(() => trigger.current?.focus());
  }
  return (
    <section className={styles.roiEditor} aria-label="Property ROI details">
      <h2>ROI details</h2>
      <p className="muted">
        Optional purchase, financing and forecast inputs for the whole property. A new ROI analysis
        uses these details. Saved analyses keep your previous edits.
      </p>
      {saved && <p role="status">ROI details saved.</p>}
      {editing ? (
        <Editor propertyId={propertyId} initial={initial} onClose={close} />
      ) : (
        <div className={styles.formActions}>
          <button
            type="button"
            className="btn btn-secondary"
            ref={trigger}
            onClick={() => {
              setSaved(false);
              setEditing(true);
            }}
          >
            Edit ROI details
          </button>
          <Link
            className="btn btn-primary"
            href={`/roi-analysis?property=${encodeURIComponent(propertyId)}`}
          >
            Open ROI Analysis →
          </Link>
        </div>
      )}
    </section>
  );
}

function Editor({
  propertyId,
  initial,
  onClose,
}: {
  propertyId: string;
  initial: PropertyRoiInputs;
  onClose: (saved?: boolean) => void;
}) {
  const [original] = useState(() => valuesFrom(initial));
  const [values, setValues] = useState(original);
  const [state, action, pending] = useActionState(updatePropertyRoiAction, {} as FormState);
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    const details = form.current?.querySelector('details');
    if (details) details.open = true;
    details?.querySelector('summary')?.focus();
  }, []);
  useEffect(() => {
    if (state.ok) onClose(true);
  }, [state, onClose]);
  return (
    <form ref={form} action={action} className={styles.propertyForm} aria-busy={pending} noValidate>
      <input type="hidden" name="propertyId" value={propertyId} />
      {state.message && !state.ok && <Alert tone="warning">{state.message}</Alert>}
      <fieldset disabled={pending} style={{ border: 0, padding: 0, minWidth: 0 }}>
        <PropertyRoiFields
          values={values}
          onChange={setValues}
          original={original}
          errors={state.errors}
        />
      </fieldset>
      <div className={styles.formActions}>
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? 'Saving…' : 'Save ROI details'}
        </Button>
        <Button disabled={pending} onClick={() => onClose()}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
