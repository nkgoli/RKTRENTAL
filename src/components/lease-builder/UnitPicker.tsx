'use client';

import Link from 'next/link';
import { useBuilderShell } from './useBuilderShell';
import styles from './lease-builder.module.css';

/** First stop when /leases/new is opened without a unit: pick where the lease is for. */
export function UnitPicker({
  units,
  backHref,
  context = {},
}: {
  units: { id: string; label: string; status: string }[];
  backHref: string;
  context?: { applicant?: string; tenant?: string };
}) {
  const hydrated = useBuilderShell();
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
        <div className={styles.place}>Create lease</div>
      </header>
      <div className={styles.layout} style={{ gridTemplateColumns: 'minmax(0, 640px)' }}>
        <section className={styles.card} aria-labelledby="pick-title">
          <form className={styles.cardBody} method="get" action="/leases/new">
            {context.applicant && (
              <input type="hidden" name="applicant" value={context.applicant} />
            )}
            {context.tenant && <input type="hidden" name="tenant" value={context.tenant} />}
            <div className={styles.cardHead}>
              <div>
                <p className={styles.kicker}>Before you begin</p>
                <h1 id="pick-title">Which unit is this lease for?</h1>
                <p className={styles.sub}>
                  Choose one unit or a whole single-family home. Then set the term, add tenants and
                  review the agreement. You can save a draft along the way.
                </p>
              </div>
            </div>
            {units.length ? (
              <label className={styles.field}>
                Property / unit
                <select name="unit" required defaultValue="">
                  <option value="" disabled>
                    Select a unit
                  </option>
                  {units.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.label}
                      {unit.status === 'VACANT' ? ' · Vacant' : ''}
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
            <div className={styles.footer}>
              <Link className={styles.btn} href={backHref}>
                Cancel
              </Link>
              <button
                type="submit"
                className={`${styles.btn} ${styles.primary}`}
                disabled={!units.length}
              >
                Start lease
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
