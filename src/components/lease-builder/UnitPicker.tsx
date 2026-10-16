import Link from 'next/link';
import styles from './lease-builder.module.css';

/** First stop when /leases/new is opened without a unit: pick where the lease is for. */
export function UnitPicker({
  units,
  backHref,
}: {
  units: { id: string; label: string; status: string }[];
  backHref: string;
}) {
  return (
    <div className={styles.page} role="region" aria-label="Create lease">
      <header className={styles.topbar}>
        <Link className={styles.back} href={backHref} aria-label="Back">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </Link>
        <div className={styles.place}>Create lease</div>
      </header>
      <div className={styles.layout} style={{ gridTemplateColumns: 'minmax(0, 640px)' }}>
        <section className={styles.card} aria-labelledby="pick-title">
          <form className={styles.cardBody} method="get" action="/leases/new">
            <div className={styles.cardHead}>
              <div>
                <h2 id="pick-title">Which unit is this lease for?</h2>
                <p className={styles.sub}>
                  Each lease covers one unit. You can save the draft at any step and pick it up again later.
                </p>
              </div>
            </div>
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
            <div className={styles.footer}>
              <Link className={styles.btn} href={backHref}>
                Cancel
              </Link>
              <button type="submit" className={`${styles.btn} ${styles.primary}`}>
                Start lease
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
