'use client';

import { useState } from 'react';
import { FileUploader } from '@/components/upload';
import { Field } from '@/components/ui/Forms';
import { CATEGORIES, ENTRY_OPTIONS, MAX_PHOTOS, URGENCY_OPTIONS } from './format';
import styles from './repairs.module.css';

export function RepairForm() {
  const [error, setError] = useState(false);
  const [pending, setPending] = useState(false);
  return (
    <form
      className={`form ${styles.form}`}
      method="post"
      action="/repairs/submit"
      encType="multipart/form-data"
      noValidate
      aria-busy={pending}
      onSubmit={(event) => {
        const description = event.currentTarget.elements.namedItem(
          'description',
        ) as HTMLTextAreaElement;
        if (!description.value.trim()) {
          event.preventDefault();
          setError(true);
          description.focus();
          return;
        }
        if (pending) {
          event.preventDefault();
          return;
        }
        setPending(true);
      }}
    >
      <label className="field">
        Category
        <select name="category" defaultValue={CATEGORIES[0]}>
          {CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </label>
      <Field
        label="What needs fixing?"
        error={
          error ? (
            <span id="repair-error">Describe what needs fixing so the vendor can prepare.</span>
          ) : undefined
        }
      >
        <textarea
          id="repair-description"
          name="description"
          aria-label="What needs fixing?"
          aria-invalid={error}
          aria-describedby={error ? 'repair-error repair-hint' : 'repair-hint'}
          onChange={() => setError(false)}
          required
          maxLength={2800}
          placeholder="e.g. Kitchen faucet leaks under the sink…"
        />
        <span className="hint" id="repair-hint">
          Add where it is and when it started, so the vendor brings the right parts.
        </span>
      </Field>
      <section className={styles.upload} aria-labelledby="repair-photos-title">
        <h3 id="repair-photos-title">Photos</h3>
        <FileUploader
          kind="photo"
          formField="photos"
          max={MAX_PHOTOS}
          label="Photos"
          hint={`JPG, PNG or HEIC · up to ${MAX_PHOTOS} photos`}
          showCounter={false}
        />
      </section>
      <fieldset className={styles.entry}>
        <legend style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Entry permission</legend>
        <div className="stack" style={{ gap: 8 }}>
          {Object.entries(ENTRY_OPTIONS).map(([value, label], index) => (
            <label className={styles.option} key={value}>
              <input type="radio" name="entry" value={value} defaultChecked={index === 0} />
              <span style={{ flex: 1, fontSize: 14 }}>{label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="field">
        <label htmlFor="repair-urgency">Urgency</label>
        <select
          id="repair-urgency"
          name="urgency"
          defaultValue="NORMAL"
          aria-describedby="urgency-help"
        >
          {URGENCY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <span className={`hint ${styles.emergency}`} id="urgency-help">
          For emergencies (burst pipe, no heat) also call your property manager.
        </span>
      </div>
      <button className="btn btn-primary btn-block" type="submit" disabled={pending}>
        {pending ? 'Sending request…' : 'Submit request'}
      </button>
    </form>
  );
}
