'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useBuilderShell } from './useBuilderShell';
import styles from './lease-builder.module.css';

/** First stop when /leases/new is opened without a unit: pick where the lease is for. */
export function UnitPicker({
  units,
  backHref,
  context = {},
  initialUnit = '',
}: {
  units: {
    id: string;
    label: string;
    status: string;
    draft?: { id: string; saved: string; step: number };
  }[];
  backHref: string;
  context?: { applicant?: string; tenant?: string; renew?: string };
  initialUnit?: string;
}) {
  const hydrated = useBuilderShell();
  const [selectedId, setSelectedId] = useState(initialUnit);
  const selected = units.find((unit) => unit.id === selectedId);
  return (
    <div className={styles.page} role="region" aria-label="Create lease" inert={!hydrated}>
      <header className={styles.topbar}>
        <Link className={styles.back} href={backHref} aria-label="Back to leases">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </Link>
        <div className={styles.place}>
          <span className={styles.topCaption}>Leasing workspace</span>
          Create lease
        </div>
      </header>
      <div className={`${styles.layout} ${styles.pickerLayout}`}>
        <section className={styles.card} aria-labelledby="pick-title">
          <form className={styles.cardBody} method="get" action="/leases/new">
            {context.applicant && (
              <input type="hidden" name="applicant" value={context.applicant} />
            )}
            {context.tenant && <input type="hidden" name="tenant" value={context.tenant} />}
            {context.renew && <input type="hidden" name="renew" value={context.renew} />}
            <div className={styles.cardHead}>
              <div>
                <p className={styles.kicker}>Before you begin</p>
                <h1 id="pick-title">Which unit is this lease for?</h1>
                <p className={styles.sub}>
                  Choose one unit or a whole single-family home. Then set the term, choose existing
                  tenants and review the agreement. You can save a draft along the way.
                </p>
              </div>
            </div>
            {units.length ? (
              <label className={styles.field}>
                Property / unit
                <select
                  name="unit"
                  required
                  value={selectedId}
                  onChange={(event) => setSelectedId(event.target.value)}
                >
                  <option value="" disabled>
                    Select a unit
                  </option>
                  {units.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.label}
                      {unit.status === 'VACANT' ? ' · Vacant' : ''}
                      {unit.draft ? ' · Draft in progress' : ''}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <p className={styles.sub} role="status">
                No units are available in this view. Add a property and unit before creating a
                lease.
              </p>
            )}
            {selected?.draft && (
              <div className={styles.draftChoice} role="status">
                <strong>A draft is already in progress</strong>
                <p>
                  {selected.label} · Saved {selected.draft.saved} · Step {selected.draft.step} of 10
                </p>
                <Link
                  className={`${styles.btn} ${styles.primary}`}
                  href={`/leases/new?draft=${encodeURIComponent(selected.draft.id)}`}
                >
                  Resume draft
                </Link>
                <p className={styles.sub}>
                  Starting a separate lease keeps this draft available in Drafts.
                </p>
                <input type="hidden" name="fresh" value="1" />
              </div>
            )}
            <div className={`${styles.footer} ${styles.pickerFooter}`}>
              <Link className={styles.btn} href={backHref}>
                Cancel
              </Link>
              <button
                type="submit"
                className={`${styles.btn} ${selected?.draft ? '' : styles.primary}`}
                disabled={!units.length}
              >
                {selected?.draft ? 'Start a separate lease' : 'Start lease'}
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
